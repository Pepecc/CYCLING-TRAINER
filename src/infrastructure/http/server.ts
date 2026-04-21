import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import { buildContainer } from '../../config/container'
import { createAuthRouter } from './routes/auth.routes'
import { createProfileRouter } from './routes/profile.routes'
import { createChatRouter } from './routes/chat.routes'

const PORT = process.env.PORT ?? 3000

async function bootstrap(): Promise<void> {
  const app = express()

  app.use(cors())
  app.use(express.json())

  const container = buildContainer()

  app.use('/api/auth',    createAuthRouter(container))
  app.use('/api/profile', createProfileRouter(container))
  app.use('/api/chat',    createChatRouter(container))

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Ruta no encontrada' })
  })

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err)
    res.status(500).json({ error: 'Error interno del servidor' })
  })

  app.listen(PORT, () => {
    console.log(`🚴 Cycling Coach API  →  http://localhost:${PORT}`)
    console.log(`   Health check       →  http://localhost:${PORT}/health`)
  })
}

bootstrap()
