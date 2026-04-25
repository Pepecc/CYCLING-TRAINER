import { WahooToken } from './WahooToken'

export interface WahooTokenRepository {
  findByUserId(userId: string): Promise<WahooToken | null>
  save(token: WahooToken): Promise<void>
  deleteByUserId(userId: string): Promise<void>
}
