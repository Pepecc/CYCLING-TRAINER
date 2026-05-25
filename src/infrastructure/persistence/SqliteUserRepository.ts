import Database from 'better-sqlite3'
import { User } from '../../domain/user/User'
import { UserRepository } from '../../domain/user/UserRepository'

interface UserRow {
  id: string
  email: string
  created_at: string
}

export class SqliteUserRepository implements UserRepository {
  constructor(private readonly db: Database.Database) {}

  async findById(id: string): Promise<User | null> {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
    return row ? this.toEntity(row) : null
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined
    return row ? this.toEntity(row) : null
  }

  async save(user: User): Promise<void> {
    this.db.prepare(`
      INSERT INTO users (id, email, created_at)
      VALUES (@id, @email, @createdAt)
      ON CONFLICT(id) DO UPDATE SET email = excluded.email
    `).run({ id: user.id, email: user.email, createdAt: user.createdAt })
  }

  async ensureExists(id: string, email: string): Promise<void> {
    this.db.prepare(`
      INSERT OR IGNORE INTO users (id, email, created_at)
      VALUES (?, ?, ?)
    `).run(id, email, new Date().toISOString())
  }

  private toEntity(row: UserRow): User {
    return new User({ id: row.id, email: row.email, createdAt: row.created_at })
  }
}
