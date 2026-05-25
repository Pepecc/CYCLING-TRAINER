import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

import { SqliteUserRepository } from '../infrastructure/persistence/SqliteUserRepository'
import { SqliteProfileRepository } from '../infrastructure/persistence/SqliteProfileRepository'
import { SqliteConversationRepository } from '../infrastructure/persistence/SqliteConversationRepository'
import { SqliteWahooTokenRepository } from '../infrastructure/persistence/SqliteWahooTokenRepository'
import { OpenAIAdapter } from '../infrastructure/ai/OpenAIAdapter'
import { WahooOAuthService } from '../infrastructure/wahoo/WahooOAuthService'
import { configureAuth } from '../infrastructure/http/middleware/auth'

import { UpdateProfile } from '../application/profile/UpdateProfile'
import { GetProfile } from '../application/profile/GetProfile'
import { SendMessage } from '../application/chat/SendMessage'
import { GetConversations } from '../application/chat/GetConversations'
import { GetConversation } from '../application/chat/GetConversation'
import { GetWahooWorkouts } from '../application/wahoo/GetWahooWorkouts'
import { AnalyzeWahooWorkout } from '../application/wahoo/AnalyzeWahooWorkout'
import { ToolExecutor } from '../infrastructure/ai/tools/ToolExecutor'

export interface Container {
  updateProfile:       UpdateProfile
  getProfile:          GetProfile
  sendMessage:         SendMessage
  getConversations:    GetConversations
  getConversation:     GetConversation
  wahooService:        WahooOAuthService
  getWahooWorkouts:    GetWahooWorkouts
  analyzeWahooWorkout: AnalyzeWahooWorkout
}

export function buildContainer(): Container {
  // --- Database ---
  const dbPath = process.env.DB_PATH ?? './data/cycling_coach.db'
  const dbDir = path.dirname(dbPath)
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // --- Schema ---
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         TEXT PRIMARY KEY,
      email      TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cyclist_profiles (
      user_id        TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      ftp            INTEGER,
      weight_kg      REAL,
      hours_per_week REAL,
      goal           TEXT,
      experience     TEXT DEFAULT 'intermediate',
      updated_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title      TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role            TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content         TEXT NOT NULL,
      created_at      TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS wahoo_tokens (
      user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      access_token  TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at    TEXT NOT NULL,
      created_at    TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_conversations_user    ON conversations(user_id, created_at);
  `)

  // --- Migration: eliminate password_hash column (legacy schema before Firebase auth) ---
  try {
    const tableInfo = db.prepare("PRAGMA table_info('users')").all() as Array<{ name: string }>
    const hasPasswordHash = tableInfo.some(col => col.name === 'password_hash')
    if (hasPasswordHash) {
      db.pragma('foreign_keys = OFF')
      db.exec(`
        CREATE TABLE users_new (
          id         TEXT PRIMARY KEY,
          email      TEXT UNIQUE NOT NULL,
          created_at TEXT NOT NULL
        );
        INSERT INTO users_new (id, email, created_at)
          SELECT id, email, created_at FROM users;
        DROP TABLE users;
        ALTER TABLE users_new RENAME TO users;
      `)
      db.pragma('foreign_keys = ON')
      console.log('✓ DB migration: users table migrated to Firebase-compatible schema')
    }
  } catch (err) {
    console.error('DB migration error:', err)
  }

  // --- Repositories ---
  const userRepository         = new SqliteUserRepository(db)
  const profileRepository      = new SqliteProfileRepository(db)
  const conversationRepository = new SqliteConversationRepository(db)
  const wahooTokenRepository   = new SqliteWahooTokenRepository(db)

  // --- Configure Firebase auth middleware ---
  configureAuth(userRepository)

  // --- External services ---
  const aiPort       = new OpenAIAdapter()
  const wahooService = new WahooOAuthService(wahooTokenRepository)
  const toolExecutor = new ToolExecutor(wahooService, profileRepository)

  // --- Use cases ---
  const sendMessage = new SendMessage(conversationRepository, profileRepository, aiPort, toolExecutor)

  return {
    updateProfile:       new UpdateProfile(profileRepository),
    getProfile:          new GetProfile(profileRepository),
    sendMessage,
    getConversations:    new GetConversations(conversationRepository),
    getConversation:     new GetConversation(conversationRepository),
    wahooService,
    getWahooWorkouts:    new GetWahooWorkouts(wahooService),
    analyzeWahooWorkout: new AnalyzeWahooWorkout(wahooService, profileRepository),
  }
}
