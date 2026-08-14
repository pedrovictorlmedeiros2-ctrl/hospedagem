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

## Adenda (Fase 5) — liga real substitui adversário aleatório

A Fase 4 escolhia um rival aleatório do pool fixo a cada `/jogar-carreira`
— não era uma competição de verdade, era uma sequência de amistosos. A
Fase 5 substitui isso por uma liga real: `Competition`/`Tournament` (já
modelados desde a Fase 1) ganham conteúdo — calendário gerado (método do
círculo, turno e returno), classificação calculada a partir dos
`Match`es reais, e `/jogar-carreira` agora joga a próxima rodada
agendada, não mais um oponente sorteado.

Decisões de escopo:

- **Liga primeiro, mata-mata depois.** O motor de chave eliminatória
  (`generateKnockoutBracket`) é implementado e testado no domínio, mas
  não conectado a nenhum comando Discord ainda — não existe ainda uma
  segunda competição (copa) para ele orquestrar de verdade, e conectar
  um mata-mata a uma única partida de carreira por vez exigiria decidir
  fase de grupos + classificação cruzada, o que é escopo de uma fase
  própria, não um apêndice da Fase 5.
- **Convocação para seleção fica adiada.** Depende de agregação de
  desempenho entre múltiplas temporadas/competições (o briefing pede
  "trajetória plausível") — implementar isso raso agora seria fingir uma
  feature que não existe de verdade. Fica para quando houver mais de uma
  temporada real para avaliar.
- **`MatchRepository.persistMatchResult` ganhou um `existingMatchId`
  opcional.** As rodadas da liga são criadas como `Match` reais com
  `status: SCHEDULED` no momento em que a liga é gerada (não só quando
  são jogadas) — isso é o que permite `getNextFixtureForTeam` consultar
  "qual é o próximo jogo agendado do meu time" com uma query SQL comum,
  em vez de reconstruir o calendário a cada chamada. Jogar uma rodada
  então *atualiza* essa linha existente para `FINISHED`, em vez de criar
  uma linha nova (que duplicaria a partida no calendário).
- **Casa/visitante agora é real, não sempre "o jogador é mandante".** A
  Fase 4 tratava o clube do jogador como mandante em toda partida, o que
  não é realista. A Fase 5 respeita o lado definido pelo calendário
  gerado (turno e returno alternam mandante/visitante), e
  `playCareerMatch` monta os dois elencos de acordo.

## Adenda (Fase 6) — Economy: ledger + 1 fonte + 1 sumidouro, mercado adiado

`src/economy/` entra como um novo contexto hexagonal, consumido pelos
contextos `career`/`discord` como uma porta comum (`WalletRepository`),
no mesmo padrão de composição multi-contexto que `playCareerMatch` já
usava para `game`/`competitions`/`career`. `Wallet`/`WalletTransaction`
já existiam no schema desde a Fase 1 como ledger append-only — esta fase
é a primeira a escrever de verdade neles.

Decisões de escopo:

- **Coins + recompensas + 1 sumidouro agora; mercado/transferências/
  contratos ficam para depois.** O plano original definia a Fase 6 como
  "Coins; recompensas; mercado; transferências; contratos" — um escopo
  que inclui, dentro da mesma fase, tanto a fundação do ledger quanto um
  sistema de negociação completo (avaliação de valor de mercado,
  proposta/contraproposta, expiração de janela, IA de clube decidindo o
  que aceitar). Implementar as duas coisas na mesma passada arriscaria
  exatamente o que a regra fundamental deste projeto pede para eu
  recusar: entregar uma economia mal testada e potencialmente explorável
  só para "bater o requisito" da fase. Entreguei o ledger sólido,
  auditável e testado contra duplicação/corrida — que É o pré-requisito
  de segurança para qualquer economia — mais uma fonte (recompensa de
  partida) e um sumidouro (treino intensivo pago) reais e integrados, e
  registrei mercado/transferências/contratos como não iniciados (ver
  ROADMAP.md, Risco #4 atualizado em RISK_REGISTER.md).
- **`WalletRepository.applyTransaction` é o único ponto de escrita em
  `Wallet.coins`/`Wallet.tokens`.** Nunca uma mutação direta — sempre
  atrelada a criar a `WalletTransaction` correspondente na mesma operação
  atômica, para que saldo e ledger nunca divirjam.
- **Idempotência via `idempotencyKey` único é o único mecanismo
  antiduplicação, e é suficiente.** No adapter Prisma: `$transaction` com
  `increment`/`decrement` atômico seguido da tentativa de criar a
  `WalletTransaction`; uma chave repetida colide no `@unique` (`P2002`),
  o que desfaz a transação inteira automaticamente (mesmo padrão de
  `PrismaUserRepository.ensureUserForDiscordId`), e o adapter trata isso
  como "já aplicado" em vez de erro. No adapter in-memory: nenhum `await`
  entre a checagem de idempotência e a escrita, o que no runtime
  single-threaded do Node basta para atomicidade entre chamadas
  concorrentes — verificado com um teste explícito de `Promise.all`. A
  chave da recompensa de partida (`match-reward:<matchId>`) tem um efeito
  colateral bom: protege a recompensa até contra a corrida já documentada
  em `getNextFixtureForTeam` (ver Risco #17), sem precisar de nenhum
  código extra.
- **Sumidouro escolhido a dedo para não abrir uma via de exploração
  óbvia.** Treino intensivo (dobra o ganho de UMA sessão de `/treinar`)
  foi escolhido porque compartilha o cooldown de 20h e o custo de
  estamina da sessão normal — coins nunca compram uma sessão EXTRA, só um
  resultado melhor da sessão que o jogador já teria direito. Um sumidouro
  que removesse o cooldown teria sido a "ideia ruim" que a regra
  fundamental pede para eu recusar em vez de implementar calado.
- **Pesos de recompensa são heurística de v1, não calibração real** —
  mesma categoria de risco aceito que os pesos de IA do motor de partida
  (Risco #12).

## Adenda (Fase 6b) — mercado, contratos e transferências fecham a Fase 6

Continuação direta da adenda anterior: implementa o restante do escopo
original da Fase 6 ("mercado; transferências; contratos") que havia sido
conscientemente adiado.

Decisões de escopo e arquitetura:

- **`ensureCareerStarted` tinha um bug estrutural que bloqueava
  transferências de verdade.** Ele sempre reresolvia o clube do jogador
  por `starter-club:<nacionalidade>`, nunca lendo `Career.currentClubId`
  — então mesmo que uma transferência atualizasse esse campo, a próxima
  chamada de qualquer comando de carreira devolvia o jogador ao clube
  inicial silenciosamente. Corrigido: o clube atual agora vem de
  `career.currentClubId` (via novo `CareerRepository.getClubById`)
  sempre que a carreira já existe; a resolução por nacionalidade só roda
  no bootstrap de uma carreira nova. `CareerRepository` ganhou também
  `getClubByTeamId` (resolve o clube adversário genericamente, não só
  pela lista fixa de rivais — necessário porque depois de uma
  transferência o adversário pode ser o antigo clube do jogador, que
  nunca esteve na lista de rivais), `leaveRoster` e `updateCareerClub`.
- **A composição da liga (`buildLeagueTeams`) não pode depender do clube
  ATUAL do jogador.** Bug real encontrado pelos próprios testes (não por
  revisão manual): ao gerar a liga usando o time atual do jogador
  pós-transferência, esse time já é um dos 6 rivais, duplicando um id e
  derrubando `generateRoundRobinFixtures`. Corrigido com
  `ensureStarterTeam` — a composição da liga (clube inicial fixo da
  nacionalidade + 6 rivais) é resolvida independentemente de quem
  atualmente representa qual clube. Reforça a mesma decisão da Fase 5:
  a liga é "mundo compartilhado", não recalculada por jogador.
- **Transferência paga um bônus de assinatura (15% da taxa), não a taxa
  inteira.** Pagar a taxa completa ao jogador a cada transferência
  permitiria farm de coins saltando repetidamente entre os 6 rivais.
  Modelado de forma mais realista também: no futebol de verdade a taxa é
  paga pelo clube comprador ao clube vendedor, não ao jogador — só um
  bônus de assinatura é dele. `Transfer.fee` continua registrando a taxa
  cheia (para histórico/flavor), só o valor efetivamente creditado na
  carteira é menor.
- **Cooldown real de 30 dias entre transferências**
  (`canTransferNow`/`MIN_DAYS_BETWEEN_TRANSFERS`), não só uma
  `idempotencyKey`. Uma idempotencyKey por dia protegeria só contra
  repetir a MESMA transferência no mesmo dia — sem um cooldown de
  verdade, nada impediria encadear transferências para clubes
  DIFERENTES em sequência. Mesmo padrão de `TrainingCooldownError`.
- **Proposta de transferência é determinística, não persistida.** Igual
  ao truque já usado no treino intensivo (Fase 6): a oferta de cada
  clube é derivada de um RNG seedado por (jogador, clube, dia do
  calendário) — `/propostas` (consulta) e `/transferir` (aceite) sempre
  concordam no mesmo valor no mesmo dia sem precisar de uma tabela nova
  de propostas pendentes.
- **Transferência só entre o clube atual e os 6 rivais da MESMA liga
  (mesma nacionalidade).** Transferência internacional exigiria unir
  duas ligas/calendários distintos — fora de escopo. Também não é
  possível voltar ao clube inicial depois de sair dele (não faz parte do
  pool de rivais) — limitação aceita do modelo de pool fixo, documentada
  no ROADMAP.
- **Mercado de compra/venda de jogadores sintéticos não foi
  implementado, e não é um adiamento — é incompatível com a arquitetura
  atual.** Só existe UM jogador real por partida simulada (Fase 3); os
  outros 21 são sintéticos e regenerados a cada partida, não são
  entidades persistentes negociáveis. Um mercado de compra/venda faria
  sentido para uma arquitetura com elencos multi-jogador-real, que este
  produto não tem.

## Adenda (Fase 7) — Cards: catálogo fixo sem migração, idempotência por interaction.id

`src/cards/` entra como um novo contexto hexagonal, consumindo
`WalletRepository` (economy) do mesmo jeito que `career` já consome
`economy`/`competitions`/`game` — composição multi-contexto na camada de
serviço, não acoplamento de domínio.

Decisões de arquitetura:

- **Catálogo fixo (cartas + pacotes + odds) é get-or-criado por id
  explícito, sem nenhuma coluna nova no schema.** `Card.id`/`CardPack.id`
  já aceitam um valor explícito no `create` do Prisma em vez do
  `cuid()` default — então um pool fixo e legível de ids
  (`"card-legendary-01"`, `"pack-ouro"`) definido como constantes
  TypeScript (`cards/domain/catalog.ts`) basta para o mesmo padrão de
  "mundo compartilhado, get-or-create idempotente" já usado nos clubes
  rivais (Fase 4/5), sem precisar de uma migração nova nem de um script
  de seed separado.
- **A idempotência do sorteio de pacote precisou de mais cuidado que a
  do resto da economia.** Nas fontes/sumidouros anteriores (Fase 6), a
  idempotencyKey vinha de algo já estável por natureza — um `matchId`
  real, ou um bucket de dia de calendário. Abrir um pacote não tem
  equivalente óbvio: é uma ação sob demanda, não presa a uma partida nem
  a "uma vez por dia". A primeira versão gerava um nonce aleatório
  dentro do próprio serviço — o que protege contra chamada repetida
  DENTRO da mesma invocação, mas um retry genuíno da interação do
  Discord (webhook reentregue, timeout de rede) geraria um nonce novo a
  cada tentativa, então o pagamento seria idempotente mas o sorteio de
  cartas NÃO seria — um retry legítimo do jogador poderia ganhar cartas
  de graça. Corrigido antes de escrever qualquer teste: a idempotencyKey
  vem de `interaction.id` (passado explicitamente pela camada Discord
  como `requestId`, nunca gerado dentro do serviço), e essa mesma chave
  seedeia o RNG do sorteio e vira o id explícito do `PackOpening`
  (mesmo truque de id explícito usado no catálogo) — um retry genuíno
  reproduz o mesmo sorteio E colide no id primário do `PackOpening`,
  então `CardRepository.recordPackOpening` devolve as cartas já
  sorteadas em vez de criar um segundo lote (mesmo padrão de captura de
  `P2002` já usado em `PrismaWalletRepository`/`PrismaUserRepository`).
- **Ordem das operações em `openPack`: debitar a carteira PRIMEIRO,
  sortear/persistir cartas DEPOIS.** Minimiza o pior caso de uma queda
  no meio do caminho — "pago mas sem cartas ainda" é recuperável com um
  retry (mesmo `requestId` reproduz o mesmo sorteio), enquanto a ordem
  inversa arriscaria conceder cartas sem cobrar. Mesma categoria de
  risco/mitigação já aceita para Match/Injury e FixtureResult/
  MatchResult.
- **Cartas não afetam gameplay nesta fase.** É uma camada de
  colecionismo isolada — nenhuma carta altera squads, partidas ou
  atributos do jogador real ainda. Conectar cartas ao motor de partida é
  um gancho natural para uma fase futura, mas fazer isso agora
  misturaria a validação do loop de colecionismo com a do motor de
  partida antes de qualquer um dos dois estar provado sozinho — mesma
  disciplina de separação de escopo já usada em toda fase anterior.

## Consequências

- Toda integração com Discord/Groq/Postgres exige credenciais reais que
  este ambiente não possui (`DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`,
  `DATABASE_URL`, `GROQ_API_KEY`). O código está pronto para recebê-las via
  `.env`, mas testes de integração real (login no Discord, `prisma migrate
  dev` contra um banco de verdade) ficam bloqueados até o usuário fornecer
  esses valores.
- `npm run typecheck`, `npm run lint` e `npm test` (unitários) rodam sem
  nenhuma credencial.
