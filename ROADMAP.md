# ROADMAP.md

## Visão Geral dos Estágios

```
Stage 1 (MVP Docker Web Bridge)      Stage 2 (Sessão & Segurança)          Stage 3 (AWS Cloud & Docs)
──────────────────────────────      ────────────────────────────          ───────────────────────────
- Bot Discord (/play, /leave)       - Token de sessão único               - Arquitetura AWS t3.nano
- Servidor Web (HTML/JS + WSS)      - Limite de 1h p/ conta Free          - Workers de streaming sob demanda
- Captura getDisplayMedia Audio     - Transmissão áudio 100% criptografada- Sistema de Doadores (Sessão ilimitada)
- Audio Streamer -> Discord Voice   - Descarte automático de vídeo        - Site de Documentação no GitHub Pages
```

---

## Stage 1 — MVP: Web Screen Share Audio Bridge (Dockerized)

**Objetivo**: Bot funcional rodando em container Docker que gera um link temporário no `/play`. O usuário abre a página web, aceita o compartilhamento de tela/áudio no navegador e o bot transmite o áudio para o canal de voz do Discord.

### Funcionalidades

- [x] Reestruturação dos arquivos de arquitetura e documentação
- [ ] Configuração do servidor HTTP/WSS integrado ao Node.js (`src/web/server.ts`)
- [ ] Interface Web de captura (`src/web/public/index.html` + `app.js`) com API `getDisplayMedia`
- [ ] Comandos Slash reescritos: `/play` (gera link web), `/leave`, `/pause`, `/status`
- [ ] Pipeline de Áudio: WebSocket Receiver -> PCM Decode -> Opus Encoder -> Discord AudioPlayer
- [ ] Dockerfile multi-stage e `docker-compose.yml` para execução local e em servidor
- [ ] Descarte de faixas de vídeo no frontend e no backend (privacidade e economia de dados)

---

## Stage 2 — Segurança, Gestão de Sessões & Sistema de 1 Hora

**Objetivo**: Garantir segurança nas conexões, autenticação de sessão e controle de tempo de streaming.

### Funcionalidades

- [ ] Autenticação de Tokens de Sessão (UUID/HMAC gerado por comando `/play` vinculado ao `userId`)
- [ ] Sistema de Cronômetro de Sessão:
  - Timer de 60 minutos para usuários gratuitos
  - Alertas no Discord quando faltarem 10 minutos e 1 minuto
  - Desconexão automática e destruição da sessão após 1 hora
- [ ] Suporte a Criptografia TLS/SSL (WSS) na comunicação Web Browser -> Bot Server
- [ ] Comando `/status` exibindo tempo decorrido, tempo restante e status do streaming
- [ ] Tracing e logs estruturados de auditoria via `pino`

---

## Stage 3 — Infraestrutura Cloud AWS & Site no GitHub Pages

**Objetivo**: Preparar a infraestrutura de baixo custo na AWS (t3.nano dispatcher + containers workers) e publicar o site de documentação.

### Funcionalidades

- [ ] **Arquitetura AWS Cloud**:
  - Instância `t3.nano` atuando como entrada 24/7 (Dispatcher/Orquestrador do Bot)
  - Automação via Docker / AWS ECS / EC2 para subir/destruir workers de mídia sob demanda
- [ ] **Sistema de Doações & Benefícios**:
  - Integração/Verificação de doadores (bypass do limite de 1 hora para sessões ilimitadas)
  - Botão de doação na interface web e no comando `/status`
- [ ] **Documentação em GitHub Pages**:
  - Criação da pasta `/docs` com suporte a GitHub Pages (Markdown / VitePress)
  - Manual do usuário, guia de comandos, tutorial de doação e guia de deployment self-hosted
