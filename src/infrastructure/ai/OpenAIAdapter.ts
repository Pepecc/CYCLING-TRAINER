import OpenAI from 'openai'
import { AIPort } from '../../domain/chat/AIPort'
import { APIMessage } from '../../domain/chat/Message'

export class OpenAIAdapter implements AIPort {
  private readonly client: OpenAI
  private readonly model: string
  private readonly maxTokens = 1024

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    this.model = process.env.OPENAI_MODEL ?? 'gpt-4o'
  }

  async complete(systemPrompt: string, messages: APIMessage[]): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('Empty response from OpenAI')
    return content
  }
}
