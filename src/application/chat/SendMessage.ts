import { Conversation } from '../../domain/chat/Conversation'
import { Message } from '../../domain/chat/Message'
import { ConversationRepository } from '../../domain/chat/ConversationRepository'
import { CyclistProfileRepository } from '../../domain/profile/CyclistProfileRepository'
import { CyclistProfile } from '../../domain/profile/CyclistProfile'
import { AIPort } from '../../domain/chat/AIPort'
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
    private readonly aiPort: AIPort
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
    const userMessage = Message.create({ conversationId: conversation.id, role: 'user', content: content.trim() })
    await this.conversationRepository.saveMessage(userMessage)
    conversation.addMessage(userMessage)

    // Call AI
    const contextMessages = conversation.getContextMessages(20)
    const assistantContent = await this.aiPort.complete(systemPrompt, contextMessages)

    // Persist assistant response
    const assistantMessage = Message.create({ conversationId: conversation.id, role: 'assistant', content: assistantContent })
    await this.conversationRepository.saveMessage(assistantMessage)

    return { conversationId: conversation.id, message: assistantMessage }
  }

  private buildSystemPrompt(profile: CyclistProfile | null): string {
    const base = `Eres un entrenador personal de ciclismo experto y cercano. Tu nombre es Coach.
Combinas el rigor científico del entrenamiento con potenciómetro con un trato humano y motivador.

Cuando analices o planifiques, siempre tienes en cuenta:
- Periodización y principios de carga/recuperación
- Zonas de potencia (sistema Coggan de 7 zonas)
- Métricas clave: TSS, CTL, ATL, TSB, IF, NP, FTP, W/kg
- Nutrición y recuperación como parte del entrenamiento
- La vida real del ciclista (trabajo, familia, fatiga)

Respondes siempre en español, de forma directa y práctica.
Evitas respuestas genéricas — cada consejo está adaptado al perfil del ciclista.
Cuando no tienes suficiente información, preguntas antes de asumir.
LÍMITE DE ÁMBITO — MUY IMPORTANTE:
Solo respondes preguntas relacionadas con ciclismo y deportes directamente vinculados:
entrenamiento, potencia, nutrición deportiva, recuperación, equipamiento ciclista,
fisiología del ciclista, planificación de temporada, carreras y eventos.
Si el usuario hace una pregunta fuera de este ámbito, responde siempre con una
variación de: "Solo puedo ayudarte con temas de entrenamiento y ciclismo. ¿Tienes
alguna duda sobre tu preparación o tus entrenos?"
No hagas excepciones aunque el usuario insista, reformule la pregunta, o argumente
que tiene relación indirecta con el ciclismo.
`

    if (!profile || !profile.isComplete()) {
      return `${base}

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

    return `${base}

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
