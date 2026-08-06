# ISSUE #001: Implementação da Ponte Web de Captura de Áudio (Web Screen Share Audio Capture Bridge)

## 📌 Descrição da Funcionalidade

Migrar a arquitetura de captura do **audio-bridge** de captura local (PipeWire/WASAPI no host do bot) para uma **Ponte Web baseada no Navegador (Web Screen Share API)**.

Como o bot roda em servidor remoto Node.js (Docker/AWS), ele não possui acesso direto aos drivers de áudio do computador do usuário. Com esta funcionalidade:
1. O usuário executa `/play` no Discord.
2. O bot entra no canal de voz e gera um link temporário com token de autenticação.
3. O usuário acessa a URL no navegador e aceita a permissão de compartilhamento de tela/áudio (`navigator.mediaDevices.getDisplayMedia`).
4. O navegador envia a stream de áudio criptografada para o servidor.
5. O bot filtra e descarta o vídeo, convertendo o áudio em pacotes Opus e transmitindo para o canal de voz do Discord.

---

## 🎯 Objetivos & Benefícios

- **Independência de Software Local**: O usuário não precisa instalar programas nem drivers de áudio no seu computador.
- **Contorno de Licenciamento & Limitações do Discord**: Não utiliza compartilhamento de vídeo no app do Discord, apenas transmissão nativa de áudio para o canal de voz.
- **Privacidade & Segurança**: Conexão criptografada (WSS/TLS), tokens de sessão temporários assinados e descarte total de pacotes de vídeo.
- **Eficiência de Rede**: Consumo de banda reduzido ao transmitir exclusivamente o áudio.

---

## 📋 Lista de Tarefas (Checklist)

### 1. Servidor Web & Ponte WSS (`src/web/`)
- [ ] Criar servidor HTTP/WebSocket em Node.js (`express` / `fastify` + `ws`).
- [ ] Implementar autenticação via Token Temporário de Sessão (UUID/HMAC).
- [ ] Criar rotas web para renderizar a página de captura.

### 2. Frontend de Captura Web (`src/web/public/`)
- [ ] Desenvolver interface responsiva e intuitiva.
- [ ] Implementar chamada para `navigator.mediaDevices.getDisplayMedia({ audio: true, video: true })`.
- [ ] Implementar isolamento e transmissão da faixa de áudio via WSS/WebRTC.
- [ ] Garantir o encerramento do compartilhamento ao fechar a aba ou clicar em parar.

### 3. Reformulação dos Comandos Slash (`src/bot/commands/`)
- [ ] `/play`: Conecta no canal de voz, cria a sessão com token e envia a URL ephemeral pro usuário.
- [ ] `/pause`: Pausa/retoma a reprodução.
- [ ] `/leave`: Desconecta do canal e finaliza o token/sessão.
- [ ] `/status`: Exibe status da transmissão e tempo restante.

### 4. Gestão de Sessão & Regra de 1 Hora (`src/state/`)
- [ ] Implementar limite de 1 hora de transmissão por sessão para contas gratuitas.
- [ ] Enviar avisos preventivos no Discord antes do encerramento (10min e 1min).
- [ ] Permitir tempo ilimitado para usuários doadores/VIP.

### 5. Docker & Infraestrutura AWS (`docker/` & `infra/`)
- [ ] Atualizar `Dockerfile` e `docker-compose.yml` para expor as portas HTTP/WSS.
- [ ] Definir arquitetura AWS com dispatcher em instância `t3.nano` e orquestração de workers.

### 6. Documentação & GitHub Pages (`docs/`)
- [ ] Configurar a pasta `/docs` para publicação no GitHub Pages.
- [ ] Adicionar tutoriais com prints/guias para os usuários do bot.

---

## 💡 Dúvidas & Questões em Aberto para Discussão

1. **Protocolo Web Audio Receiver**: Devemos usar **WebSocket (WSS)** com buffer PCM/Opus para maior simplicidade e facilidade de containerização, ou **WebRTC (MediaStream / WebRTC DataChannel)** para menor latência? (WebSocket WSS costuma ser suficiente para áudio com ~100ms de buffer).
2. **Integração de Doações**: Qual gateway/plataforma será usada para validar doadores automaticamente? (Ex: Livepix, Mercado Pago, Stripe, Patreon, ou verificação manual via comando admin/banco de dados?).
