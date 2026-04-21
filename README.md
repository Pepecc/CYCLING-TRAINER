# 🚴 Cycling Coach — Backend API

Entrenador personal de ciclismo con IA. Arquitectura hexagonal, Express, TypeScript, SQLite, OpenAI API.

## Stack

- **Node.js + Express + TypeScript** — servidor HTTP con tipos estrictos
- **better-sqlite3** — persistencia (migrar a Postgres en Fase 2)
- **OpenAI API** — motor de IA del entrenador
- **JWT** — autenticación
- **Arquitectura hexagonal** — dominio, aplicación, infraestructura desacoplados

## Estructura

```
src/
├── domain/
│   ├── user/           User.ts, UserRepository.ts
│   ├── profile/        CyclistProfile.ts, CyclistProfileRepository.ts
│   └── chat/           Message.ts, Conversation.ts, ConversationRepository.ts, AIPort.ts
├── application/
│   ├── auth/           RegisterUser.ts, LoginUser.ts
│   ├── profile/        GetProfile.ts, UpdateProfile.ts
│   └── chat/           SendMessage.ts, GetConversations.ts, GetConversation.ts
├── infrastructure/
│   ├── ai/             OpenAIAdapter.ts
│   ├── persistence/    SqliteUserRepository.ts, SqliteProfileRepository.ts, SqliteConversationRepository.ts
│   └── http/           server.ts, routes/, middleware/
└── config/             container.ts (DI manual + migraciones)
```

## Setup

```bash
npm install
cp .env.example .env    # añade JWT_SECRET y ANTHROPIC_API_KEY
npm run dev             # desarrollo con hot-reload en :3000
```

## Variables de entorno

| Variable            | Descripción                                        |
|---------------------|----------------------------------------------------|
| `PORT`              | Puerto del servidor (default: 3000)                |
| `JWT_SECRET`        | Secreto para firmar tokens JWT                     |
| `ANTHROPIC_API_KEY` | API key de Anthropic                               |
| `DB_PATH`           | Ruta del fichero SQLite (default: ./data/...)      |

## Endpoints

### Auth
```
POST /api/auth/register   { email, password }
POST /api/auth/login      { email, password }
```

### Perfil (requiere JWT)
```
GET  /api/profile
PUT  /api/profile         { ftp, weightKg, hoursPerWeek, goal, experience }
```

### Chat (requiere JWT)
```
GET  /api/chat/conversations
GET  /api/chat/conversations/:id
POST /api/chat/message    { content, conversationId? }
```

## Build para producción

```bash
npm run build    # compila a dist/
npm start        # ejecuta dist/infrastructure/http/server.js
```

## Roadmap

- ✅ **Fase 1** — Backend base + OpenAI (este repo)
- 🔜 **Fase 2** — OAuth Wahoo + sync workouts + CTL/ATL/TSB
- 🔜 **Fase 3** — OAuth Strava + deduplicación
- 🔜 **Fase 4** — Webhooks Wahoo + memoria persistente
