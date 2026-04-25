// Value object que representa el resumen de un workout de Wahoo
// Campos basados en la Wahoo Cloud API workout_summary endpoint

export interface WahooWorkoutSummaryData {
  durationInSeconds: number | null
  distanceInMeters: number | null
  calories: number | null
  heartRateAvg: number | null
  heartRateMax: number | null
  powerAvg: number | null
  powerMax: number | null
  cadenceAvg: number | null
  normalizedPower: number | null
  tss: number | null               // Training Stress Score
  intensityFactor: number | null   // IF = NP / FTP
}

export interface WahooWorkout {
  id: number
  name: string
  startedAt: string                // ISO date
  durationMinutes: number
  workoutTypeLocationName: string  // 'indoor' | 'outdoor' | 'virtual'
  summary: WahooWorkoutSummaryData | null
}
