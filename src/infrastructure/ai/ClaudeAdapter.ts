import Anthropic from '@anthropic-ai/sdk'
import { AIPort } from '../../domain/chat/AIPort'
import { APIMessage } from '../../domain/chat/Message'

export class ClaudeAdapter implements AIPort {
  private readonly client: Anthropic
  private readonly model = 'claude-sonnet-4-5'
  private readonly maxTokens = 1024

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }

  async complete(systemPrompt: string, messages: APIMessage[]): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      system: systemPrompt,
      messages,
    })

    const block = response.content[0]
    if (block.type !== 'text') throw new Error('Unexpected response type from Claude')
    return block.text
  }
}
