import { CyclistProfile } from './CyclistProfile'

export interface CyclistProfileRepository {
  findByUserId(userId: string): Promise<CyclistProfile | null>
  save(profile: CyclistProfile): Promise<void>
}
