import { WahooOAuthService } from '../../infrastructure/wahoo/WahooOAuthService'
import { WahooWorkout } from '../../domain/wahoo/WahooWorkout'

export class GetWahooWorkouts {
  constructor(private readonly wahooService: WahooOAuthService) {}

  async execute(userId: string, page = 1, perPage = 10): Promise<WahooWorkout[]> {
    return this.wahooService.getWorkouts(userId, page, perPage)
  }
}
