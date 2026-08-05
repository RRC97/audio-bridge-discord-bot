# AGENTS.md

## Visão Geral

**audio-bridge** é um bot Discord que captura e transmite áudio do PC do usuário para canais de voz do Discord, sem necessidade de compartilhar a tela. O usuário escolhe a fonte de áudio e controla a reprodução via slash commands.

### Problema Resolvido

Compartilhar áudio em calls do Discord hoje exige compartilhar a tela inteira. O audio-bridge permite transmitir apenas o áudio — seja do sistema todo, de um aplicativo específico ou futuramente de uma aba do navegador — diretamente pelo bot no canal de voz.

## Stack

| Componente | Tecnologia |
|---|---|
| Runtime | Node.js 20+ / TypeScript 5.x (strict mode) |
| Discord | `discord.js` v14 + `@discordjs/voice` |
| Encoder Opus | `@discordjs/opus` (bindings nativos libopus) |
| Captura áudio (Linux) | PipeWire/PulseAudio via `parec`, `pactl`, `wpctl` |
| Captura áudio (Windows) | WASAPI via FFmpeg dshow ou helper nativo |
| Logging | `pino` |
| Gerenciamento de processos | `zx` / child_process |
| Dev tools | `tsx` para dev runner, `tsc` para build |

## Estrutura do Projeto

```
audio-bridge/
├── src/
│   ├── index.ts                  # Entry point: cria client, registra comandos e eventos
│   ├── config.ts                 # Config via env vars (token, clientId, guildId)
│   ├── bot/
│   │   ├── client.ts             # Discord Client com intents de voz
│   │   ├── commands/
│   │   │   ├── index.ts          # Registry: Collection<string, Command>
│   │   │   ├── join.ts           # /join
│   │   │   ├── leave.ts          # /leave
│   │   │   ├── play.ts           # /play
│   │   │   ├── pause.ts          # /pause
│   │   │   └── select.ts         # /select (system, app)
│   │   ├── events/
│   │   │   ├── index.ts          # Registry de event handlers
│   │   │   └── interactionCreate.ts
│   │   └── deploy.ts             # Script standalone p/ registrar slash commands
│   ├── audio/
│   │   ├── capturer.ts           # Interface AudioCapturer + factory por SO
│   │   ├── sources/
│   │   │   ├── system.ts         # Stage 1 — system audio
│   │   │   ├── application.ts    # Stage 2 — per-app audio
│   │   │   └── browser-tab.ts    # Stage 3 — browser tab (futuro)
│   │   ├── encoder.ts            # Wrapper do OpusEncoder
│   │   └── streamer.ts           # PCM → Opus frames → Readable → AudioResource
│   ├── state/
│   │   └── user-session.ts       # Map<userId, UserSession> — estado por usuário
│   └── utils/
│       └── logger.ts             # Logger global (pino)
├── package.json
├── tsconfig.json
└── .env.example
```

## Comandos Slash

| Comando | Descrição | Subcomandos / Opções |
|---|---|---|
| `/join` | Bot entra no canal de voz do usuário | — |
| `/leave` | Bot sai do canal de voz | — |
| `/select` | Seleciona a fonte de áudio | `system` — áudio do PC inteiro<br>`app <nome>` — áudio de um aplicativo (Stage 2) |
| `/play` | Inicia ou retoma o streaming | — |
| `/pause` | Pausa o streaming | — |

Comandos são **user-scoped**: o estado (fonte selecionada, canal, player) fica vinculado ao `userId` que executou o comando.

## Como Rodar

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Preencher DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID

# Registrar comandos (uma vez, ou quando comandos mudarem)
npm run deploy

# Desenvolvimento (hot reload)
npm run dev

# Build + produção
npm run build && npm start
```

## Convenções de Código

- **TypeScript strict**: `strict: true` no tsconfig. Sempre tipar retornos de função.
- **Sem classes desnecessárias**: Preferir funções e interfaces. Classes só quando estado + comportamento estão fortemente acoplados.
- **Factory pattern** para capturadores de áudio: `createCapturer(os, type)` retorna a implementação correta por SO.
- **Erros**: Sempre propagar com contexto. Usar `logger.error({ err, userId, sourceType }, 'mensagem')`.
- **Nomes de arquivo**: kebab-case (`user-session.ts`, `browser-tab.ts`).
- **Comandos**: Cada comando exporta `{ data: SlashCommandBuilder, execute(interaction) }`.
- **Imports**: Sempre usar `node:` prefix para módulos nativos (`import { spawn } from 'node:child_process'`).
- **Respostas ephemeral**: Comandos usam `MessageFlags.Ephemeral` para respostas visíveis só ao usuário.

## Fluxo de Áudio (Core Pipeline)

```
Fonte de áudio (system/app)
        │
        ▼
[AudioCapturer] — spawna processo nativo, produz stream PCM
  PCM: s16le, 48000Hz, stereo
        │
        ▼
[OpusEncoder] — @discordjs/opus, frame = 960 samples/ch × 2ch = 1920 samples = 3840 bytes
        │
        ▼
[Readable<OpusFrame>] — stream Node.js de frames Opus (StreamType.Raw)
        │
        ▼
[AudioResource] — createAudioResource(opusStream, { inputType: StreamType.Raw })
        │
        ▼
[AudioPlayer] — player.play(resource)
        │
        ▼
[VoiceConnection] — connection.subscribe(player)
        │
        ▼
Canal de voz Discord (WebRTC/UDP)
```

## State Management

Cada usuário tem uma `UserSession` com:

```ts
interface UserSession {
  userId: string;
  guildId: string;
  voiceChannelId: string | null;
  connection: VoiceConnection | null;
  player: AudioPlayer;
  capturer: AudioCapturer | null;
  selectedSource: AudioSourceType | null;  // 'system' | 'app' | 'browser-tab'
  isPlaying: boolean;
}
```

Armazenado em `Map<string, UserSession>` com chave `userId`. O estado persiste apenas em memória (volátil).

## Intents Necessários

- `GatewayIntentBits.Guilds` — básico
- `GatewayIntentBits.GuildVoiceStates` — obrigatório para voz (privileged intent, ativar no portal)

## Scripts npm

```json
{
  "dev": "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "deploy": "tsx src/bot/deploy.ts",
  "lint": "eslint src/",
  "typecheck": "tsc --noEmit"
}
```
