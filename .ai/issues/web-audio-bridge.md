## Contexto

O bot atual captura áudio no host em que o processo Node.js está executando, usando `parec`/PipeWire no Linux ou FFmpeg/WASAPI no Windows. Esse desenho não acessa o áudio do computador de um usuário quando o bot roda remotamente em Docker ou AWS.

A arquitetura alvo substitui essa origem local por uma Web Audio Bridge: `/play` conecta o bot ao canal de voz e devolve uma URL temporária; o usuário abre a página, autoriza a captura de uma superfície pelo navegador e somente o áudio é enviado ao servidor para codificação Opus e retransmissão ao Discord.

## Objetivo

Entregar um MVP executável em Docker que transmita áudio autorizado pelo usuário do navegador ao canal de voz do Discord, com sessão segura, limite de 60 minutos para usuários gratuitos, entitlement desacoplado para apoiadores e documentação coerente com o estado real do projeto.

## Escopo

- Corrigir README, arquitetura, roadmap, instruções de agentes e documentação da issue para separar estado atual de arquitetura alvo.
- Implementar servidor HTTP e WebSocket integrado ao processo Node.js.
- Criar frontend de captura com `getDisplayMedia()`, `AudioContext` e `AudioWorklet`.
- Enviar PCM `s16le`, 48 kHz, estéreo, em quadros de 20 ms/3.840 bytes por WSS.
- Validar, limitar e encaminhar o PCM para o encoder Opus e `AudioPlayer` existentes.
- Reformular `/play`, `/pause`, `/leave` e adicionar `/status`.
- Manter `/join` como comando opcional e remover `/select` após a migração.
- Implementar tokens temporários, uso único, reconexão controlada e cleanup idempotente.
- Aplicar limite de 60 minutos a partir do primeiro quadro válido.
- Criar Dockerfile multi-stage, `compose.yaml`, healthchecks e shutdown gracioso.
- Validar compatibilidade real por navegador, sistema operacional e superfície capturada.
- Preparar documentação pública para GitHub Pages.
- Planejar entitlement de apoiadores e arquitetura AWS com dispatcher `t3.nano` e workers sob demanda.

## Decisões do MVP

- Usar WSS com PCM produzido por `AudioWorklet`; WebRTC/mediasoup fica para reavaliação após medições.
- Suportar inicialmente Chrome, Edge e Brave desktop somente nas combinações aprovadas pela matriz de testes.
- Solicitar áudio e vídeo em `getDisplayMedia()`, pois vídeo é obrigatório nessa API; parar as tracks de vídeo imediatamente e nunca enviá-las ao backend.
- Descrever HTTPS/WSS como criptografia em trânsito, não ponta a ponta.
- Tratar a URL como segredo bearer. Vincular o token ao usuário no servidor não autentica quem abriu o navegador; Discord OAuth2 fica fora do MVP.
- Coordenar uma sessão ativa por guild, identificada por `sessionId`, em vez de manter apenas `Map<userId, UserSession>`.
- Iniciar os 60 minutos no primeiro quadro PCM válido. Pausa não reinicia nem estende a sessão.
- Não persistir áudio nem vídeo.
- Remover linguagem de “contorno de licença” e exigir uso autorizado, conformidade com os termos do Discord e respeito a direitos autorais.

## Plano de implementação

### 1. Alinhar documentação e baseline

- [ ] Corrigir recursos descritos como prontos que ainda não existem: Web Bridge, Docker, AWS, `/status` e GitHub Pages.
- [ ] Registrar a decisão WSS + PCM + AudioWorklet na arquitetura.
- [ ] Corrigir compatibilidade, criptografia, privacidade e linguagem de licenciamento.
- [ ] Resolver ou remover referências inexistentes, incluindo `LICENSE` e comandos Docker ainda indisponíveis.

### 2. Criar a fundação web

- [ ] Adicionar servidor HTTP/WSS, configuração validada, lifecycle e shutdown ordenado.
- [ ] Implementar `/health/live` e `/health/ready`.
- [ ] Adicionar headers de segurança, CSP, `Origin` allowlist e limites de socket.
- [ ] Adicionar testes unitários e de integração ao projeto.

### 3. Reformular sessões e tokens

- [ ] Indexar sessões por `sessionId` e sessão ativa por `guildId`.
- [ ] Implementar máquina de estados de criação, espera, streaming, pausa, reconexão e término.
- [ ] Gerar token CSPRNG, guardar somente hash, aplicar TTL curto e consumo único.
- [ ] Implementar credencial rotacionada para reconexão e cleanup idempotente.
- [ ] Implementar timer gratuito, avisos aos 50/59 minutos e `EntitlementProvider` com allowlist inicial.

### 4. Implementar captura no navegador

- [ ] Exigir gesto explícito para chamar `getDisplayMedia({ video: true, audio: true })`.
- [ ] Validar a faixa de áudio e parar todas as tracks de vídeo imediatamente.
- [ ] Converter Float32 para PCM s16le estéreo a 48 kHz em `AudioWorklet`.
- [ ] Agrupar quadros de 960 amostras por canal e limitar `WebSocket.bufferedAmount`.
- [ ] Exibir estados e erros claros e interromper recursos ao parar/fechar a captura.

### 5. Integrar receiver, Opus e Discord

- [ ] Autenticar o primeiro frame de controle antes de aceitar mensagens binárias.
- [ ] Aceitar somente quadros de 3.840 bytes dentro dos limites de taxa.
- [ ] Implementar buffer limitado e descarte de áudio atrasado.
- [ ] Corrigir o tratamento de backpressure atual de `createOpusStream()`.
- [ ] Iniciar o timer no primeiro quadro válido e descartar PCM durante a pausa.
- [ ] Testar tom PCM sintético até a geração de pacotes Opus sem depender do Discord real.

### 6. Atualizar comandos e remover captura local

- [ ] Fazer `/play` conectar, criar/rotacionar a sessão e responder com link ephemeral.
- [ ] Implementar `/status` e tornar `/pause` um toggle coerente.
- [ ] Autorizar corretamente `/leave` e encerrar todos os recursos.
- [ ] Remover `/select` do registry/deploy.
- [ ] Remover capturadores locais somente após o fluxo Web E2E passar.

### 7. Entregar Docker e hardening

- [ ] Criar Dockerfile multi-stage Node 22 com Opus nativo e usuário sem root.
- [ ] Criar `compose.yaml`, `.dockerignore`, healthcheck e configuração de TLS por proxy/load balancer.
- [ ] Testar build e smoke a partir de clone limpo.
- [ ] Medir CPU, heap, banda, frames descartados e latência com múltiplas sessões.
- [ ] Testar replay, origem inválida, flood, quedas, concorrência e encerramento abrupto.

### 8. Documentar, integrar apoiadores e evoluir para AWS

- [ ] Publicar documentação estática separada da página runtime `/share`.
- [ ] Definir provedor de doação, webhook, entitlement persistente, revogação e privacidade.
- [ ] Validar `t3.nano` somente como controller; ela não deve processar nem retransmitir mídia.
- [ ] Definir endpoint TLS estável, roteamento, startup e lifecycle dos workers.
- [ ] Implementar infraestrutura como código, IAM mínimo, TTL, reconciler de órfãos, quotas e kill switch.

## Critérios de aceitação

- [ ] `/play` fora de canal não cria sessão; dentro de canal retorna link ephemeral de uso único.
- [ ] Link expirado, reutilizado ou com origem inválida não inicia mídia.
- [ ] Fonte sem áudio mostra erro; nenhum payload de vídeo chega ao backend.
- [ ] O áudio capturado no navegador é audível no canal correto e não usa áudio do host do bot.
- [ ] Outro usuário da guild não assume a sessão ativa.
- [ ] Pausar não acumula buffer; retomar funciona; `/status` permanece coerente.
- [ ] `/leave`, fechamento da aba, timeout, expiração e sinais do container limpam recursos.
- [ ] A sessão gratuita termina após 60 minutos de transmissão efetiva.
- [ ] Entitlement remove somente o limite de negócio e mantém timeouts de segurança.
- [ ] Produção exige HTTPS/WSS e não registra tokens nem payload de áudio.
- [ ] Docker sobe de clone limpo, passa healthcheck e executa o fluxo E2E.
- [ ] Limitações de navegador e estado de implementação estão documentados sem promessas indevidas.

## Fora de escopo do MVP

- Discord OAuth2 na página de captura.
- WebRTC/mediasoup, salvo se o spike de WSS reprovar os limites definidos.
- Compatibilidade garantida com Firefox, Safari ou todas as superfícies de todos os sistemas.
- Integração automática com um gateway de pagamento antes da interface de entitlement.
- Provisionamento AWS antes do MVP Docker ser medido e aprovado.

## Dependências e riscos

- A disponibilidade do áudio em `getDisplayMedia()` varia por navegador, sistema operacional e superfície.
- PCM estéreo a 48 kHz consome aproximadamente 1,536 Mbit/s por stream antes de overhead; medir antes de dimensionar workers.
- O link é bearer no MVP e deve ter TTL, uso único, hash no servidor e proteção contra vazamento.
- O bot possui uma conexão de voz por guild; concorrência precisa ser rejeitada ou coordenada.
- A `t3.nano` tem recursos limitados e CPU burstable; validar o controller por carga e memória.
- A criação de workers exige endpoint TLS estável, IAM mínimo, quotas e limpeza de recursos órfãos.
