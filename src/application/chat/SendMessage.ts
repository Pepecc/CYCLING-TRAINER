import { Conversation } from '../../domain/chat/Conversation'
import { Message } from '../../domain/chat/Message'
import { ConversationRepository } from '../../domain/chat/ConversationRepository'
import { CyclistProfileRepository } from '../../domain/profile/CyclistProfileRepository'
import { CyclistProfile } from '../../domain/profile/CyclistProfile'
import { AIPort } from '../../domain/chat/AIPort'
import { ToolExecutor } from '../../infrastructure/ai/tools/ToolExecutor'
import { toolDefinitions } from '../../infrastructure/ai/tools/ToolDefinitions'
import { OpenAIAdapter } from '../../infrastructure/ai/OpenAIAdapter'

import fs from 'fs';
import path from 'path'; 

const basePrompt = fs.readFileSync(
  path.join(__dirname, '../../infrastructure/ai/prompts/coach.md'),
  'utf-8'
)

interface SendMessageInput {
  userId: string
  content: string
  conversationId?: string | null
}

interface SendMessageOutput {
  conversationId: string
  message: Message
}

export class SendMessage {
  constructor(
    private readonly conversationRepository: ConversationRepository,
    private readonly profileRepository: CyclistProfileRepository,
    private readonly aiPort: AIPort,
    private readonly toolExecutor: ToolExecutor | null = null
  ) {}

  async execute({ userId, content, conversationId }: SendMessageInput): Promise<SendMessageOutput> {
    if (!content.trim()) throw new Error('El mensaje no puede estar vacío')

    // Load or create conversation
    let conversation: Conversation
    if (conversationId) {
      const found = await this.conversationRepository.findById(conversationId)
      if (!found || found.userId !== userId) throw new Error('Conversación no encontrada')
      conversation = found
    } else {
      conversation = Conversation.create({ userId, title: content.slice(0, 50) })
      await this.conversationRepository.save(conversation)
    }

    const profile = await this.profileRepository.findByUserId(userId)
    const systemPrompt = this.buildSystemPrompt(profile)

    // Persist user message
    const userMessage = Message.create({
      conversationId: conversation.id,
      role: 'user',
      content: content.trim(),
    })
    await this.conversationRepository.saveMessage(userMessage)
    conversation.addMessage(userMessage)

    // Wire tool executor with the current userId before calling AI
    if (this.toolExecutor && this.aiPort instanceof OpenAIAdapter) {
      this.aiPort.setToolExecutor((toolName, args) =>
        this.toolExecutor!.execute(userId, toolName, args)
      )
    }

    // Call AI — pass tools only if executor is available
    const contextMessages = conversation.getContextMessages(20)
    const tools = this.toolExecutor ? toolDefinitions : undefined
    const assistantContent = await this.aiPort.complete(systemPrompt, contextMessages, tools)

    // Persist assistant response
    const assistantMessage = Message.create({
      conversationId: conversation.id,
      role: 'assistant',
      content: assistantContent,
    })
    await this.conversationRepository.saveMessage(assistantMessage)

    return { conversationId: conversation.id, message: assistantMessage }
  }

  private buildSystemPrompt(profile: CyclistProfile | null): string {
    if (!profile || !profile.isComplete()) {
      return `${basePrompt}

CONTEXTO DEL USUARIO:
El ciclista aún no ha completado su perfil. En tu primera respuesta preséntate brevemente
y pídele los datos básicos: FTP actual (o estimación), peso, horas semanales disponibles
para entrenar y objetivo principal.`
    }

    const zones = profile.powerZones
    const zonesText = zones
      ? Object.entries(zones)
          .map(([z, d]) => `  ${z.toUpperCase()} ${d.name}: ${d.min}w${d.max ? ` - ${d.max}w` : '+'}`)
          .join('\n')
      : 'No disponibles'

    return `${basePrompt}

PERFIL DEL CICLISTA:
- FTP: ${profile.ftp}w
- Peso: ${profile.weightKg}kg
- W/kg: ${profile.wattsPerKg}
- Horas disponibles/semana: ${profile.hoursPerWeek}h
- Nivel: ${profile.experience}
- Objetivo: ${profile.goal}

ZONAS DE POTENCIA (basadas en FTP ${profile.ftp}w):
${zonesText}

Usa estos datos como base para todos tus consejos.
Si el ciclista menciona vatios concretos de un entreno, clasifícalos en su zona correspondiente.`
  }
}
