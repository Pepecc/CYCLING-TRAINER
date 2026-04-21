import { Conversation } from '../../domain/chat/Conversation'
import { ConversationRepository } from '../../domain/chat/ConversationRepository'

export class GetConversations {
  constructor(private readonly conversationRepository: ConversationRepository) {}

  async execute(userId: string): Promise<Conversation[]> {
    return this.conversationRepository.findByUserId(userId)
  }
}
