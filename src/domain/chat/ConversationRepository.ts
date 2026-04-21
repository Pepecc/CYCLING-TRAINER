import { Conversation } from './Conversation'
import { Message } from './Message'

export interface ConversationRepository {
  findById(id: string): Promise<Conversation | null>
  findByUserId(userId: string): Promise<Conversation[]>
  save(conversation: Conversation): Promise<void>
  saveMessage(message: Message): Promise<void>
}
