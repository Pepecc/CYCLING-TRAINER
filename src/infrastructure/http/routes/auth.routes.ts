import { Router, Request, Response } from 'express'
import { RegisterUser } from '../../../application/auth/RegisterUser'
import { LoginUser } from '../../../application/auth/LoginUser'

interface AuthContainer {
  registerUser: RegisterUser
  loginUser: LoginUser
}

export function createAuthRouter({ registerUser, loginUser }: AuthContainer): Router {
  const router = Router()

  router.post('/register', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body as { email: string; password: string }
      const user = await registerUser.execute({ email, password })
      res.status(201).json({ user })
    } catch (err) {
      res.status(400).json({ error: (err as Error).message })
    }
  })

  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body as { email: string; password: string }
      const result = await loginUser.execute({ email, password })
      res.json(result)
    } catch (err) {
      res.status(401).json({ error: (err as Error).message })
    }
  })

  return router
}
