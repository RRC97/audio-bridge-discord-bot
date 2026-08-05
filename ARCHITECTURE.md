# ARCHITECTURE.md

## Diagrama de Componentes

```
┌──────────────────────────────────────────────────────────────┐
│                       Discord Client                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │  /join   │  │  /leave  │  │ /select  │  │ /play /pause │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘ │
│       │              │              │               │         │
│       └──────────────┴──────┬───────┴───────────────┘         │
│                             ▼                                 │
│                    ┌─────────────────┐                        │
│                    │  UserSessionMap │                        │
│                    │ Map<userId,     │                        │
│                    │   UserSession>  │                        │
│                    └────────┬────────┘                        │
│                             │                                 │
│              ┌──────────────┼──────────────┐                  │
│              ▼              ▼              ▼                  │
│     ┌────────────┐ ┌─────────────┐ ┌──────────────┐          │
│     │VoiceConn.  │ │AudioPlayer  │ │AudioCapturer │          │
│     │(WebRTC)    │ │(@discordjs) │ │(factory)     │          │
│     └─────┬──────┘ └──────┬──────┘ └──────┬───────┘          │
│           │               │               │                   │
└───────────┼───────────────┼───────────────┼───────────────────┘
            │               │               │
            ▼               ▼               ▼
   ┌────────────┐  ┌──────────────┐  ┌────────────────┐
   │ Discord    │  │ OpusEncoder  │  │ Native Process │
   │ Voice UDP  │  │ (s16le→Opus) │  │ (parec/ffmpeg) │
   └────────────┘  └──────────────┘  └────────────────┘
```

## Core: Pipeline de Áudio

```
┌───────────────────────────────────────────────────────────────┐
│ 1. CAPTURE                                                    │
│ Processo nativo (parec/ffmpeg) → stdout = PCM raw             │
│                                                               │
│ Formato: s16le (signed 16-bit little-endian)                  │
│ Sample rate: 48000 Hz                                         │
│ Channels: 2 (stereo)                                          │
│ Frame size: 960 samples/ch = 1920 samples = 3840 bytes        │
│ Frame duration: 20ms                                          │
├───────────────────────────────────────────────────────────────┤
│ 2. ENCODE                                                     │
│ Buffer de bytes (3840) → OpusEncoder.encode() → Opus frame    │
│                                                               │
│ Library: @discordjs/opus (preferido) ou opusscript (fallback) │
│ Application: OPUS_APPLICATION_AUDIO                           │
├───────────────────────────────────────────────────────────────┤
│ 3. STREAM                                                     │
│ Frames Opus → Node.js Readable stream (push-based)            │
│                                                               │
│ StreamType.Opus — frames Opus sem container (sem Ogg/WebM)    │
├───────────────────────────────────────────────────────────────┤
│ 4. RESOURCE                                                   │
│ Readable → createAudioResource(stream, {                      │
│   inputType: StreamType.Opus,                                 │
│   inlineVolume: false (default, performance)                  │
│ })                                                            │
├───────────────────────────────────────────────────────────────┤
│ 5. PLAY                                                       │
│ AudioPlayer.play(resource) → VoiceConnection.subscribe(player)│
│                                                               │
│ Discord gerencia o buffer/playout via WebRTC para o canal     │
└───────────────────────────────────────────────────────────────┘
```

## Interface AudioCapturer

Abstração que esconde a complexidade de cada SO e tipo de fonte:

```ts
type AudioSourceType = 'system' | 'application' | 'browser-tab';

interface AudioSource {
  id: string;        // identificador interno (ex: sink input index)
  name: string;      // nome amigável (ex: "Firefox", "Spotify")
  type: AudioSourceType;
}

interface AudioCapturer {
  readonly sourceType: AudioSourceType;
  readonly sourceId?: string;       // específico para app/browser-tab

  /** Stage 2+: lista fontes de áudio disponíveis (apps rodando) */
  listSources?(): Promise<AudioSource[]>;

  /** Inicia captura e retorna stream Readable de PCM */
  start(): Readable;

  /** Para captura e mata processo nativo */
  stop(): void;
}
```

### Implementações por SO

```
AudioCapturer
├── LinuxSystemCapturer    (parec --format=s16le --rate=48000 --channels=2)
├── LinuxAppCapturer       (parec --monitor-stream=<idx>)
├── WindowsSystemCapturer  (ffmpeg -f dshow -i audio="Stereo Mix")
├── WindowsAppCapturer     (ffmpeg -f dshow -i audio="...") — requer pesquisa
└── BrowserTabCapturer     (Stage 3: extensão + WebSocket local)
```

### Factory

```ts
function createCapturer(type: AudioSourceType, options?: { sourceId?: string }): AudioCapturer {
  switch (process.platform) {
    case 'linux':  return createLinuxCapturer(type, options);
    case 'win32':  return createWindowsCapturer(type, options);
    default:
      throw new Error(`Plataforma não suportada: ${process.platform}`);
  }
}
```

## Gerenciamento de Estado (UserSession)

Cada usuário tem uma sessão isolada:

```ts
interface UserSession {
  userId: string;
  guildId: string;
  voiceChannelId: string | null;
  connection: VoiceConnection | null;
  player: AudioPlayer;
  capturer: AudioCapturer | null;
  selectedSource: AudioSourceType | null;
  selectedSourceId: string | null;   // app name ou tab id
  isPlaying: boolean;
}
```

Armazenado em `userSessions: Map<string, UserSession>`.

### Diagrama de Transições de Estado

```
                  /join
    [IDLE] ──────────────────► [CONNECTED]
                                    │
                              /select
                                    ▼
                              [SOURCE_SELECTED]
                                    │
                               /play
                                    ▼
                              [PLAYING] ◄──────────┐
                                    │               │
                              /pause               /play
                                    ▼               │
                              [PAUSED] ─────────────┘
                                    │
                    /leave ou /select (troca fonte)
                                    │
                                    ▼
    [IDLE] ◄───────────────── [CONNECTED]
```

### Interações entre Comandos e Estado

| Estado Atual | `/join` | `/leave` | `/select` | `/play` | `/pause` |
|---|---|---|---|---|---|
| **IDLE** | Entra no canal | NOP (já fora) | Erro: use /join | Erro: use /join | Erro: nada tocando |
| **CONNECTED** | Erro: já está | Sai do canal | Seleciona fonte | Inicia stream | Erro: nada selecionado |
| **SOURCE_SELECTED** | Sai e re-entra | Sai do canal | Troca fonte | Inicia stream | Erro: não está tocando |
| **PLAYING** | Sai e re-entra | Sai do canal | Troca fonte | Erro: já tocando | Pausa |
| **PAUSED** | Sai e re-entra | Sai do canal | Troca fonte | Retoma | Erro: já pausado |

## Fluxo de Comando Detalhado

### `/join`

```
interactionCreate → /join handler
  │
  ├─ Valida que usuário está em canal de voz
  │   └─ Se não: reply ephemeral "Entre em um canal de voz primeiro"
  │
  ├─ Cria ou obtém UserSession
  │
  ├─ joinVoiceChannel({ channelId, guildId, adapterCreator })
  │
  ├─ Aguarda conexão Ready (entersState com timeout)
  │
  ├─ Cria AudioPlayer e subscreve à connection
  │
  ├─ Armazena connection e player na UserSession
  │
  └─ reply ephemeral "Conectado ao canal ${channel.name}"
```

### `/select`

```
interactionCreate → /select handler
  │
  ├─ Obtém UserSession (criada pelo /join)
  │   └─ Se não existe: reply ephemeral "Use /join primeiro"
  │
  ├─ Lê subcomando: system | app
  │
  ├─ Se system:
  │   ├─ Cria SystemCapturer via factory
  │   ├─ Armazena na UserSession.selectedSource = 'system'
  │   └─ reply ephemeral "Fonte: áudio do sistema"
  │
  ├─ Se app:
  │   ├─ Se Stage 2 não implementado ainda: reply ephemeral "Em breve!"
  │   ├─ Lista apps com AudioCapturer.listSources()
  │   ├─ Mostra opções pro usuário (select menu ou autocomplete)
  │   ├─ Armazena capturer com sourceId do app escolhido
  │   └─ reply ephemeral "Fonte: ${appName}"
  │
  └─ Para a stream atual se estiver tocando antes de trocar fonte
```

### `/play`

```
interactionCreate → /play handler
  │
  ├─ Obtém UserSession
  │   └─ Se não tem selectedSource: reply ephemeral "Use /select primeiro"
  │
  ├─ Se já está playing: reply ephemeral "Já está tocando"
  │
  ├─ Se paused: player.unpause() + reply ephemeral "Retomado"
  │
  ├─ Senão:
  │   ├─ capturer.start() → PCM Readable stream
  │   ├─ Pipeline: PCM → encoder → opusReadable
  │   ├─ resource = createAudioResource(opusReadable, { inputType: StreamType.Opus })
  │   ├─ player.play(resource)
  │   ├─ UserSession.isPlaying = true
  │   └─ reply ephemeral "Tocando áudio do ${sourceType}"
```

### `/pause`

```
interactionCreate → /pause handler
  │
  ├─ Obtém UserSession
  │   └─ Se não está playing: reply ephemeral "Nada tocando no momento"
  │
  ├─ player.pause()
  ├─ UserSession.isPlaying = false
  └─ reply ephemeral "Pausado"
```

### `/leave`

```
interactionCreate → /leave handler
  │
  ├─ Obtém UserSession
  │   └─ Se sem connection: reply ephemeral "Não estou em nenhum canal"
  │
  ├─ Se isPlaying: capturer.stop() + player.stop()
  │
  ├─ connection.destroy()
  │
  ├─ Limpa UserSession mantendo registro (ou remove do Map)
  │
  └─ reply ephemeral "Desconectado"
```

## Ciclo de Vida do VoiceConnection

```
Signalling ──► Connecting ──► Ready ──► (tocando áudio)
                    ▲              │
                    │              ▼
                    │         Disconnected
                    │              │
                    │    ┌─────────┴─────────┐
                    │    ▼                   ▼
                    │  (recuperável)    (não recuperável)
                    │    │                   │
                    │    ▼                   ▼
                    └─ reconnect          Destroyed
```

### Tratamento de Desconexão

```ts
connection.on(VoiceConnectionStatus.Disconnected, async () => {
  try {
    // Tenta reconectar em 5s
    await Promise.race([
      entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
      entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
    ]);
  } catch {
    // Desconexão real — limpa estado e notifica usuário
    connection.destroy();
    session.connection = null;
    // Opcional: tentar reentrar no canal via /join automático
  }
});
```

## Tratamento de Erros

### Estratégia Geral

1. **Erros de captura** (processo nativo morre): reconecta automaticamente se possível, loga erro
2. **Erros de conexão** (voice disconnect): tenta reconectar por 5s, depois notifica usuário
3. **Erros de player** (codec falha): loga, tenta recriar pipeline
4. **Erros de interação** (comando inválido): reply ephemeral com mensagem descritiva

### Eventos de Erro

```ts
player.on('error', (error) => {
  logger.error({ err: error, userId }, 'Player error');
  // player já para automaticamente — notificar usuário
});

capturer.on('error', (err) => {
  logger.error({ err, userId, sourceType }, 'Capture error');
  // Tentar reiniciar captura ou notificar falha
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception');
  // Graceful shutdown
});
```

## Dependências npm

```json
{
  "dependencies": {
    "discord.js": "^14.x",
    "@discordjs/voice": "^0.x",
    "@discordjs/opus": "^0.x",
    "pino": "^9.x",
    "pino-pretty": "^11.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "tsx": "^4.x",
    "@types/node": "^20.x",
    "eslint": "^9.x",
    "@typescript-eslint/eslint-plugin": "^8.x",
    "@typescript-eslint/parser": "^8.x"
  }
}
```

## Configuração (`.env`)

```env
DISCORD_TOKEN=           # Token do bot (Discord Developer Portal)
DISCORD_CLIENT_ID=        # Application ID do bot
DISCORD_GUILD_ID=         # Servidor para testes (guild commands)
LOG_LEVEL=info            # trace | debug | info | warn | error | fatal
```

## Segurança

- Token do Discord armazenado apenas em `.env` (nunca commitado)
- `.env` listado no `.gitignore`
- Dados de áudio não são armazenados em disco — tudo em memória
- Comandos não expõem informações de outros usuários (cada um vê seu próprio estado)
- Intents apenas os necessários (Guilds + GuildVoiceStates)

## Decisões de Design

| Decisão | Motivo |
|---|---|
| `StreamType.Opus` sem container Ogg | Menos overhead, não precisa de FFmpeg para Opus |
| Factory pattern para capturadores | Permite adicionar novos SOs sem alterar o core |
| UserSession por userId (não por guild) | Um usuário = uma sessão, mesmo em servidores diferentes |
| Estado volátil (Map em memória) | Simples, rápido. Sem necessidade de persistência |
| Interface AudioCapturer | Desacopla captura do pipeline de áudio |
| Push-based Readable stream | PCM chega assincronamente do processo nativo |
| `@discordjs/opus` (nativo) vs `opusscript` | Performance superior com bindings nativos C |
