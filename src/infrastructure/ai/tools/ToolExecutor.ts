import { WahooOAuthService } from '../../../infrastructure/wahoo/WahooOAuthService'
import { CyclistProfileRepository } from '../../../domain/profile/CyclistProfileRepository'
import { WahooWorkout } from '../../../domain/wahoo/WahooWorkout'

interface WeekBucket {
  weekStart: string
  weekEnd: string
  sessions: number
  tss: number
  hours: number
  npAvg: number | null
}

interface SeasonKpis {
  ctl: number
  atl: number
  tsb: number
  totalHours: number
  totalTss: number
  peakCtl: number
  peakCtlDate: string | null
  workoutsCount: number
}

export class ToolExecutor {
  constructor(
    private readonly wahooService: WahooOAuthService,
    private readonly profileRepository: CyclistProfileRepository
  ) {}

  async execute(userId: string, toolName: string, args: Record<string, unknown>): Promise<string> {
    switch (toolName) {
      case 'get_recent_workouts':
        return this.getRecentWorkouts(userId, args)
      case 'get_block_summary':
        return this.getBlockSummary(userId, args)
      case 'get_season_kpis':
        return this.getSeasonKpis(userId)
      default:
        return JSON.stringify({ error: `Tool desconocida: ${toolName}` })
    }
  }

  // ─── get_recent_workouts ──────────────────────────────────────────────────

  private async getRecentWorkouts(userId: string, args: Record<string, unknown>): Promise<string> {
    const days = (args.days as number) ?? 7
    const limit = (args.limit as number) ?? 5

    const workouts = await this.wahooService.getWorkouts(userId, 1, 20)
    const profile = await this.profileRepository.findByUserId(userId)

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - days)

    const filtered = workouts
      .filter(w => new Date(w.startedAt) >= cutoff)
      .slice(0, limit)

    if (filtered.length === 0) {
      return JSON.stringify({ message: `No hay entrenamientos en los últimos ${days} días.` })
    }

    const result = filtered.map(w => {
      const s = w.summary
      const date = new Date(w.startedAt).toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long',
      })

      const entry: Record<string, unknown> = {
        id: w.id,
        nombre: w.name,
        fecha: date,
        tipo: w.workoutTypeLocationName,
        duracion_min: w.durationMinutes,
      }

      if (s) {
        if (s.powerAvg)        entry.potencia_media_w = s.powerAvg
        if (s.normalizedPower) entry.np_w = s.normalizedPower
        if (s.powerMax)        entry.potencia_max_w = s.powerMax
        if (s.heartRateAvg)    entry.fc_media_ppm = s.heartRateAvg
        if (s.heartRateMax)    entry.fc_max_ppm = s.heartRateMax
        if (s.cadenceAvg)      entry.cadencia_media_rpm = s.cadenceAvg
        if (s.tss)             entry.tss = s.tss
        if (s.intensityFactor) entry.if = s.intensityFactor
        if (s.calories)        entry.calorias = s.calories
        if (s.distanceInMeters) entry.distancia_km = +(s.distanceInMeters / 1000).toFixed(1)

        // Classify NP in power zones if FTP available
        if (s.normalizedPower && profile?.ftp) {
          entry.zona_predominante = this.classifyPower(s.normalizedPower, profile.ftp)
        }
      }

      return entry
    })

    return JSON.stringify({ entrenamientos: result, total: result.length })
  }

  // ─── get_block_summary ────────────────────────────────────────────────────

  private async getBlockSummary(userId: string, args: Record<string, unknown>): Promise<string> {
    const weeks = (args.weeks as number) ?? 6

    // Fetch enough workouts to cover the requested weeks
    const workouts = await this.wahooService.getWorkouts(userId, 1, 50)

    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - weeks * 7)

    const filtered = workouts.filter(w => new Date(w.startedAt) >= cutoff)

    // Group by week (Monday-Sunday)
    const buckets = new Map<string, WahooWorkout[]>()

    filtered.forEach(w => {
      const d = new Date(w.startedAt)
      const monday = this.getMondayOf(d)
      const key = monday.toISOString().split('T')[0]
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key)!.push(w)
    })

    const summary: WeekBucket[] = Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mondayStr, ws]) => {
        const monday = new Date(mondayStr)
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)

        const tss = ws.reduce((acc, w) => acc + (w.summary?.tss ?? 0), 0)
        const hours = ws.reduce((acc, w) => acc + w.durationMinutes / 60, 0)
        const nps = ws.filter(w => w.summary?.normalizedPower).map(w => w.summary!.normalizedPower!)
        const npAvg = nps.length > 0 ? Math.round(nps.reduce((a, b) => a + b, 0) / nps.length) : null

        return {
          weekStart: monday.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
          weekEnd: sunday.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
          sessions: ws.length,
          tss: Math.round(tss),
          hours: +hours.toFixed(1),
          npAvg,
        }
      })

    const totalTss = summary.reduce((acc, w) => acc + w.tss, 0)
    const totalHours = summary.reduce((acc, w) => acc + w.hours, 0)
    const avgTssPerWeek = summary.length > 0 ? Math.round(totalTss / summary.length) : 0

    return JSON.stringify({
      semanas: summary,
      resumen: {
        semanas_analizadas: summary.length,
        tss_total: Math.round(totalTss),
        horas_totales: +totalHours.toFixed(1),
        tss_medio_semanal: avgTssPerWeek,
      },
    })
  }

  // ─── get_season_kpis ──────────────────────────────────────────────────────

  private async getSeasonKpis(userId: string): Promise<string> {
    // Fetch last 90 days to calculate CTL (42d) and ATL (7d)
    const workouts = await this.wahooService.getWorkouts(userId, 1, 100)

    const now = new Date()
    const seasonStart = new Date(now.getFullYear(), 0, 1) // Jan 1st current year

    const seasonWorkouts = workouts.filter(w => new Date(w.startedAt) >= seasonStart)

    // Sort chronologically for CTL/ATL calculation
    const sorted = [...seasonWorkouts].sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    )

    // CTL = 42-day exponential weighted average of TSS
    // ATL = 7-day exponential weighted average of TSS
    const ctlDecay = 1 - Math.exp(-1 / 42)
    const atlDecay = 1 - Math.exp(-1 / 7)

    let ctl = 0
    let atl = 0
    let peakCtl = 0
    let peakCtlDate: string | null = null

    // Build daily TSS map
    const dailyTss = new Map<string, number>()
    sorted.forEach(w => {
      const day = w.startedAt.split('T')[0]
      dailyTss.set(day, (dailyTss.get(day) ?? 0) + (w.summary?.tss ?? 0))
    })

    // Iterate day by day from season start to today
    const cursor = new Date(seasonStart)
    while (cursor <= now) {
      const key = cursor.toISOString().split('T')[0]
      const tss = dailyTss.get(key) ?? 0

      ctl = ctl + ctlDecay * (tss - ctl)
      atl = atl + atlDecay * (tss - atl)

      if (ctl > peakCtl) {
        peakCtl = ctl
        peakCtlDate = cursor.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
      }

      cursor.setDate(cursor.getDate() + 1)
    }

    const tsb = ctl - atl
    const totalTss = seasonWorkouts.reduce((acc, w) => acc + (w.summary?.tss ?? 0), 0)
    const totalHours = seasonWorkouts.reduce((acc, w) => acc + w.durationMinutes / 60, 0)

    const kpis: SeasonKpis = {
      ctl: Math.round(ctl),
      atl: Math.round(atl),
      tsb: Math.round(tsb),
      totalHours: +totalHours.toFixed(1),
      totalTss: Math.round(totalTss),
      peakCtl: Math.round(peakCtl),
      peakCtlDate,
      workoutsCount: seasonWorkouts.length,
    }

    const interpretation = this.interpretTsb(tsb)

    return JSON.stringify({ kpis, interpretacion_tsb: interpretation })
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private getMondayOf(date: Date): Date {
    const d = new Date(date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    d.setHours(0, 0, 0, 0)
    return d
  }

  private classifyPower(power: number, ftp: number): string {
    const ratio = power / ftp
    if (ratio < 0.55) return 'Z1 — Recuperación activa'
    if (ratio < 0.75) return 'Z2 — Resistencia'
    if (ratio < 0.90) return 'Z3 — Tempo'
    if (ratio < 1.05) return 'Z4 — Umbral láctico'
    if (ratio < 1.20) return 'Z5 — VO2max'
    if (ratio < 1.50) return 'Z6 — Capacidad anaeróbica'
    return 'Z7 — Potencia neuromuscular'
  }

  private interpretTsb(tsb: number): string {
    if (tsb > 25)  return 'Forma pico — fresco y listo para competir'
    if (tsb > 10)  return 'Buena forma — descansado, buen momento para esfuerzos duros'
    if (tsb > -10) return 'En forma estable — equilibrio carga/recuperación'
    if (tsb > -20) return 'En carga — algo de fatiga acumulada, normal en bloque de trabajo'
    if (tsb > -30) return 'Carga alta — monitorizar recuperación, evitar esfuerzos máximos'
    return 'Sobreentrenamiento — recuperación urgente necesaria'
  }
}
