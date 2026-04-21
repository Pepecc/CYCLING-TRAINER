import Database from 'better-sqlite3'
import { Conversation } from '../../domain/chat/Conversation'
import { Message, MessageRole } from '../../domain/chat/Message'
import { ConversationRepository } from '../../domain/chat/ConversationRepository'

interface ConversationRow {
  id: string
  user_id: string
  title: string
  created_at: string
}

interface MessageRow {
  id: string
  conversation_id: string
  role: MessageRole
  content: string
  created_at: string
}

export class SqliteConversationRepository implements ConversationRepository {
  constructor(private readonly db: Database.Database) {}

  async findById(id: string): Promise<Conversation | null> {
    const row = this.db
      .prepare('SELECT * FROM conversations WHERE id = ?')
      .get(id) as ConversationRow | undefined
    if (!row) return null

    const messageRows = this.db
      .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
      .all(id) as MessageRow[]

    const conversation = this.toEntity(row)
    conversation.messages = messageRows.map(m => this.toMessageEntity(m))
    return conversation
  }

  async findByUserId(userId: string): Promise<Conversation[]> {
    const rows = this.db
      .prepare('SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at DESC')
      .all(userId) as ConversationRow[]
    return rows.map(r => this.toEntity(r))
  }

  async save(conversation: Conversation): Promise<void> {
    this.db.prepare(`
      INSERT INTO conversations (id, user_id, title, created_at)
      VALUES (@id, @userId, @title, @createdAt)
      ON CONFLICT(id) DO UPDATE SET title = excluded.title
    `).run({ id: conversation.id, userId: conversation.userId, title: conversation.title, createdAt: conversation.createdAt })
  }

  async saveMessage(message: Message): Promise<void> {
    this.db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, created_at)
      VALUES (@id, @conversationId, @role, @content, @createdAt)
    `).run({
      id: message.id,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt,
    })
  }

  private toEntity(row: ConversationRow): Conversation {
    return new Conversation({ id: row.id, userId: row.user_id, title: row.title, createdAt: row.created_at })
  }

  private toMessageEntity(row: MessageRow): Message {
    return new Message({ id: row.id, conversationId: row.conversation_id, role: row.role, content: row.content, createdAt: row.created_at })
  }
}
