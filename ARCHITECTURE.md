# ARCHITECTURE.md

## Visão Geral da Arquitetura (Web Screen Share Audio Capture)

O **audio-bridge** adota um modelo de arquitetura baseada em **Ponte Web (Web-to-Discord Bridge)**.
Como o bot roda em um servidor remoto (Docker/AWS) e não possui acesso direto ao hardware ou aos drivers de áudio do computador do usuário, ele utiliza APIs nativas do navegador (`getDisplayMedia`) para que o usuário compartilhe o áudio do seu sistema, aplicativo ou aba com o bot através de uma página web temporária e criptografada.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          DISCORD DISPATCHER                            │
│  Usuário no Discord executa /play ──► Bot responde com URL Criptografada│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           BROWSER FRONTEND                             │
│  1. Usuário abre https://bridge.audio-bot.com/stream?token=XYZ...      │
│  2. Exibe botão "Iniciar Compartilhamento de Áudio"                   │
│  3. Chama navigator.mediaDevices.getDisplayMedia({ audio: true })      │
│  4. Captura a faixa de áudio (Sistema / App / Aba)                     │
│  5. Transmite áudio criptografado via WSS / WebRTC (vídeo descartado)  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        NODE.JS AUDIO BRIDGE SERVER                     │
│  1. Valida token da sessão (vinculado ao userId e guildId)            │
│  2. Recebe o stream de áudio via WebSocket (WSS) com TLS               │
│  3. Transforma o PCM/WebM em Opus Frames (@discordjs/opus)             │
│  4. Injeta os frames no AudioPlayer da VoiceConnection                 │
│  5. Monitora temporizador da sessão (1 hora free / ilimitado doadores) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          DISCORD VOICE CHANNEL                         │
│  Áudio é transmitido em alta fidelidade no canal de voz via WebRTC/UDP  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Componentes da Arquitetura

### 1. Bot Discord (`src/bot/`)
- **Comandos Slash**:
  - `/play`: Inicializa a sessão, conecta o bot no canal de voz do usuário, gera um **Token de Sessão HMAC/UUID** e retorna um link ephemeral com a página web de captura.
  - `/pause`: Pausa o envio de áudio no player.
  - `/leave`: Encerra a conexão de voz, invalida a URL de streaming e libera a instância/container.
  - `/status`: Exibe tempo restante da sessão e status da transmissão.
- **State Management**:
  - `UserSessionMap`: Mantém o estado ativo de cada usuário:
    ```ts
    interface UserSession {
      userId: string;
      guildId: string;
      voiceChannelId: string;
      sessionToken: string;
      connection: VoiceConnection | null;
      player: AudioPlayer;
      isStreaming: boolean;
      isDonor: boolean;
      startedAt: number;
      expiresAt: number | null; // null se doador (ilimitado), startedAt + 3600s para free
      timerTimeoutId?: NodeJS.Timeout;
    }
    ```

### 2. Ponte Web / Frontend de Captura (`src/web/public/`)
- Página web moderna e simplificada.
- Utiliza a API `navigator.mediaDevices.getDisplayMedia({ audio: true, video: true })` ou `getUserMedia`.
- O navegador exibe a caixa de diálogo nativa do sistema operacional permitindo escolher:
  - **Tela Cheia** (captura áudio do sistema todo)
  - **Janela do Aplicativo** (captura áudio de um app específico, como jogos ou Spotify)
  - **Aba do Navegador** (captura áudio do YouTube, SoundCloud, etc.)
- O Javascript no cliente desativa a track de vídeo (`track.stop()` ou não envia pelo socket) para economizar processamento e largura de banda.
- Envia os chunks de áudio via WebSocket seguro (WSS) ou WebRTC Data/Media Track para o servidor Node.js.

### 3. Servidor de Transmissão & Audio Pipeline (`src/audio/`)
- Recebe o stream do navegador.
- Decodifica para PCM raw (`s16le`, 48000Hz, estéreo).
- Converte os dados para Opus via `@discordjs/opus`.
- Conecta a stream no `createAudioResource()` do `@discordjs/voice`.
- Envia para o canal de voz com baixa latência.

---

## Modelo Cloud & Infraestrutura (AWS + Docker)

### Phase 1: Docker Local & Single Server Container
Toda a aplicação (Bot Discord + Servidor Web Express/WSS) roda dentro de um container Docker configurado via `docker-compose.yml`.

### Phase 2: AWS Elastic Architecture (On-Demand Dispatcher)
Para otimizar custos e garantir escalabilidade:

```
                  ┌──────────────────────────────┐
                  │ AWS EC2 (t3.nano)            │
                  │ Controller / Dispatcher Bot  │
                  └──────────────┬───────────────┘
                                 │
                   (Recebe /play no Discord)
                                 │
                ┌────────────────┴────────────────┐
                ▼                                 ▼
      [Free User Stream]               [Donor / Premium User]
  - Subscrita container worker      - Subscrita container worker
  - Limite rígido: 1 hora            - Sessão ILIMITADA
  - Auto-terminate após 60 min      - Alta prioridade / recurso dedicado
```

1. **Dispatcher (`t3.nano`)**:
   - Mantém o Bot Discord online 24/7 com baixíssimo consumo de memória e CPU.
   - Escuta comandos slash.
2. **Workers em Container**:
   - Ao receber o comando `/play`, se não houver container alocado, o dispatcher inicia um worker ou aloca um slot de transmissão.
3. **Regra de 1 Hora (Freemium)**:
   - Contagem regressiva de 60 minutos iniciada no handshake com a página web.
   - Avisos aos 50 minutos e 59 minutos no Discord.
   - Encerramento automático e desconexão após 60 minutos se não houver renovação/status de doador.
4. **Doações & Licença**:
   - Aceite de doações livre (Patreon / Ko-fi / PIX).
   - Doadores recebem bypass do limite de 1 hora.

---

## Segurança & Criptografia

1. **Tokens de Sessão de Uso Único**:
   - A URL gerada no `/play` contém um token temporário assinado com expiração (ex: 5 minutos para abrir o link).
   - O link só aceita conexão do usuário que possui a sessão atrelada ao `userId` do Discord.
2. **Transmissão Criptografada (TLS / WSS)**:
   - Todo o tráfego de áudio do navegador para o servidor do bot trafega via HTTPS/WSS com certificado TLS (SSL).
3. **Privacidade de Vídeo**:
   - O servidor rejeita e descarta automaticamente qualquer pacote que contenha dados de vídeo. Apenas faixas com `kind === 'audio'` são processadas.

---

## Documentação & GitHub Pages

- A documentação pública do projeto será publicada utilizando **GitHub Pages**.
- O código-fonte dos docs residirá na pasta `/docs` do repositório.
- Incluirá guias de uso dos comandos, passo a passo para doações, tutoriais de compartilhamento de tela no navegador e guia de deploy self-hosted com Docker.
