import Database from 'better-sqlite3'
import { User } from '../../domain/user/User'
import { UserRepository } from '../../domain/user/UserRepository'

interface UserRow {
  id: string
  email: string
  password_hash: string
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
      INSERT INTO users (id, email, password_hash, created_at)
      VALUES (@id, @email, @passwordHash, @createdAt)
      ON CONFLICT(id) DO UPDATE SET
        email         = excluded.email,
        password_hash = excluded.password_hash
    `).run({ id: user.id, email: user.email, passwordHash: user.passwordHash, createdAt: user.createdAt })
  }

  private toEntity(row: UserRow): User {
    return new User({
      id: row.id,
      email: row.email,
      passwordHash: row.password_hash,
      createdAt: row.created_at,
    })
  }
}
