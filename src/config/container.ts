import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

import { SqliteUserRepository } from '../infrastructure/persistence/SqliteUserRepository'
import { SqliteProfileRepository } from '../infrastructure/persistence/SqliteProfileRepository'
import { SqliteConversationRepository } from '../infrastructure/persistence/SqliteConversationRepository'
// import { ClaudeAdapter } from '../infrastructure/ai/ClaudeAdapter'
import { OpenAIAdapter } from '../infrastructure/ai/OpenAIAdapter'

import { RegisterUser } from '../application/auth/RegisterUser'
import { LoginUser } from '../application/auth/LoginUser'
import { UpdateProfile } from '../application/profile/UpdateProfile'
import { GetProfile } from '../application/profile/GetProfile'
import { SendMessage } from '../application/chat/SendMessage'
import { GetConversations } from '../application/chat/GetConversations'
import { GetConversation } from '../application/chat/GetConversation'

export interface Container {
  registerUser: RegisterUser
  loginUser: LoginUser
  updateProfile: UpdateProfile
  getProfile: GetProfile
  sendMessage: SendMessage
  getConversations: GetConversations
  getConversation: GetConversation
}

export function buildContainer(): Container {
  // --- Database ---
  const dbPath = process.env.DB_PATH ?? './data/cycling_coach.db'
  const dbDir = path.dirname(dbPath)
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at    TEXT NOT NULL
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

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, created_at);
  `)

  // --- Repositories ---
  const userRepository = new SqliteUserRepository(db)
  const profileRepository = new SqliteProfileRepository(db)
  const conversationRepository = new SqliteConversationRepository(db)

  // --- AI adapter ---
  const aiPort = new OpenAIAdapter()

  // --- Use cases ---
  return {
    registerUser:     new RegisterUser(userRepository),
    loginUser:        new LoginUser(userRepository),
    updateProfile:    new UpdateProfile(profileRepository),
    getProfile:       new GetProfile(profileRepository),
    sendMessage:      new SendMessage(conversationRepository, profileRepository, aiPort),
    getConversations: new GetConversations(conversationRepository),
    getConversation:  new GetConversation(conversationRepository),
  }
}
