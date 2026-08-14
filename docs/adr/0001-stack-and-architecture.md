# ADR 0001 — Stack e arquitetura base

**Status:** Aceito
**Data:** 2026-08-13

## Contexto

O produto é um jogo de futebol completo (carreira, competições, cartas,
economia, multiplayer, ranking global) com Discord como interface principal.
O repositório estava vazio — esta é a primeira decisão registrada.

## Decisão

- **Runtime:** Node.js 20+ (ambiente disponível: Node 22).
- **Linguagem:** TypeScript, `strict` habilitado, ESM (`"type": "module"`).
- **Discord:** `discord.js` v14 (Components V2 confirmado disponível na
  v14.27 instalada — `ContainerBuilder`, `SectionBuilder`,
  `TextDisplayBuilder`, `MediaGalleryBuilder`, flag `MessageFlags.IsComponentsV2`).
- **Banco de dados:** PostgreSQL, acessado via Prisma ORM (migrations,
  foreign keys, transações, tipagem gerada — atende à exigência explícita
  de não guardar o jogo em um JSON gigante).
- **IA narrativa:** Groq SDK, isolado atrás de uma camada de serviço que
  nunca escreve direto no banco (ver docs/DECISIONS de fases futuras).
- **Logging:** `pino` (structured JSON em produção, `pino-pretty` em dev).
- **Validação de ambiente:** `zod`, falha rápido no boot se faltar variável
  obrigatória.
- **Testes:** `vitest`.
- **Eventos internos:** `EventEmitter` do Node, tipado (ver
  `src/shared/eventBus.ts` e `src/events/types.ts`). Não introduzimos Redis/
  filas agora — não há justificativa de escala ainda (ver seção "Rejeitado").

## Estrutura de pastas

```
src/
  config/       # carregamento e validação de env
  shared/       # logger, error types, event bus — utilidades sem estado de domínio
  events/       # contrato (tipos) dos eventos de domínio
  database/     # cliente Prisma
  discord/      # client, registro de comandos, comandos
  game/         # motor de partida (Fase 3)
  ai/           # IA de gameplay — máquina de estados (Fase 3)
  identity/     # resolve Discord snowflake -> User.id interno (ports/adapters)
  player/       # perfil/personalização (ports/adapters/domain/services) — Fase 2
  career/       # carreira, treino, escalação (Fase 4)
  competitions/ # ligas, copas, temporadas (Fase 5)
  economy/      # coins, wallet, transações (Fase 6)
  cards/        # cartas, pacotes, inventário (Fase 7)
  marketplace/  # transferências, contratos (Fase 6)
  ranking/      # rankings, recordes, hall of fame (Fase 9)
  jobs/         # tarefas agendadas/assíncronas (conforme necessidade real)
prisma/
  schema.prisma # modelo relacional completo (ver docs/DATABASE.md)
tests/
  unit/
```

Pastas de fases futuras (`game`, `ai`, `career`, ...) existem apenas como
mapa de destino neste documento — não foram criadas vazias no repositório
para evitar diretórios sem conteúdo real (git não versiona diretório vazio,
e criar arquivos placeholder seria o tipo de "implementação disfarçada" que
o produto proíbe explicitamente).

## Rejeitado (e por quê)

- **Guardar estado do jogo em JSON/arquivo único:** inviabiliza queries,
  integridade referencial e concorrência. Rejeitado explicitamente pelo
  próprio briefing do produto.
- **Redis/filas/workers agora:** projetar para escala é importante, mas
  adicionar infraestrutura sem tráfego real para justificar é complexidade
  acidental. Fica documentado como próximo passo natural quando houver:
  (a) mais de um processo rodando o bot, ou (b) jobs que não podem rodar
  in-process (ex.: geração de notícia em lote). Ver RISK_REGISTER.md.
- **LLM (Groq) no caminho de gameplay:** Groq é usado apenas para camada
  narrativa (notícias, entrevistas, treinador). Toda decisão de partida é
  determinística, calculada pelo motor de jogo — nunca por um LLM.
- **SQLite para produção:** considerado para simplificar o boot inicial,
  mas rejeitado porque o modelo de dados já nasce com múltiplas foreign
  keys concorrentes (economia, cartas, transferências) que exigem
  garantias de transação/concorrência que o Postgres oferece de forma mais
  robusta. SQLite pode ser usado localmente se necessário, mas o schema é
  escrito para Postgres desde o início (evita reescrever migrations depois).

## Adenda (Fase 2) — ports & adapters para Discord/banco

`identity/` e `player/` seguem um padrão hexagonal explícito:
`domain/` (regras puras, sem I/O) → `ports/` (interfaces) → `adapters/`
(implementação real com Prisma + implementação em memória para teste) →
`services/` (casos de uso que dependem só da porta, nunca do adapter
concreto). Isso não é over-engineering gratuito — foi pedido explicitamente
para permitir testar toda a lógica de negócio sem credenciais reais e
trocar a implementação depois sem tocar em domínio/serviço. Módulos futuros
(economy, cards, competitions) devem seguir o mesmo padrão quando também
precisarem ser testáveis sem infraestrutura real.

## Consequências

- Toda integração com Discord/Groq/Postgres exige credenciais reais que
  este ambiente não possui (`DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`,
  `DATABASE_URL`, `GROQ_API_KEY`). O código está pronto para recebê-las via
  `.env`, mas testes de integração real (login no Discord, `prisma migrate
  dev` contra um banco de verdade) ficam bloqueados até o usuário fornecer
  esses valores.
- `npm run typecheck`, `npm run lint` e `npm test` (unitários) rodam sem
  nenhuma credencial.
