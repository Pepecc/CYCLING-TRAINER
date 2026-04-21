import { Router, Response } from 'express'
import { authMiddleware, AuthRequest } from '../middleware/auth'
import { GetProfile } from '../../../application/profile/GetProfile'
import { UpdateProfile } from '../../../application/profile/UpdateProfile'
import { Experience } from '../../../domain/profile/CyclistProfile'

interface ProfileContainer {
  getProfile: GetProfile
  updateProfile: UpdateProfile
}

export function createProfileRouter({ getProfile, updateProfile }: ProfileContainer): Router {
  const router = Router()
  router.use(authMiddleware)

  router.get('/', async (req, res: Response) => {
    try {
      const { userId } = req as AuthRequest
      const profile = await getProfile.execute(userId)
      res.json({ profile })
    } catch (err) {
      res.status(500).json({ error: (err as Error).message })
    }
  })

  router.put('/', async (req, res: Response) => {
    try {
      const { userId } = req as AuthRequest
      const { ftp, weightKg, hoursPerWeek, goal, experience } = req.body as {
        ftp?: number
        weightKg?: number
        hoursPerWeek?: number
        goal?: string
        experience?: Experience
      }
      const profile = await updateProfile.execute({ userId, ftp, weightKg, hoursPerWeek, goal, experience })
      res.json({ profile })
    } catch (err) {
      res.status(400).json({ error: (err as Error).message })
    }
  })

  return router
}
