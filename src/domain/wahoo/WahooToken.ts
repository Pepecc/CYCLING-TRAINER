// Representa los tokens OAuth2 de Wahoo para un usuario

export interface WahooTokenProps {
  userId: string
  accessToken: string
  refreshToken: string
  expiresAt: string   // ISO string — cuándo expira el access token
  createdAt: string
}

export class WahooToken {
  readonly userId: string
  accessToken: string
  refreshToken: string
  expiresAt: string
  readonly createdAt: string

  constructor(props: WahooTokenProps) {
    this.userId = props.userId
    this.accessToken = props.accessToken
    this.refreshToken = props.refreshToken
    this.expiresAt = props.expiresAt
    this.createdAt = props.createdAt
  }

  static create(params: {
    userId: string
    accessToken: string
    refreshToken: string
    expiresIn: number   // segundos hasta expiración (Wahoo devuelve 7200 = 2h)
  }): WahooToken {
    const expiresAt = new Date(Date.now() + params.expiresIn * 1000).toISOString()
    return new WahooToken({
      userId: params.userId,
      accessToken: params.accessToken,
      refreshToken: params.refreshToken,
      expiresAt,
      createdAt: new Date().toISOString(),
    })
  }

  isExpired(): boolean {
    // Consideramos expirado 5 minutos antes para evitar race conditions
    return Date.now() >= new Date(this.expiresAt).getTime() - 5 * 60 * 1000
  }
}
