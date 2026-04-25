import { Router, Request, Response } from 'express'
import crypto from 'crypto'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { WahooOAuthService } from '../../wahoo/WahooOAuthService'
import { GetWahooWorkouts } from '../../../application/wahoo/GetWahooWorkouts'
import { AnalyzeWahooWorkout } from '../../../application/wahoo/AnalyzeWahooWorkout'
import { SendMessage } from '../../../application/chat/SendMessage'

interface WahooContainer {
  wahooService: WahooOAuthService
  getWahooWorkouts: GetWahooWorkouts
  analyzeWahooWorkout: AnalyzeWahooWorkout
  sendMessage: SendMessage
}

// Temporal in-memory store for OAuth state — good enough for single-instance
// In multi-instance deploy, use Redis or DB
const pendingStates = new Map<string, string>()  // state → userId

export function createWahooRouter(container: WahooContainer): Router {
  const router = Router()
  const { wahooService, getWahooWorkouts, analyzeWahooWorkout, sendMessage } = container

  // ── GET /api/wahoo/status ─────────────────────────────────────────────────
  // Check if current user has Wahoo connected
  router.get('/status', authMiddleware, async (req, res: Response) => {
    const { userId } = req as AuthRequest
    const connected = await wahooService.isConnected(userId)
    res.json({ connected })
  })

  // ── GET /api/wahoo/connect ────────────────────────────────────────────────
  // Redirects user to Wahoo authorization page
  router.get('/connect', authMiddleware, (req, res: Response) => {
    const { userId } = req as AuthRequest

    // CSRF protection: generate a random state tied to this userId
    const state = crypto.randomBytes(16).toString('hex')
    pendingStates.set(state, userId)

    // Clean up old states after 10 minutes
    setTimeout(() => pendingStates.delete(state), 10 * 60 * 1000)

    const authUrl = wahooService.buildAuthorizationUrl(state)
    res.redirect(authUrl)
  })

  // ── GET /api/wahoo/callback ───────────────────────────────────────────────
  // Wahoo redirects here after user authorizes
  router.get('/callback', async (req: Request, res: Response) => {
    const { code, state, error } = req.query as Record<string, string>

    if (error) {
      return res.redirect(`/?wahoo_error=${encodeURIComponent(error)}`)
    }

    if (!code || !state) {
      return res.status(400).send('Parámetros de callback inválidos')
    }

    const userId = pendingStates.get(state)
    if (!userId) {
      return res.status(400).send('State inválido o expirado. Vuelve a intentar la conexión.')
    }

    pendingStates.delete(state)

    try {
      await wahooService.exchangeCode(userId, code)
      // Redirect to frontend with success flag
      res.redirect('/?wahoo_connected=true')
    } catch (err) {
      console.error('Wahoo callback error:', err)
      res.redirect(`/?wahoo_error=${encodeURIComponent((err as Error).message)}`)
    }
  })

  // ── GET /api/wahoo/workouts ───────────────────────────────────────────────
  // List recent workouts for the authenticated user
  router.get('/workouts', authMiddleware, async (req, res: Response) => {
    const { userId } = req as AuthRequest
    const page = Number(req.query.page) || 1
    const perPage = Number(req.query.per_page) || 10

    try {
      const workouts = await getWahooWorkouts.execute(userId, page, perPage)
      res.json({ workouts })
    } catch (err) {
      const message = (err as Error).message
      const status = message.includes('no conectado') ? 403 : 500
      res.status(status).json({ error: message })
    }
  })

  // ── POST /api/wahoo/workouts/:id/analyze ─────────────────────────────────
  // Fetch workout from Wahoo + send to coach for analysis
  // Creates a new conversation with the workout context pre-loaded
  router.post('/workouts/:id/analyze', authMiddleware, async (req, res: Response) => {
    const { userId } = req as AuthRequest
    const workoutId = Number(req.params.id)

    if (isNaN(workoutId)) {
      return res.status(400).json({ error: 'workout id inválido' })
    }

    try {
      const { analysisContext } = await analyzeWahooWorkout.execute({ userId, workoutId })

      // Send the workout context as the first user message in a new conversation
      const result = await sendMessage.execute({
        userId,
        content: analysisContext,
        conversationId: null,
      })

      res.json({
        conversationId: result.conversationId,
        message: result.message,
      })
    } catch (err) {
      const message = (err as Error).message
      const status = message.includes('no conectado') ? 403 : 500
      res.status(status).json({ error: message })
    }
  })

  // ── DELETE /api/wahoo/disconnect ─────────────────────────────────────────
  router.delete('/disconnect', authMiddleware, async (req, res: Response) => {
    const { userId } = req as AuthRequest
    try {
      await wahooService.disconnect(userId)
      res.json({ disconnected: true })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  return router
}
