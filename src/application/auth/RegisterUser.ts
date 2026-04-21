import bcrypt from 'bcryptjs'
import { User, PublicUser } from '../../domain/user/User'
import { UserRepository } from '../../domain/user/UserRepository'

interface RegisterUserInput {
  email: string
  password: string
}

export class RegisterUser {
  constructor(private readonly userRepository: UserRepository) {}

  async execute({ email, password }: RegisterUserInput): Promise<PublicUser> {
    if (!email || !password) {
      throw new Error('Email y contraseña son requeridos')
    }
    if (password.length < 8) {
      throw new Error('La contraseña debe tener al menos 8 caracteres')
    }

    const existing = await this.userRepository.findByEmail(email.toLowerCase().trim())
    if (existing) {
      throw new Error('Ya existe una cuenta con ese email')
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = User.create({ email: email.toLowerCase().trim(), passwordHash })

    await this.userRepository.save(user)
    return user.toPublic()
  }
}
