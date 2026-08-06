# audio-bridge Discord Bot 🎵🎙️

**audio-bridge** é um bot de áudio para Discord desenvolvido em Node.js e TypeScript que permite transmitir qualquer áudio do seu computador (áudio do sistema, aplicativo específico como Spotify/jogos, ou aba do navegador) diretamente para o canal de voz do Discord, **sem precisar instalar programas locais e sem compartilhar tela dentro do app do Discord!**

---

## 💡 Como Funciona?

No Discord, transmitir apenas o áudio de um aplicativo costuma exigir o compartilhamento de tela inteira (consumindo muita banda e exigindo transmissões de vídeo).

O **audio-bridge** resolve isso de forma simples e elegante através de uma **Ponte Web (Browser Audio Capture)**:

```
┌──────────────┐         /play          ┌──────────────────────────────────┐
│ Usuário no   ├───────────────────────►│ Bot entra no Canal de Voz e      │
│ Discord      │                        │ gera um Link Seguro temporário   │
└──────┬───────┘                        └────────────────┬─────────────────┘
       │                                                 │
       │  Abre a URL no Navegador                        │
       ▼                                                 ▼
┌──────────────────────────────────┐            ┌──────────────────────────┐
│ Interface Web (Screen Share API) │───WSS────► │ Servidor Node.js (Docker)│
│ Captura apenas a faixa de áudio  │ (cripto)   │ Processa Opus -> Discord │
└──────────────────────────────────┘            └──────────────────────────┘
```

1. **Inicie o Bot**: No servidor Discord, digite `/play`.
2. **Abra o Link**: O bot entrará no seu canal de voz e responderá com um link web único e seguro.
3. **Compartilhe o Áudio**: Ao clicar no link, seu navegador (Chrome, Edge, Firefox, Brave, Safari) abrirá uma página web simples pedindo permissão de compartilhamento de tela/áudio (`navigator.mediaDevices.getDisplayMedia`).
4. **Pronto!**: Escolha o que deseja transmitir (a tela inteira, uma janela de aplicativo ou uma aba). O bot irá capturar **apenas o áudio**, descartar a imagem para economizar sua internet e transmitir com alta fidelidade para a chamada!

---

## ✨ Principais Recursos

- 🚀 **Zero Instalação de Programas**: Tudo funciona nativamente no seu navegador de preferência.
- 🔒 **Segurança & Criptografia**: Links únicos com tokens temporários vinculados à sua conta. Conexão criptografada (TLS/WSS).
- 🛡️ **Privacidade Garantida**: O sinal de vídeo é descartado na própria origem pelo navegador ou servidor; apenas o áudio é processado.
- 🐳 **Pronto para Docker**: Deploy simplificado em qualquer servidor Linux/Cloud.
- ☁️ **Arquitetura AWS de Baixo Custo**: Projetado para rodar em instâncias leves (`t3.nano`) com alocação dinâmica.
- ⏱️ **Gerenciamento de Sessão (1 Hora Free / Ilimitado para Doadores)**: Limite de 1 hora de transmissão por sessão para manter custos sustentáveis, com renovação livre e acesso ilimitado para doadores do projeto.

---

## 🎮 Comandos Slash

| Comando | Descrição |
|---|---|
| `/play` | Conecta o bot ao seu canal de voz e gera a URL segura para iniciar a transmissão |
| `/pause` | Pausa ou retoma o áudio da transmissão atual |
| `/status` | Exibe o status da transmissão, tempo decorrido e tempo restante de sessão |
| `/leave` | Desconecta o bot do canal de voz e encerra a sessão web |

---

## 🐳 Como Executar com Docker

Para rodar o bot e a ponte web usando Docker:

### Pré-requisitos
- Docker instalado
- Docker Compose instalado
- Token de Bot do Discord ([Discord Developer Portal](https://discord.com/developers/applications))

### Passo a Passo

1. **Clone o repositório**:
   ```bash
   git clone https://github.com/RRC97/audio-bridge-discord-bot.git
   cd audio-bridge-discord-bot
   ```

2. **Configure as Variáveis de Ambiente**:
   Crie um arquivo `.env` baseado no `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Preencha os dados:
   ```env
   DISCORD_TOKEN=seu_token_aqui
   DISCORD_CLIENT_ID=seu_client_id_aqui
   DISCORD_GUILD_ID=seu_guild_id_opcional_para_testes
   WEB_PORT=3000
   PUBLIC_WEB_URL=http://localhost:3000
   ```

3. **Deploy dos Comandos Slash**:
   ```bash
   npm run deploy
   ```

4. **Inicie o Container**:
   ```bash
   docker-compose up --build -d
   ```

---

## ☁️ Arquitetura de Nuvem (AWS) & Doações

### Modelo de Infraestrutura
O projeto foi desenhado para escalabilidade econômica:
- **Dispatcher/Controller**: Uma instância `t3.nano` na AWS responsável por manter o bot online 24/7 recebendo requisições.
- **Workers sob Demanda**: Instâncias/Containers inicializados dinamicamente apenas quando um usuário abre uma transmissão.

### Duração da Sessão & Doações
- **Usuários Gratuitos**: Transmissões limitadas a **1 hora (60 minutos)** de duração por sessão (com avisos antes do término).
- **Doadores / VIP**: Sessões **ilimitadas** sem interrupções!
- 💖 **Doações**: O projeto é código aberto e aceita doações voluntárias para ajudar a arcar com os custos de servidores na AWS.

---

## 📚 Documentação & GitHub Pages

A documentação detalhada do projeto, incluindo guia de implantação, arquitetura de rede e FAQs, está disponível na nossa página do **GitHub Pages** (pasta `/docs`).

---

## 📜 Licença

Este projeto está licenciado sob a licença [MIT](LICENSE).
