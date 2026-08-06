# AGENTS.md

## Visão Geral

**audio-bridge** é um bot Discord inovador em Node.js/TypeScript que transmite qualquer áudio do PC/navegador do usuário para canais de voz do Discord via Web Bridge (Screen Share Audio Capture), sem necessidade de instalar aplicativos nativos nem compartilhar a tela no aplicativo do Discord.

### Problema Resolvido

Compartilhar áudio de alta qualidade ou de aplicativos específicos nas chamadas do Discord exige o compartilhamento de tela nativo do Discord (que requer permissões, consomem muita banda com vídeo e possuem limitações de licença/plataforma).

Com o **audio-bridge**:
1. O usuário executa `/play` no Discord.
2. O bot entra no canal de voz e responde com uma **URL única e segura**.
3. O usuário abre o link no seu navegador (Chrome, Edge, Firefox, Brave, Safari) e aceita a permissão nativa de compartilhamento de tela/áudio (`navigator.mediaDevices.getDisplayMedia`).
4. O navegador captura o áudio (sistema todo, aplicativo ou aba do navegador) e transmite de forma criptografada para o servidor do bot.
5. O bot descarta qualquer sinal de vídeo, processa o áudio PCM/Opus e o retransmite diretamente para o canal de voz do Discord.

## Stack Tecnológica

| Componente | Tecnologia |
|---|---|
| Runtime | Node.js 22+ / TypeScript 5.x (strict mode) |
| Web Server & WS | HTTP/HTTPS + WebSockets / WebRTC (`express` / `fastify` / `ws` / `@roamhq/wrtc` ou `mediasoup`) |
| Captura Web | Browser API (`navigator.mediaDevices.getDisplayMedia` + AudioContext / MediaRecorder) |
| Discord | `discord.js` v14 + `@discordjs/voice` |
| Encoder Opus | `@discordjs/opus` (bindings nativos libopus) |
| Containerização | Docker & Docker Compose |
| Cloud / Cloud Infra | AWS EC2 (instância `t3.nano` para orquestração/dispatcher + workers sob demanda) |
| Dev Tools & Scripts | `tsx` dev runner, `tsc` build, `pino` logger |

## Estrutura do Projeto

```
audio-bridge/
├── src/
│   ├── index.ts                  # Entry point: inicia HTTP server + Discord client
│   ├── config.ts                 # Config via env vars (tokens, portas, limites AWS)
│   ├── bot/
│   │   ├── client.ts             # Discord Client com intents de voz
│   │   ├── commands/
│   │   │   ├── index.ts          # Registry: Collection<string, Command>
│   │   │   ├── join.ts           # /join
│   │   │   ├── leave.ts          # /leave
│   │   │   ├── play.ts           # /play (gera URL de transmissão)
│   │   │   ├── pause.ts          # /pause
│   │   │   └── status.ts         # /status (exibe tempo de sessão restante)
│   │   ├── events/
│   │   └── deploy.ts             # Script p/ registrar slash commands
│   ├── web/
│   │   ├── server.ts             # Servidor HTTP/WebSocket p/ receber áudio do navegador
│   │   ├── routes/               # Rotas web (página de compartilhamento + auth token)
│   │   └── public/               # Frontend Web (HTML/JS/CSS p/ compartilhamento de tela/áudio)
│   ├── audio/
│   │   ├── receiver.ts           # Recebe chunks/stream de áudio criptografado do Web frontend
│   │   ├── encoder.ts            # Transforma PCM em Opus frames
│   │   └── streamer.ts           # Stream Opus -> AudioResource -> Discord Voice
│   ├── state/
│   │   └── user-session.ts       # Map<userId, UserSession> (gerencia tokens, timer 1h, status)
│   └── utils/
│       └── logger.ts             # Logger global (pino)
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── docs/                         # Documentação p/ GitHub Pages
├── package.json
├── tsconfig.json
└── .env.example
```

## Comandos Slash

| Comando | Descrição |
|---|---|
| `/join` | Bot entra no canal de voz do usuário |
| `/leave` | Bot sai do canal de voz e encerra a sessão |
| `/play` | Entra no canal (se necessário) e gera o link seguro para compartilhamento de áudio via navegador |
| `/pause` | Pausa/retoma a transmissão do áudio |
| `/status` | Mostra o status da conexão, fonte atual e tempo restante da sessão (1h grátis / ilimitado para doadores) |

## Como Rodar

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env

# Executar em ambiente de desenvolvimento (hot reload)
npm run dev

# Subir via Docker
docker-compose up --build -d
```

## Convenções de Código

- **TypeScript strict**: `strict: true` no tsconfig. Sempre tipar retornos de função.
- **Segurança First**: Validação de tokens temporários de sessão (UUID / HMAC) para cada URL gerada no `/play`. Criptografia TLS/WSS para o áudio trafegado do navegador até o bot.
- **Descarte Rápido de Vídeo**: O frontend web solicita apenas áudio quando possível ou descarta frames de vídeo imediatamente, garantindo privacidade e uso mínimo de CPU/rede.
- **Gerenciamento de Recursos Cloud**: Respeitar limite de 1 hora por transmissão na versão gratuita; liberar recursos imediatamente no `/leave` ou no encerramento da aba.
- **Erros**: Propagar com contexto via `logger.error({ err, userId, sessionId }, 'mensagem')`.
- **Imports**: Usar prefixo `node:` para módulos nativos.

## Fluxo de Áudio e Segurança (Browser -> Bot Server -> Discord)

```
[Navegador do Usuário]
  │ (Abre URL gerada no /play com Token de Sessão)
  │ navigator.mediaDevices.getDisplayMedia({ audio: true })
  │ Criptografia WSS / TLS / WebRTC
  ▼
[Servidor Web / AudioReceiver] (Docker / AWS Instance)
  │ Autentica token de sessão
  │ Isola apenas a faixa de áudio (descarta vídeo)
  │ PCM s16le / Opus Buffer
  ▼
[OpusEncoder] (@discordjs/opus)
  ▼
[AudioPlayer & VoiceConnection]
  ▼
Canal de Voz do Discord (WebRTC / UDP)
```

## Regras de Negócio e Cloud (AWS / Docker)

1. **Docker**: Primeira etapa de deploy. Todo o ambiente (Bot + Web Bridge) é empacotado em container.
2. **Orquestração AWS**:
   - Ponto de entrada: Instância `t3.nano` atuando como dispatcher/controller lightweight.
   - Instâncias/Containers de Worker: Ativados sob demanda quando uma transmissão inicia.
3. **Tempo de Sessão**:
   - Usuário Gratuito: 1 hora de transmissão contínua por sessão.
   - Assinantes / Doadores: Transmissão **ilimitada**.
   - Doações são abertas e incentivadas para cobrir os custos de infraestrutura AWS.
