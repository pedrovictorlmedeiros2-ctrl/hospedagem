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

## Adenda (Fase 3) — escopo do motor de partida

O motor (`src/game/`) é **puro e sem I/O**: recebe dois `MatchSquad` (11
titulares + banco, atributos, estilo) e um seed, devolve um `MatchResult`
determinístico (placar, eventos, estatísticas por jogador). Decisões
registradas:

- **Zona abstrata (0-4), não física contínua.** Modelar posição em grade
  X/Y contínua com colisão/movimento por jogador é um projeto à parte (e
  não determinístico o suficiente para testar/auditar sem uma engine de
  física real). O briefing pede "não usar LLM para física/movimentação" —
  a alternativa não-LLM mais simples que ainda produz motor real e
  testável é discretizar o campo em 5 zonas (área do mandante → terço →
  meio-campo → terço → área do visitante) e resolver cada minuto como uma
  disputa de atributos (ataque vs defesa), não uma simulação espacial.
  Revisitar isso é um projeto de polimento futuro, não um bloqueador para
  ter um motor real funcionando.
- **RNG seedada e determinística** (`src/game/domain/rng.ts`), não
  `Math.random()`. O mesmo seed sempre produz o mesmo jogo — isso é o que
  permite auditoria anti-cheat (`Match.simulationSeed`, já modelado no
  schema desde a Fase 1) e testes de regressão reais no motor.
- **Sem persistência em `Match`/`Team`/`Season` ainda.** Essas entidades
  modelam estrutura competitiva real (temporada, competição, elenco de
  clube) que não existe até a Fase 4 (Career/calendário) e Fase 5
  (Competitions). Forçar uma partida de teste a preencher essas FKs
  exigiria fabricar registros falsos de temporada/clube só para satisfazer
  o schema — poluindo dados reais com fixtures de teste. Em vez disso, o
  motor emite `MATCH_STARTED`/`MATCH_FINISHED` no event bus (já modelado
  na Fase 1); a Fase 4/5 é quem vai persistir de verdade, quando houver um
  calendário/competição real para a partida pertencer.
- **Goleiro manual (controle do usuário por botão) fica para depois.**
  Interação ao vivo por botão a cada lance exige uma camada de UI Discord
  com estado por partida/timers que ainda não existe (é um projeto de
  interface à parte, não do motor). O motor já modela o goleiro
  estatisticamente (reflexo/posicionamento/1x1/pênaltis) — controle manual
  é uma camada de override em cima disso, adicionada quando a UI ao vivo
  existir.

## Adenda (Fase 4) — carreira e a primeira persistência real de partida

`src/career/` segue o mesmo padrão ports/adapters. Decisões específicas:

- **Só o jogador real vira `TeamPlayer`/`MatchEvent.playerId`/
  `MatchPlayerStat`.** Companheiros e adversários sintéticos (gerados por
  `generateSquad`) nunca têm uma linha `Player` — não existe FK para
  apontar. `MatchRepository.persistMatchResult` filtra por
  `matchPlayerInputId` explicitamente; eventos de jogadores sintéticos
  são gravados com `playerId: null` (o evento continua existindo, só não
  aponta pra ninguém).
- **`PlayerSeasonStat` tem um dono só: `MatchRepository`.** A primeira
  versão desta feature tentou deixar `CareerRepository` também ler/gravar
  season stats para a lógica de progressão de estágio — isso criava dois
  repositórios com estado potencialmente inconsistente entre si nos
  adapters em memória (testáveis) que não compartilham dados como o
  Postgres real compartilharia. Resolvido fazendo
  `persistMatchResult` devolver o agregado da temporada já atualizado
  (`PersistedMatch.seasonStat`), então quem precisa dele (progressão de
  estágio) usa esse retorno, sem uma segunda leitura cross-repositório.
- **`Injury` é gravado separado de `Match`, não na mesma transação.**
  Uma lesão é estado de carreira/aptidão física, não um fato do
  resultado da partida — arquiteturalmente pertence ao
  `CareerRepository`. Isso significa que, em teoria, uma partida pode
  ser persistida e o registro de lesão falhar logo em seguida (dois
  passos, não uma transação cross-repositório). Aceito conscientemente:
  o pior caso é o jogador não ser banido da escalação por uma lesão que
  "deveria" tê-lo banido — não é corrupção de dado, é um efeito colateral
  perdido. Ver RISK_REGISTER.md.
- **`Club.externalKey` e `Team.[clubId,seasonId]` únicos** foram
  adicionados ao schema (migration regenerada) para permitir
  get-or-create idempotente e à prova de corrida real (upsert + captura
  de P2002), no mesmo padrão do `User.discordId` da Fase 2 — em vez de
  "buscar por nome, criar se não achar", que teria uma janela de corrida
  real.
- **Clubes rivais são um pool fixo compartilhado** (`RIVAL_CLUB_KEYS`),
  não gerados um por usuário — todas as carreiras do "mundo" jogam contra
  os mesmos adversários, reforçando a ideia de mundo compartilhado em vez
  de universos paralelos por jogador.

## Consequências

- Toda integração com Discord/Groq/Postgres exige credenciais reais que
  este ambiente não possui (`DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`,
  `DATABASE_URL`, `GROQ_API_KEY`). O código está pronto para recebê-las via
  `.env`, mas testes de integração real (login no Discord, `prisma migrate
  dev` contra um banco de verdade) ficam bloqueados até o usuário fornecer
  esses valores.
- `npm run typecheck`, `npm run lint` e `npm test` (unitários) rodam sem
  nenhuma credencial.
