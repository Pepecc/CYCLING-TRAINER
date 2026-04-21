import { randomUUID } from 'crypto'
import { Message, APIMessage } from './Message'

export interface ConversationProps {
  id: string
  userId: string
  title: string
  createdAt: string
  messages?: Message[]
}

export class Conversation {
  readonly id: string
  readonly userId: string
  title: string
  readonly createdAt: string
  messages: Message[]

  constructor(props: ConversationProps) {
    this.id = props.id
    this.userId = props.userId
    this.title = props.title
    this.createdAt = props.createdAt
    this.messages = props.messages ?? []
  }

  static create(params: { userId: string; title?: string }): Conversation {
    return new Conversation({
      id: randomUUID(),
      userId: params.userId,
      title: params.title ?? `Sesión ${new Date().toLocaleDateString('es-ES')}`,
      createdAt: new Date().toISOString(),
      messages: [],
    })
  }

  addMessage(message: Message): void {
    this.messages.push(message)
  }

  // Returns last N messages to avoid overflowing the context window
  getContextMessages(limit = 20): APIMessage[] {
    return this.messages.slice(-limit).map(m => m.toAPIFormat())
  }
}
