import { CyclistProfile } from '../../domain/profile/CyclistProfile'
import { CyclistProfileRepository } from '../../domain/profile/CyclistProfileRepository'

export class GetProfile {
  constructor(private readonly profileRepository: CyclistProfileRepository) {}

  async execute(userId: string): Promise<CyclistProfile | null> {
    return this.profileRepository.findByUserId(userId)
  }
}
