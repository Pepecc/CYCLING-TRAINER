import { CyclistProfile, Experience } from '../../domain/profile/CyclistProfile'
import { CyclistProfileRepository } from '../../domain/profile/CyclistProfileRepository'

interface UpdateProfileInput {
  userId: string
  ftp?: number | null
  weightKg?: number | null
  hoursPerWeek?: number | null
  goal?: string | null
  experience?: Experience
}

export class UpdateProfile {
  constructor(private readonly profileRepository: CyclistProfileRepository) {}

  async execute(input: UpdateProfileInput): Promise<CyclistProfile> {
    const { userId, ftp, weightKg, hoursPerWeek, goal, experience } = input

    let profile = await this.profileRepository.findByUserId(userId)

    if (profile) {
      if (ftp !== undefined)          profile.ftp = ftp
      if (weightKg !== undefined)     profile.weightKg = weightKg
      if (hoursPerWeek !== undefined) profile.hoursPerWeek = hoursPerWeek
      if (goal !== undefined)         profile.goal = goal
      if (experience !== undefined)   profile.experience = experience
      profile.updatedAt = new Date().toISOString()
    } else {
      profile = CyclistProfile.create({ userId, ftp, weightKg, hoursPerWeek, goal, experience })
    }

    await this.profileRepository.save(profile)
    return profile
  }
}
