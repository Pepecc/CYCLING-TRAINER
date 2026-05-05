import { APIMessage } from './Message'
import { AgentTool } from './AgentTool'

// Port for AI provider — swap the adapter to change the underlying model
export interface AIPort {
  complete(
    systemPrompt: string,
    messages: APIMessage[],
    tools?: AgentTool[]
  ): Promise<string>
}
