import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PublicUser } from '../../domain/user/User'
import { UserRepository } from '../../domain/user/UserRepository'

interface LoginUserInput {
  email: string
  password: string
}

interface LoginUserOutput {
  token: string
  user: PublicUser
}

export class LoginUser {
  constructor(private readonly userRepository: UserRepository) {}

  async execute({ email, password }: LoginUserInput): Promise<LoginUserOutput> {
    if (!email || !password) {
      throw new Error('Email y contraseña son requeridos')
    }

    const user = await this.userRepository.findByEmail(email.toLowerCase().trim())
    if (!user) throw new Error('Credenciales incorrectas')

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) throw new Error('Credenciales incorrectas')

    const secret = process.env.JWT_SECRET
    if (!secret) throw new Error('JWT_SECRET no configurado')

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      secret,
      { expiresIn: '7d' }
    )

    return { token, user: user.toPublic() }
  }
}
