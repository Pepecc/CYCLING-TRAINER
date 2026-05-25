export interface UserProps {
  id: string
  email: string
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
  readonly createdAt: string

  constructor(props: UserProps) {
    this.id = props.id
    this.email = props.email
    this.createdAt = props.createdAt
  }

  toPublic(): PublicUser {
    return { id: this.id, email: this.email, createdAt: this.createdAt }
  }
}
