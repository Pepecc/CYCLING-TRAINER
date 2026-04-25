import { WahooToken } from '../../domain/wahoo/WahooToken'
import { WahooWorkout } from '../../domain/wahoo/WahooWorkout'
import { WahooTokenRepository } from '../../domain/wahoo/WahooTokenRepository'

const WAHOO_BASE_URL = 'https://api.wahooligan.com'

// Raw shapes returned by Wahoo API
interface WahooTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
}

interface WahooWorkoutSummaryRaw {
  duration_in_seconds: string | null
  distance_in_meters: string | null
  calories: string | null
  heart_rate_avg: string | null
  heart_rate_max: string | null
  power_avg: string | null
  power_max: string | null
  cadence_avg: string | null
  normalized_power: string | null
  tss: string | null
  intensity_factor: string | null
}

interface WahooWorkoutRaw {
  id: number
  name: string
  starts: string
  minutes: number
  workout_type_location_name: string
  workout_summary: WahooWorkoutSummaryRaw | null
}

interface WahooWorkoutsResponse {
  workouts: WahooWorkoutRaw[]
  total: number
  page: number
  per_page: number
  order: string
}

export class WahooOAuthService {
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly redirectUri: string

  constructor(private readonly tokenRepository: WahooTokenRepository) {
    this.clientId = process.env.WAHOO_CLIENT_ID ?? ''
    this.clientSecret = process.env.WAHOO_CLIENT_SECRET ?? ''
    this.redirectUri = process.env.WAHOO_REDIRECT_URI ?? ''

    if (!this.clientId || !this.clientSecret || !this.redirectUri) {
      console.warn('⚠️  Wahoo OAuth credentials not configured — integration disabled')
    }
  }

  // ─── Step 1: Build the authorization URL ────────────────────────────────────

  buildAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'user_read workouts_read offline_data',
      response_type: 'code',
      state,
    })
    return `${WAHOO_BASE_URL}/oauth/authorize?${params.toString()}`
  }

  // ─── Step 2: Exchange code for tokens ───────────────────────────────────────

  async exchangeCode(userId: string, code: string): Promise<WahooToken> {
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      code,
      redirect_uri: this.redirectUri,
      grant_type: 'authorization_code',
    })

    const res = await fetch(`${WAHOO_BASE_URL}/oauth/token?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Wahoo token exchange failed: ${res.status} ${body}`)
    }

    const data = await res.json() as WahooTokenResponse
    const token = WahooToken.create({
      userId,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    })

    await this.tokenRepository.save(token)
    return token
  }

  // ─── Token refresh ───────────────────────────────────────────────────────────

  async refreshToken(userId: string): Promise<WahooToken> {
    const existing = await this.tokenRepository.findByUserId(userId)
    if (!existing) throw new Error('No Wahoo token found for user')

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: existing.refreshToken,
      grant_type: 'refresh_token',
    })

    const res = await fetch(`${WAHOO_BASE_URL}/oauth/token?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Wahoo token refresh failed: ${res.status} ${body}`)
    }

    const data = await res.json() as WahooTokenResponse
    existing.accessToken = data.access_token
    existing.refreshToken = data.refresh_token
    existing.expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()

    await this.tokenRepository.save(existing)
    return existing
  }

  // ─── Get valid token (auto-refresh if needed) ────────────────────────────────

  async getValidToken(userId: string): Promise<WahooToken> {
    const token = await this.tokenRepository.findByUserId(userId)
    if (!token) throw new Error('Usuario no conectado a Wahoo')

    if (token.isExpired()) {
      return this.refreshToken(userId)
    }

    return token
  }

  // ─── Fetch recent workouts ───────────────────────────────────────────────────

  async getWorkouts(userId: string, page = 1, perPage = 10): Promise<WahooWorkout[]> {
    const token = await this.getValidToken(userId)

    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
      order: 'desc',
    })

    const res = await fetch(`${WAHOO_BASE_URL}/v1/workouts?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Wahoo workouts fetch failed: ${res.status} ${body}`)
    }

    const data = await res.json() as WahooWorkoutsResponse
    return data.workouts.map(w => this.mapWorkout(w))
  }

  // ─── Fetch single workout with summary ──────────────────────────────────────

  async getWorkoutWithSummary(userId: string, workoutId: number): Promise<WahooWorkout> {
    const token = await this.getValidToken(userId)

    const res = await fetch(`${WAHOO_BASE_URL}/v1/workouts/${workoutId}/workout_summary`, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Wahoo workout summary fetch failed: ${res.status} ${body}`)
    }

    const workout = await res.json() as WahooWorkoutRaw
    return this.mapWorkout(workout)
  }

  // ─── Check if user has connected Wahoo ──────────────────────────────────────

  async isConnected(userId: string): Promise<boolean> {
    const token = await this.tokenRepository.findByUserId(userId)
    return token !== null
  }

  // ─── Disconnect (revoke tokens) ──────────────────────────────────────────────

  async disconnect(userId: string): Promise<void> {
    await this.tokenRepository.deleteByUserId(userId)
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private mapWorkout(raw: WahooWorkoutRaw): WahooWorkout {
    const s = raw.workout_summary

    return {
      id: raw.id,
      name: raw.name ?? 'Entrenamiento',
      startedAt: raw.starts,
      durationMinutes: raw.minutes,
      workoutTypeLocationName: raw.workout_type_location_name ?? 'unknown',
      summary: s ? {
        durationInSeconds: s.duration_in_seconds ? Number(s.duration_in_seconds) : null,
        distanceInMeters:  s.distance_in_meters  ? Number(s.distance_in_meters)  : null,
        calories:          s.calories            ? Number(s.calories)            : null,
        heartRateAvg:      s.heart_rate_avg      ? Number(s.heart_rate_avg)      : null,
        heartRateMax:      s.heart_rate_max      ? Number(s.heart_rate_max)      : null,
        powerAvg:          s.power_avg           ? Number(s.power_avg)           : null,
        powerMax:          s.power_max           ? Number(s.power_max)           : null,
        cadenceAvg:        s.cadence_avg         ? Number(s.cadence_avg)         : null,
        normalizedPower:   s.normalized_power    ? Number(s.normalized_power)    : null,
        tss:               s.tss                 ? Number(s.tss)                 : null,
        intensityFactor:   s.intensity_factor    ? Number(s.intensity_factor)    : null,
      } : null,
    }
  }
}
