# ROADMAP.md

## Visão Geral dos Estágios

```
Stage 1 (MVP)          Stage 2                  Stage 3 (futuro)
─────────────          ───────                  ────────────────
System Audio     →     Per-App Audio     →     Browser Tab Audio
(PC inteiro)           (Spotify, jogo, etc.)    (aba do navegador)
```

---

## Stage 1 — System Audio (MVP)

**Objetivo**: Bot funcional que captura e transmite o áudio do sistema para um canal de voz do Discord.

**Plataformas**: Linux (PipeWire/PulseAudio) + Windows (WASAPI/FFmpeg)

### Funcionalidades

- [x] Setup do projeto (TypeScript, ESLint, tsconfig, scripts)
- [x] Discord client com intents de voz
- [x] Comandos slash: `/join`, `/leave`, `/play`, `/pause`, `/select`
- [x] Registro de comandos (deploy script)
- [x] UserSession: estado por usuário (Map)
- [x] Event handler para interações (interactionCreate)
- [x] Interface `AudioCapturer` + factory
- [x] `LinuxSystemCapturer` — captura via `parec` / PipeWire
- [x] `WindowsSystemCapturer` — captura via FFmpeg dshow / WASAPI
- [x] `OpusEncoder` wrapper — PCM → Opus frames
- [x] `AudioStreamer` — PCM → Opus frames → Readable → AudioResource → AudioPlayer
- [x] VoiceConnection lifecycle (join, auto-reconnect, leave)
- [x] Tratamento de erros (captura, conexão, player)
- [x] Respostas ephemeral para todos os comandos

### Pipeline Stage 1

```
┌──────────────────────┐
│ parec (Linux) ou     │
│ ffmpeg dshow (Win)   │
│ stdout = PCM s16le   │
│ 48000Hz, stereo      │
└──────────┬───────────┘
           │ Buffer(3840 bytes = 20ms frame)
           ▼
┌──────────────────────┐
│ OpusEncoder          │
│ PCM → Opus frame     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Readable (push)      │
│ StreamType.Raw       │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ AudioResource        │
│ AudioPlayer          │
│ VoiceConnection      │
└──────────────────────┘
```

### Entregáveis

- Bot funcional que entra/sai de canais de voz
- Transmite áudio do sistema via `/play` e pausa via `/pause`
- `/select system` como única opção de fonte
- Funciona em Linux; Windows com adaptações

### Desafios Técnicos

| Desafio | Abordagem |
|---|---|
| PCM frame alignment (3840 bytes exatos) | Buffer acumulador: junta chunks até ter frameSize, corta excesso |
| Latência de captura | Configurar `--latency-msec=20` no parec, buffer pequeno |
| Voice disconnect recovery | EntersState com timeout de 5s; se falhar, destroy + log |
| FFmpeg no Windows | Pré-requisito documentado; fallback para dshow estéreo mix |
| Back-pressure no Readable stream | Push só quando consumidor pede (read); descartar frames se buffer cheio |

### Critério de Pronto

- `/join` → bot aparece no canal de voz
- `/select system` → sem erros
- `/play` → áudio do PC audível no canal
- `/pause` → áudio pausa
- `/play` (retomar) → áudio volta
- `/leave` → bot sai do canal
- Desconexão de rede → bot tenta reconectar ou limpa estado

---

## Stage 2 — Per-App Audio

**Objetivo**: Permitir que o usuário escolha um aplicativo específico (ex: Spotify, jogo, navegador) para transmitir apenas o áudio daquele app.

**Prioridade**: Linux primeiro (PipeWire facilita), Windows posterior (mais complexo)

### Funcionalidades

- [ ] `/select app` — lista aplicativos com áudio ativo
- [ ] `LinuxAppCapturer` — `parec --monitor-stream=<idx>` por app
- [ ] `LinuxAppCapturer.listSources()` — parse de `pactl list sink-inputs` ou `pw-cli list-ports`
- [ ] `WindowsAppCapturer` — pesquisa: Windows Audio Session API, loopback por PID
- [ ] UI de seleção: dropdown ou autocomplete com apps detectados
- [ ] Troca dinâmica de fonte sem sair do canal

### Como Funciona (Linux — PipeWire)

```
1. Usuário digita /select app
2. Bot executa `pactl list sink-inputs` (ou `pw-cli list-ports`)
3. Parse do output → lista de { id, name } (ex: "Firefox", "Spotify")
4. Bot mostra dropdown ou autocomplete pro usuário
5. Usuário escolhe o app
6. Bot cria LinuxAppCapturer com o sink-input index
7. LinuxAppCapturer.start() → spawn `parec --monitor-stream=<idx> params...`
8. Pipeline igual ao Stage 1 daqui pra frente
```

### Exemplo de Output `pactl list sink-inputs`

```
Sink Input #5
    Driver: protocol-native.c
    Owner Module: 12
    Client: 47
    Sink: 0
    ...
    application.name = "Firefox"
    media.name = "AudioStream"
    ...
```

O parse extrai:
- `Sink Input #N` → sourceId = "N"
- `application.name = "..."` → name = "Firefox"

### Comando equivalente para captura

```bash
parec --format=s16le --rate=48000 --channels=2 --latency-msec=20 --monitor-stream=5
```

O `--monitor-stream=<idx>` captura apenas o áudio daquele sink input específico no PipeWire.

### Desafios Técnicos

| Desafio | Abordagem |
|---|---|
| Parse do output do pactl | Regex simples, fallback para JSON via `pactl -f json` se disponível |
| App fecha/crash durante stream | Listener no processo parec: close → notifica usuário, sugere re-select |
| App muda de sink input index | Monitorar periodicamente (poll) e re-spawn capturador se necessário |
| Windows per-app capture | Pesquisa: Windows Core Audio APIs, possivelmente helper em C#/Rust |
| Múltiplos usuários com apps diferentes | Cada UserSession tem seu próprio capturer e stream |

### Critério de Pronto

- `/select app` → lista apps com áudio ativo
- Usuário seleciona "Spotify" → bot transmite só áudio do Spotify
- Trocar de app (selecionar "Firefox") → para Spotfy anterior, inicia Firefox
- App fechado → bot para stream, notifica
- Funcional no Linux; Windows com placeholder "em breve"

---

## Stage 3 — Browser Tab Audio (Futuro)

**Objetivo**: Capturar áudio de uma aba específica do navegador (ex: YouTube, SoundCloud) sem transmitir o resto do navegador.

**Abordagem**: Extensão de navegador + servidor WebSocket local integrado ao bot.

### Arquitetura Proposta

```
┌─────────────────────┐     WebSocket      ┌──────────────────┐
│ Browser Extension   │ ──────────────────► │ Local WS Server  │
│ (Chrome/Firefox)    │   PCM s16le, 48kHz  │ (parte do bot)   │
│                     │                     │                  │
│ chrome.tabCapture   │                     │ PCM → Opus       │
│ API (tab áudio)     │                     │ → Discord Voice  │
└─────────────────────┘                     └──────────────────┘
```

### Componentes

1. **Extensão (Manifest V3)**
   - Service worker + popup para selecionar aba
   - `chrome.tabCapture.capture({ audio: true })` → MediaStream
   - AudioContext + ScriptProcessorNode / AudioWorklet para extrair PCM
   - WebSocket client conecta ao servidor local do bot
   - Envia PCM chunks no formato: s16le, 48000Hz, stereo

2. **Servidor WebSocket Local**
   - Integrado ao processo do bot (porta localhost, ex: 9234)
   - Aceita conexões da extensão
   - Recebe PCM chunks → alimenta o pipeline Opus → Discord
   - Autenticação: token aleatório gerado pelo bot, compartilhado com extensão

### Fluxo do Usuário (Visão Futura)

```
1. Usuário digita /select tab
2. Bot inicia servidor WebSocket local (porta dinâmica)
3. Bot gera token aleatório e exibe link/instruções ephemeral:
   "Instale a extensão audio-bridge e acesse:
    ws://localhost:9234?token=abc123"
4. Usuário instala extensão, abre popup, seleciona aba
5. Extensão conecta ao WS, começa a enviar PCM
6. Bot detecta conexão → pipeline Opus → Discord Voice
7. /pause → bot pausa player (mas mantém WS aberto)
8. /leave ou /select outra fonte → bot fecha WS e para captura
```

### Desafios Técnicos

| Desafio | Abordagem |
|---|---|
| `chrome.tabCapture` requer foreground tab | Documentar limitação; usuário precisa manter aba visível |
| AudioWorklet complexidade | Começar com ScriptProcessorNode (deprecated mas mais simples) |
| Sincronização PCM inicial | Buffer de alguns frames para alinhar antes de começar stream |
| Segurança do WebSocket local | Token aleatório, bind apenas em localhost |
| Firefox vs Chrome APIs | Firefox: `browser.tabs.captureTab` (equivalente) |
| Latência de rede (extensão → WS) | Localhost = latência negligível |

### Entregáveis Futuros

- Extensão Chrome/Firefox publicada ou sideload
- Servidor WS integrado ao bot (sem dependência externa)
- `/select tab` funcional com detecção automática de abas
- Suporte a múltiplas abas (trocar sem reconectar)

---

## Timeline Sugerida

| Fase | Duração Estimada | Entregável |
|---|---|---|
| **Stage 1 — System Audio** | 1-2 semanas | MVP funcional |
| **Stage 2 — Per-App (Linux)** | 1 semana | `/select app` no Linux |
| **Stage 2 — Per-App (Windows)** | 2-3 semanas | Pesquisa + implementação |
| **Stage 3 — Browser Tab** | TBD | Após Stage 2 consolidado |

---

## Dependências Externas

| Dependência | Stage | Status |
|---|---|---|
| Discord Bot Token + App registration | 1 | Necessário antes de começar |
| PipeWire/PulseAudio no Linux | 1 | Já presente na maioria das distros |
| FFmpeg no sistema | 1 (Windows) | Instalação manual no Windows |
| `@discordjs/opus` build tools (C++ compiler) | 1 | Necessário para compilar binding nativo |
| Browser extension store (Chrome Web Store) | 3 | Para distribuição da extensão |
