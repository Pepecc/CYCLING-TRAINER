import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthRequest extends Request {
  userId: string
  userEmail: string
}

interface JwtPayload {
  userId: string
  email: string
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization']
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token requerido' })
    return
  }

  const token = authHeader.split(' ')[1]
  const secret = process.env.JWT_SECRET

  if (!secret) {
    res.status(500).json({ error: 'JWT_SECRET no configurado' })
    return
  }

  try {
    const payload = jwt.verify(token, secret) as JwtPayload
      (req as AuthRequest).userId = payload.userId;
      (req as AuthRequest).userEmail = payload.email;
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}
