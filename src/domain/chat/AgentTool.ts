// Tipos que representan las tool definitions que se pasan a OpenAI

export interface AgentToolParameter {
  type: string
  description: string
  enum?: string[]
}

export interface AgentToolFunction {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, AgentToolParameter>
    required?: string[]
  }
}

export interface AgentTool {
  type: 'function'
  function: AgentToolFunction
}

// Resultado de ejecutar una tool — se devuelve a OpenAI como tool_result
export interface ToolResult {
  toolCallId: string
  content: string   // JSON serializado con los datos
}
