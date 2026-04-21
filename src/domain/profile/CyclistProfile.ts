export type Experience = 'beginner' | 'intermediate' | 'advanced'

export interface PowerZone {
  name: string
  min: number
  max: number | null
}

export interface PowerZones {
  z1: PowerZone
  z2: PowerZone
  z3: PowerZone
  z4: PowerZone
  z5: PowerZone
  z6: PowerZone
  z7: PowerZone
}

export interface CyclistProfileProps {
  userId: string
  ftp: number | null
  weightKg: number | null
  hoursPerWeek: number | null
  goal: string | null
  experience: Experience
  updatedAt: string
}

export class CyclistProfile {
  readonly userId: string
  ftp: number | null
  weightKg: number | null
  hoursPerWeek: number | null
  goal: string | null
  experience: Experience
  updatedAt: string

  constructor(props: CyclistProfileProps) {
    this.userId = props.userId
    this.ftp = props.ftp
    this.weightKg = props.weightKg
    this.hoursPerWeek = props.hoursPerWeek
    this.goal = props.goal
    this.experience = props.experience
    this.updatedAt = props.updatedAt
  }

  static create(params: {
    userId: string
    ftp?: number | null
    weightKg?: number | null
    hoursPerWeek?: number | null
    goal?: string | null
    experience?: Experience
  }): CyclistProfile {
    return new CyclistProfile({
      userId: params.userId,
      ftp: params.ftp ?? null,
      weightKg: params.weightKg ?? null,
      hoursPerWeek: params.hoursPerWeek ?? null,
      goal: params.goal ?? null,
      experience: params.experience ?? 'intermediate',
      updatedAt: new Date().toISOString(),
    })
  }

  get wattsPerKg(): number | null {
    if (!this.ftp || !this.weightKg) return null
    return Math.round((this.ftp / this.weightKg) * 100) / 100
  }

  // Coggan 7-zone model
  get powerZones(): PowerZones | null {
    if (!this.ftp) return null
    const f = this.ftp
    return {
      z1: { name: 'Recuperación activa',    min: 0,                      max: Math.round(f * 0.55) },
      z2: { name: 'Resistencia',            min: Math.round(f * 0.56),   max: Math.round(f * 0.75) },
      z3: { name: 'Tempo',                  min: Math.round(f * 0.76),   max: Math.round(f * 0.90) },
      z4: { name: 'Umbral láctico',         min: Math.round(f * 0.91),   max: Math.round(f * 1.05) },
      z5: { name: 'VO2max',                 min: Math.round(f * 1.06),   max: Math.round(f * 1.20) },
      z6: { name: 'Capacidad anaeróbica',   min: Math.round(f * 1.21),   max: Math.round(f * 1.50) },
      z7: { name: 'Potencia neuromuscular', min: Math.round(f * 1.51),   max: null },
    }
  }

  isComplete(): boolean {
    return !!(this.ftp && this.weightKg && this.hoursPerWeek && this.goal)
  }
}
