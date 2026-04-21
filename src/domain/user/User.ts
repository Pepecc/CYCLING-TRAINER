import { randomUUID } from 'crypto'

export interface UserProps {
  id: string
  email: string
  passwordHash: string
  createdAt: string
}

export interface PublicUser {
  id: string
  email: string
  createdAt: string
}

export class User {
  readonly id: string
  readonly email: string
  readonly passwordHash: string
  readonly createdAt: string

  constructor(props: UserProps) {
    this.id = props.id
    this.email = props.email
    this.passwordHash = props.passwordHash
    this.createdAt = props.createdAt
  }

  static create(params: { email: string; passwordHash: string }): User {
    return new User({
      id: randomUUID(),
      email: params.email,
      passwordHash: params.passwordHash,
      createdAt: new Date().toISOString(),
    })
  }

  toPublic(): PublicUser {
    return {
      id: this.id,
      email: this.email,
      createdAt: this.createdAt,
    }
  }
}
