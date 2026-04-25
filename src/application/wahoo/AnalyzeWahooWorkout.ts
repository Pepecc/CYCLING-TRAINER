import { WahooOAuthService } from '../../infrastructure/wahoo/WahooOAuthService'
import { CyclistProfileRepository } from '../../domain/profile/CyclistProfileRepository'
import { WahooWorkout } from '../../domain/wahoo/WahooWorkout'
import { CyclistProfile } from '../../domain/profile/CyclistProfile'

interface AnalyzeWorkoutInput {
  userId: string
  workoutId: number
}

interface AnalyzeWorkoutOutput {
  workout: WahooWorkout
  analysisContext: string   // texto listo para inyectar en el prompt del asistente
}

export class AnalyzeWahooWorkout {
  constructor(
    private readonly wahooService: WahooOAuthService,
    private readonly profileRepository: CyclistProfileRepository
  ) {}

  async execute({ userId, workoutId }: AnalyzeWorkoutInput): Promise<AnalyzeWorkoutOutput> {
    const [workout, profile] = await Promise.all([
      this.wahooService.getWorkoutWithSummary(userId, workoutId),
      this.profileRepository.findByUserId(userId),
    ])

    const analysisContext = this.buildAnalysisContext(workout, profile)
    return { workout, analysisContext }
  }

  private buildAnalysisContext(workout: WahooWorkout, profile: CyclistProfile | null): string {
    const s = workout.summary
    const date = new Date(workout.startedAt).toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long',
    })

    const lines: string[] = [
      `ENTRENO A ANALIZAR (datos de Wahoo):`,
      `- Nombre: ${workout.name}`,
      `- Fecha: ${date}`,
      `- Tipo: ${workout.workoutTypeLocationName}`,
      `- Duración: ${workout.durationMinutes} min`,
    ]

    if (s) {
      if (s.distanceInMeters)  lines.push(`- Distancia: ${(s.distanceInMeters / 1000).toFixed(1)} km`)
      if (s.powerAvg)          lines.push(`- Potencia media: ${s.powerAvg}w`)
      if (s.normalizedPower)   lines.push(`- Potencia normalizada (NP): ${s.normalizedPower}w`)
      if (s.powerMax)          lines.push(`- Potencia máxima: ${s.powerMax}w`)
      if (s.heartRateAvg)      lines.push(`- FC media: ${s.heartRateAvg} ppm`)
      if (s.heartRateMax)      lines.push(`- FC máxima: ${s.heartRateMax} ppm`)
      if (s.cadenceAvg)        lines.push(`- Cadencia media: ${s.cadenceAvg} rpm`)
      if (s.calories)          lines.push(`- Calorías: ${s.calories} kcal`)
      if (s.tss)               lines.push(`- TSS: ${s.tss}`)
      if (s.intensityFactor)   lines.push(`- IF: ${s.intensityFactor}`)

      // Classify NP in user's power zones if profile has FTP
      if (s.normalizedPower && profile?.ftp && profile.powerZones) {
        const zone = this.classifyPower(s.normalizedPower, profile.ftp)
        if (zone) lines.push(`- Zona predominante (por NP): ${zone}`)
      }
    }

    lines.push(`\nAnaliza este entrenamiento en detalle. Ten en cuenta el perfil del ciclista y sus zonas de potencia. Comenta la distribución de intensidad, la carga (TSS), y da recomendaciones concretas para el próximo entrenamiento.`)

    return lines.join('\n')
  }

  private classifyPower(power: number, ftp: number): string | null {
    const ratio = power / ftp
    if (ratio < 0.55) return 'Z1 — Recuperación activa'
    if (ratio < 0.75) return 'Z2 — Resistencia'
    if (ratio < 0.90) return 'Z3 — Tempo'
    if (ratio < 1.05) return 'Z4 — Umbral láctico'
    if (ratio < 1.20) return 'Z5 — VO2max'
    if (ratio < 1.50) return 'Z6 — Capacidad anaeróbica'
    return 'Z7 — Potencia neuromuscular'
  }
}
