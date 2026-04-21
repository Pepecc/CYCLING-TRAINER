import { randomUUID } from 'crypto'

export type MessageRole = 'user' | 'assistant'

export interface MessageProps {
  id: string
  conversationId: string
  role: MessageRole
  content: string
  createdAt: string
}

export interface APIMessage {
  role: MessageRole
  content: string
}

export class Message {
  readonly id: string
  readonly conversationId: string
  readonly role: MessageRole
  readonly content: string
  readonly createdAt: string

  constructor(props: MessageProps) {
    this.id = props.id
    this.conversationId = props.conversationId
    this.role = props.role
    this.content = props.content
    this.createdAt = props.createdAt
  }

  static create(params: {
    conversationId: string
    role: MessageRole
    content: string
  }): Message {
    return new Message({
      id: randomUUID(),
      conversationId: params.conversationId,
      role: params.role,
      content: params.content,
      createdAt: new Date().toISOString(),
    })
  }

  toAPIFormat(): APIMessage {
    return { role: this.role, content: this.content }
  }
}
