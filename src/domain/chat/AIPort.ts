import { APIMessage } from './Message'

// Port for AI provider — swap the adapter to change the underlying model
export interface AIPort {
  complete(systemPrompt: string, messages: APIMessage[]): Promise<string>
}
