import Database from 'better-sqlite3'
import { CyclistProfile, Experience } from '../../domain/profile/CyclistProfile'
import { CyclistProfileRepository } from '../../domain/profile/CyclistProfileRepository'

interface ProfileRow {
  user_id: string
  ftp: number | null
  weight_kg: number | null
  hours_per_week: number | null
  goal: string | null
  experience: Experience
  updated_at: string
}

export class SqliteProfileRepository implements CyclistProfileRepository {
  constructor(private readonly db: Database.Database) {}

  async findByUserId(userId: string): Promise<CyclistProfile | null> {
    const row = this.db
      .prepare('SELECT * FROM cyclist_profiles WHERE user_id = ?')
      .get(userId) as ProfileRow | undefined
    return row ? this.toEntity(row) : null
  }

  async save(profile: CyclistProfile): Promise<void> {
    this.db.prepare(`
      INSERT INTO cyclist_profiles
        (user_id, ftp, weight_kg, hours_per_week, goal, experience, updated_at)
      VALUES
        (@userId, @ftp, @weightKg, @hoursPerWeek, @goal, @experience, @updatedAt)
      ON CONFLICT(user_id) DO UPDATE SET
        ftp            = excluded.ftp,
        weight_kg      = excluded.weight_kg,
        hours_per_week = excluded.hours_per_week,
        goal           = excluded.goal,
        experience     = excluded.experience,
        updated_at     = excluded.updated_at
    `).run({
      userId: profile.userId,
      ftp: profile.ftp,
      weightKg: profile.weightKg,
      hoursPerWeek: profile.hoursPerWeek,
      goal: profile.goal,
      experience: profile.experience,
      updatedAt: profile.updatedAt,
    })
  }

  private toEntity(row: ProfileRow): CyclistProfile {
    return new CyclistProfile({
      userId: row.user_id,
      ftp: row.ftp,
      weightKg: row.weight_kg,
      hoursPerWeek: row.hours_per_week,
      goal: row.goal,
      experience: row.experience,
      updatedAt: row.updated_at,
    })
  }
}
