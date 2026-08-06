---
name: issue
description: Criar e publicar GitHub Issues a partir de solicitações, documentação ou planos em `.ai/plans/`, mantendo o artefato em `.ai/issues/`, evitando duplicatas e colocando cada issue no Project Kanban vinculado com status Backlog. Use quando Codex precisar criar uma issue, converter um plano em issue, registrar o número `#N` retornado pelo GitHub ou garantir o vínculo da issue com o Backlog do Project.
---

# Criar GitHub Issue

Criar uma issue por execução, salvo quando o usuário pedir explicitamente a decomposição em várias issues. Tratar criação da issue e entrada no Project como uma única operação lógica.

## Resolver o contexto

1. Resolver o repositório pelo `origin`; usar `RRC97/audio-bridge-discord-bot` neste projeto.
2. Ler a solicitação, o diff relevante e os planos em `.ai/plans/`. Preservar requisitos, correções e critérios de saída já revisados.
3. Ler `.ai/project.json` quando existir. Ele é o vínculo canônico entre checkout, repositório e GitHub Project.
4. Se o vínculo não existir, descobrir os Projects V2 abertos associados ao repositório. Aceitar automaticamente somente um resultado compatível; se houver zero ou mais de um, pedir a seleção do usuário.
5. Validar no Project:
   - pelo menos uma view com layout Kanban/`BOARD_LAYOUT`;
   - campo single-select `Status`;
   - opção `Backlog`.
6. Criar `.ai/project.json` sem credenciais após uma descoberta inequívoca:

```json
{
  "repository": "RRC97/audio-bridge-discord-bot",
  "owner": "RRC97",
  "projectNumber": 1
}
```

Nunca gravar tokens, IDs de opções mutáveis ou credenciais nesse arquivo. Resolver IDs GraphQL a cada publicação.

## Preparar o artefato local

1. Criar `.ai/issues/<slug>.md` com o corpo exato a publicar; não usar `.ai/plans/` como corpo publicável.
2. Criar `.ai/issues/<slug>.json` para rastreabilidade e retomada idempotente.
3. Manter o corpo autocontido, sem depender de arquivos locais ignorados.
4. Não publicar segredos, tokens, dados pessoais, URLs privadas ou instruções internas da IA.
5. Usar esta estrutura para o estado local:

```json
{
  "repository": "RRC97/audio-bridge-discord-bot",
  "title": "[Epic] Título objetivo",
  "githubIssueNumber": null,
  "githubIssueUrl": null,
  "projectNumber": null,
  "projectStatus": "pending"
}
```

No Markdown, usar as seções `Contexto`, `Objetivo`, `Escopo`, `Critérios de aceitação`, `Plano de implementação`, `Fora de escopo` e `Dependências e riscos` conforme forem relevantes.

Usar `githubIssueNumber: null` como indicador de rascunho. Se já houver número, retomar a associação ao Project em vez de criar outra issue.

## Verificar antes de publicar

1. Consultar issues abertas e fechadas por título normalizado e termos distintivos.
2. Se encontrar equivalente, não duplicar. Atualizar o artefato local com o número/URL existentes e continuar somente a vinculação ao Project.
3. Consultar labels existentes. Não inventar label em uma chamada de criação; usar apenas as que existem ou omitir labels.
4. Validar o assignee antes de atribuir. Neste repositório, preferir `RRC97` quando ele puder receber a issue.
5. Resumir no comentário ao usuário o repositório, título, assignee, labels e Project imediatamente antes da mutação.

## Publicar

1. Preferir o GitHub connector para consultar e criar a issue.
2. Usar `gh` como fallback quando o connector estiver indisponível e para GitHub Projects V2/GraphQL.
3. Capturar imediatamente `number` e `url` retornados.
4. Atualizar o JSON local com `githubIssueNumber` e `githubIssueUrl` antes de operar o Project.
5. Se a atualização do Project falhar, manter a issue criada no artefato e retomar a partir dela na próxima execução. Nunca recriar.

## Colocar no Kanban

1. Resolver os IDs atuais do Project, campo `Status` e opção `Backlog`.
2. Verificar se a automação do Project já adicionou a issue.
3. Se não adicionou, incluir a issue pelo URL.
4. Ajustar explicitamente `Status = Backlog`, mesmo quando houver auto-add.
5. Consultar novamente o item e confirmar o valor `Backlog`.
6. Atualizar o JSON local com `projectNumber` e `projectStatus: Backlog` somente após confirmação.

Não afirmar que a issue entrou no Backlog com base apenas em automação configurada. Confirmar o estado remoto.

## Finalizar

Retornar sempre:

```text
Issue criada: #N — <título>
URL: <url>
Project: #P — <nome>
Status: Backlog (confirmado)
Artefatos: .ai/issues/<slug>.md e .ai/issues/<slug>.json
```

Se houver falha parcial, trocar “criada” por “localizada/criada” conforme o caso, identificar exatamente o passo pendente e nunca inventar `#N`, Project ou status.

## Restrições

- Não criar múltiplas issues sem solicitação explícita.
- Não criar ou alterar Project, view, campo ou opção de status sem autorização explícita.
- Não fechar, reabrir ou editar issue existente somente por semelhança; confirmar identidade primeiro.
- Não usar arquivo de plano ignorado como única fonte de verdade após a publicação.
- Não considerar a tarefa concluída até confirmar issue e `Backlog`, ou relatar o bloqueio de autenticação/permissão.
