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

## Adenda (Fase 8) — Multiplayer: duelo real reaproveita o motor, sem fila de matchmaking

`src/multiplayer/` entra como um novo contexto hexagonal. É a primeira
fase onde os DOIS lados de uma interação são jogadores reais — toda fase
anterior era "o usuário que chama o comando vs. o mundo compartilhado"
(clube, mercado, cartas).

Decisões de arquitetura:

- **Matchmaking v1 é desafio direto por menção do Discord
  (`/duelo-desafiar usuario:@Fulano`), não uma fila automática de
  pareamento.** Uma fila real (pareamento por rating, com concorrência
  entre múltiplos usuários entrando ao mesmo tempo) é infraestrutura de
  verdade que não deveria ser construída sem tráfego real que a
  justifique — mesma decisão já registrada no Risco #7 ("não adicionar
  infraestrutura sem dados reais"). Desafio direto entrega "duelos
  multiplayer existem e funcionam de ponta a ponta" sem esse
  investimento.
- **O duelo é resolvido pelo motor de partida já existente (Fase 3), sem
  nenhuma mudança nele.** `buildSquadFromProfile` já monta "um jogador
  real + 10 sintéticos"; um duelo simplesmente chama essa função duas
  vezes (uma pra cada jogador real) em vez de uma vez + adversário
  totalmente sintético (como `playCareerMatch` faz). Prova que o motor
  foi desenhado com generalidade suficiente desde a Fase 3.
- **O resultado do duelo não vira `Match`/`MatchEvent` persistido —
  `Duel.matchId` fica null.** Mesma decisão estrutural do
  `/simular-amistoso` (adenda Fase 3): não existe `Team`/`Club` natural
  pra ancorar um 1x1 entre pessoas, e criar times descartáveis só pra
  satisfazer as chaves estrangeiras de `Match` seria forçar o modelo.
  Documentado como decisão consciente, não lacuna.
- **`Player.globalRating` ganhou um valor inicial de verdade
  (`STARTING_GLOBAL_RATING = 1000`), sem migração de schema.** O
  `@default(0)` do schema era inofensivo enquanto nada lia esse campo —
  mas o primeiro duelo de qualquer jogador calcularia um gap de rating
  absurdo contra qualquer adversário que já tivesse jogado. Corrigido
  passando `globalRating` explicitamente em `NewPlayerRecord` (mesmo
  princípio de "valor explícito no create em vez de depender do default
  da coluna" já usado nos ids fixos do catálogo de cartas, Fase 7).
- **Ordem das operações em `respondToDuel`: resolver o duelo (transição
  guardada PENDING → FINISHED) ANTES de atualizar rating e pagar
  recompensa.** Inverte a ordem usada no resto da economia (Fases 6/7,
  onde a operação idempotente do wallet vem primeiro) por um motivo
  específico: `Player.globalRating` é um valor absoluto sem nenhum
  mecanismo de idempotência próprio (não é um lançamento de ledger como
  `WalletTransaction`). Se a ordem fosse "rating primeiro, duelo
  depois", um retry genuíno após um crash reaplicaria o ELO uma segunda
  vez — corrompendo o rating, não só deixando algo incompleto. Com a
  transição do duelo como trava primeira, o pior caso de uma queda no
  meio do caminho é "duelo resolvido mas rating/recompensa ainda não
  aplicados" — incompleto e recuperável, não corrompido — mesma
  categoria de risco já aceita em Injury/Match, FixtureResult/
  MatchResult e Contract/Transfer, mas com a ordem das operações
  escolhida deliberadamente diferente para caber na garantia mais fraca
  que uma atualização de rating oferece.
- **`UserRepository` ganhou `getById`** (Discord id → id interno já
  existia via `ensureUserForDiscordId`; o caminho inverso não). Listar
  duelos precisa resolver `challengerId`/`opponentId` (ids internos,
  gravados no `Duel`) de volta para o `discordId` que a UI do Discord
  consegue mostrar/mencionar.
- **Tier (`DuelTier`) não restringe quem pode desafiar quem — é só um
  rótulo derivado da faixa de rating no momento do desafio.** Uma
  restrição de verdade (só desafiar tiers próximos) é uma decisão de
  produto que merece dados reais de uso antes de ser imposta como regra
  rígida.

## Adenda (Fase 9) — Global: ranking ao vivo, recordes append-only, rivalidades canonicalizadas; temporadas adiadas

`src/global/` entra como um novo contexto hexagonal, mas ao contrário de
toda fase anterior ele não tem um "fluxo principal" próprio — ele lê e
reage a eventos de OUTROS contextos (`career/`, `multiplayer/`).

Decisão de escopo (registrada primeiro, porque moldou o resto): o pedido
original de Fase 9 é "top global, recordes, rivalidades, Hall of Fame,
temporadas". Investigando o código antes de implementar, encontrei que
`getOrCreateActiveSeason` (`career/adapters/prismaCareerRepository.ts`) é
hardcoded para a temporada 1, e `leagueNameFor` (`career/services/
ensureLeagueTeams.ts`) nomeia a liga só pela nacionalidade, sem incluir o
número da temporada. Ou seja: rollover de temporada é uma feature grande,
separada, e hoje **inalcançável** — não existe nenhum caminho no código
atual que leve a uma temporada 2. Implementar um rollover sem também
resolver o `leagueNameFor` (que faria a liga da temporada 2 colidir com a
da temporada 1, mesmo nome) não teria nenhum benefício funcional, e nada
disso seria validável de ponta a ponta neste ambiente (sem banco real, sem
como avançar pra temporada 2 e observar o resultado). Decisão: implementar
ranking/recordes/rivalidades por completo — o núcleo concreto e alcançável
de "Global" — e documentar o gap de `leagueNameFor`/rollover como risco
específico e acionável (ver RISK_REGISTER.md), em vez de entregar uma
versão rasa de tudo. Mesmo princípio já usado nas Fases 3 e 8 de recusar
escopo que não pode ser provado no ambiente atual.

Decisões de arquitetura:

- **Ranking (`/ranking`) é computado ao vivo a cada chamada, sem tabela de
  snapshot.** `PlayerRepository` ganhou `listTopPlayers(metric, limit)`
  (ORDER BY + LIMIT direto no Prisma / sort em memória no fake) em vez de
  um `RankingSnapshot` persistido e recalculado por job. Com a escala atual
  (sem tráfego real), uma query ordenada é instantânea e sempre correta;
  um snapshot introduziria staleness e um job de recorrência que nada
  ainda justifica — mesmo raciocínio do Risco #7 ("não adicionar
  infraestrutura sem dados reais") já aplicado ao matchmaking da Fase 8.
- **`Record` é append-only por desenho do schema — não tem unique
  constraint em `category` sozinho.** Cada recorde quebrado grava uma
  linha nova em vez de fazer update na existente, preservando o histórico
  completo de quem já foi dono do recorde. `RecordRepository.
  getCurrentRecord` lê a linha mais recente por `achievedAt`;
  `setRecord` nunca faz update, só create. `checkAndUpdateRecord`
  (`global/services/checkAndUpdateRecord.ts`) é check-then-act, não
  transacional — mesma categoria de risco de corrida já aceita em
  `getOrCreateSeasonLeague` (Fase 5): numa corrida real entre dois eventos
  simultâneos batendo o mesmo recorde, o pior caso é uma linha de
  histórico a mais/perdida, nunca um valor corrompido.
- **`Rivalry.playerAId`/`playerBId` tem `@@unique([playerAId, playerBId])`,
  que é direcional** — sem canonicalização, o mesmo par de jogadores
  poderia acabar em duas linhas diferentes dependendo de quem desafiou
  quem primeiro, fragmentando o histórico. `canonicalizeRivalryPair`
  (`global/domain/rivalry.ts`) ordena os dois ids lexicograficamente antes
  de toda leitura/escrita, garantindo uma única linha por par
  independente da direção do confronto.
- **Dois recordes no lançamento: `HIGHEST_GLOBAL_RATING` (checado em
  `respondToDuel`, após a atualização de ELO) e `MOST_GOALS_SEASON`
  (checado em `playCareerMatch`, guardado por `goals > 0` para não
  registrar "recorde de 0 gols" na primeira partida de carreira de
  qualquer jogador do mundo).** Outras categorias (mais assistências,
  melhor sequência de vitórias, etc.) ficam para quando houver sinal real
  de quais métricas os jogadores acompanham.
- **Ordem em `respondToDuel`: a transição guardada do duelo (PENDING →
  FINISHED, trava já estabelecida na Fase 8) continua vindo antes das
  atualizações de rating/recorde/rivalidade.** Mesmo motivo documentado na
  adenda da Fase 8 — nenhuma dessas escritas tem idempotência própria, então
  o ponto de trava tem que vir primeiro para que um retry pós-crash nunca
  reaplique ELO, recorde ou histórico de confronto uma segunda vez.
- **`PlayerRepository` ganhou `findById(playerId)`** (só existia
  `findByUserId`). Necessário porque `Record.holderPlayerId` e
  `Rivalry.playerAId/playerBId` guardam ids de `Player`, não de `User` —
  exibir o apelido do dono de um recorde exige resolver por esse id
  diretamente, sem passar por um Discord id.
- **Hall of Fame (`/recordes`) é a listagem de `listCurrentRecords()`, sem
  UI separada de "linha do tempo" do histórico.** O histórico completo já
  existe no banco (nada foi descartado), só não tem uma superfície de
  Discord dedicada ainda — decisão de escopo, não lacuna técnica.
- **Sistema de conquistas (`Achievement`/`UserAchievement`, mencionado no
  prompt mestre) não foi implementado nesta fase.** Ranking/recordes/
  rivalidades já cobrem a parte "competitiva" de Global; conquistas são um
  sistema de progressão independente (definições de conquista, gatilhos de
  desbloqueio, notificação) que merece seu próprio ciclo ANALISE→PLANEJE em
  vez de ser anexado apressadamente aqui. Registrado no RISK_REGISTER.md
  como item pendente e explícito, não descoberto tarde.

## Adenda (Fase 10) — Groq: camada narrativa isolada, com fallback determinístico sempre disponível

`src/narrative/` entra como um novo contexto hexagonal, cumprindo a
decisão já registrada na criação deste ADR: "LLM (Groq) no caminho de
gameplay" foi rejeitado desde o início — esta fase implementa exatamente
o oposto, uma camada de texto que nunca influencia nem bloqueia o motor
determinístico.

Decisões de arquitetura:

- **`NarrativeGenerator` é uma porta com três implementações que se
  compõem, não uma substituem a outra.** `TemplateNarrativeGenerator`
  (domínio puro, sem I/O, nunca falha) é o generator de fato quando
  `GROQ_API_KEY` não está configurada — não é um "modo degradado", é a
  implementação completa e válida. Quando a chave existe,
  `FallbackNarrativeGenerator` (decorator) tenta `GroqNarrativeGenerator`
  primeiro e cai para o template em QUALQUER falha (erro de rede, timeout,
  resposta vazia, saída malformada) — nunca propaga o erro pro chamador.
  Essa composição é o que cumpre, de forma verificável em teste, a
  promessa já registrada no Risco #5 do RISK_REGISTER.md.
- **`GroqNarrativeGenerator` depende de uma interface própria e estreita
  (`GroqChatClient`), não da classe `Groq` do SDK.** Mesmo princípio de
  DI já usado em todo adapter Prisma do projeto — permite testar o
  parsing e o tratamento de erro (resposta vazia, título/corpo não
  separados por linha) com um cliente fake, sem tocar a rede. Implementado
  e testado dessa forma; a chamada real ao Groq não foi validada neste
  ambiente por falta de `GROQ_API_KEY` — mesmo tratamento já dado a todo
  adapter Prisma real (ver docs/ROADMAP.md).
- **A notícia de recorde mundial nunca é gerada no fluxo que quebrou o
  recorde.** `checkAndUpdateRecord` (Fase 9) ganhou uma dependência de
  `EventBus` e agora emite `RECORD_BROKEN` (tipo já pré-modelado em
  `events/types.ts` desde a Fase 0/1, nunca emitido até agora) sempre que
  um recorde é batido. Um subscriber assíncrono, montado em `src/index.ts`
  (`events.on("RECORD_BROKEN", ...)`), chama
  `narrative/services/publishRecordNews.ts`. Como `EventBus.emit` nunca
  espera (`await`) os handlers — eles rodam via `Promise.resolve(...)
  .catch(...)`, erros só logados — uma chamada Groq lenta ou com falha
  jamais atrasa ou derruba `/jogar-carreira` nem `/duelo-responder`. Essa é
  a materialização concreta da regra "Groq nunca no caminho crítico".
- **`/treinador` e `/entrevista` chamam o `NarrativeGenerator`
  SINCRONAMENTE dentro do próprio comando, ao contrário da notícia de
  recorde.** Isso não viola a regra: aqui a chamada narrativa É o próprio
  propósito do comando (não um efeito colateral de uma partida/duelo já
  resolvido), então uma falha ou lentidão do Groq só atinge aquele único
  comando — nunca o resultado de uma partida, economia ou rating — e o
  `FallbackNarrativeGenerator` garante uma resposta significativa mesmo
  assim.
- **`/entrevista` e `/treinador` usam os MESMOS fatos de temporada
  (estágio de carreira, partidas/gols/assistências/nota média), só com
  personas e prompts diferentes** (treinador fala COM o jogador em segunda
  pessoa; entrevista responde COMO o jogador em primeira pessoa). Decisão
  deliberada: uma "última partida específica" para a entrevista exigiria
  uma nova consulta a `MatchRepository` (nome do adversário, placar,
  linha de stats daquela partida específica) que nenhuma outra feature
  precisa hoje — escopo mantido no que já é alcançável com o dado
  agregado existente.
- **`News` não tem relação com `User`/`Player` — é sempre uma notícia
  global,** coerente com o próprio schema (sem `userId`/`playerId`).
  Hoje só `RECORD_BROKEN` gera notícia; outros gatilhos plausíveis (hat-
  trick, resultado surpreendente de liga, transferência de destaque) não
  foram implementados — ver risco correspondente no RISK_REGISTER.md.
- **`PlayerRepository.findById`** (adicionado na Fase 9) é reaproveitado
  aqui para resolver o apelido do novo/antigo dono de um recorde a partir
  do `Player.id` recebido no evento — nenhuma porta nova precisou ser
  criada só para isso.

## Adenda (Fase 11) — Polish: fechando itens concretos já adiados, não uma auditoria genérica

"Polish (UX, animações, acessibilidade, performance)" é, por natureza,
um escopo vago se tratado como um item novo isolado — o próprio
ROADMAP.md já registra que polish é "contínuo, revisado a cada fase
anterior também", e de fato cada fase até aqui já revisou sua própria UX
antes de ser marcada ✅. Em vez de inventar uma auditoria genérica sobre
as 10 fases anteriores (trabalho não verificável e sem critério objetivo
de "pronto"), esta fase fecha os itens de polish CONCRETOS que já tinham
sido explicitamente adiados e registrados, com um dono claro no
RISK_REGISTER.md ou no ROADMAP.md:

- **Carta detalhada + favoritar (Risco #28).** `CardRepository.
  setFavorite` já existia e já era testado desde a Fase 7 — só não tinha
  comando Discord. `CardRepository` ganhou `findCardByName` (busca
  case-insensitive por nome — os comandos usam nome, não o id interno do
  catálogo) e `listAllCards`. Novos serviços `viewCardDetail` e
  `toggleFavoriteCard`, comandos `/carta nome:...` e `/favoritar
  nome:...`. **Favoritar é um toggle por nome de carta, não por cópia
  específica** — cópias da mesma carta são fungíveis em tudo exceto
  favorito/level (level sempre 1 hoje), então "qual cópia exatamente"
  não é uma escolha que o usuário precisa fazer: se alguma cópia já está
  favoritada, desfavorita; senão, favorita a primeira.
- **N+1 em `viewCollection` (performance, achado durante o trabalho
  acima).** O serviço chamava `cardRepository.getCard(cardId)` uma vez
  por carta distinta na coleção do usuário. Como o catálogo é fixo e
  pequeno (15 cartas), o custo real é desprezível, mas o padrão é
  estruturalmente errado — `listAllCards()` chamado uma vez e indexado
  em memória substitui as N chamadas por 2 chamadas fixas
  (`listUserCards` + `listAllCards`), independente do tamanho da coleção.
- **Log de erro vazando `DATABASE_URL` (Risco #9, identificado desde a
  revisão de segurança da Fase 2, nunca mitigado até agora).** Um erro
  de conexão do Prisma inclui a connection string inteira — com
  credenciais — na própria mensagem, e tanto `discord/client.ts` (catch
  de falha de comando) quanto `src/index.ts` (`unhandledRejection` e o
  catch de topo de `main()`) logavam o `error` bruto. `shared/redact.ts`
  (`redactSecrets`/`redactError`, puro e testado sem nenhum segredo real)
  escova qualquer string `esquema://user:senha@host` antes do log — cobre
  o caso estrutural sem precisar saber o valor do segredo — e também
  aceita uma lista de valores conhecidos pra scrub literal, usada em
  `index.ts` com `process.env["DATABASE_URL"]`/`DISCORD_BOT_TOKEN`/
  `GROQ_API_KEY"]` (lidos direto de `process.env`, não do `env` já
  validado, pra cobrir até uma falha do próprio `loadEnv()`).
- **Acessibilidade — revisada, sem necessidade de mudança.** Todo card
  Components V2 do projeto já combina cor de destaque com texto/emoji
  redundante (ex.: gold + "🏆 NOVO RECORDE" no texto, nunca só a cor
  sozinha carregando o significado) — checado nesta fase, sem achado
  que exigisse correção.
- **Animações — não aplicável a esta plataforma.** Comandos slash do
  Discord com Components V2 são texto/embeds estáticos por natureza; não
  existe API de animação client-side neste tipo de superfície. Registrado
  aqui explicitamente para não parecer um item "esquecido" — é inaplicável
  por design da plataforma, não uma lacuna.

O que ficou deliberadamente fora: qualquer revisão dos pesos de
IA/economia/sorteio (Riscos #12/#20/#29 — precisam de dados reais de uso,
não de um ajuste "no olho" repetido), o gap de rollover de temporada
(Risco #33 — feature grande, não polish), e o sistema de conquistas
(Risco #35 — feature nova, não polish). Nenhum desses é "polimento" no
sentido do produto já existente funcionar melhor; são lacunas de escopo
maior que já têm dono e justificativa registrados em fases anteriores.

## Adenda (pós-Fase 11) — Temporadas: rollover automático por liga, não um relógio global

Fecha o Risco #33, deliberadamente adiado desde a Fase 9: `getOrCreateActiveSeason` estava fixo na temporada 1 para sempre, e qualquer jogador que terminasse os 12 jogos da própria liga (turno e returno contra os 6 rivais) ficava permanentemente bloqueado com `SeasonCompleteError`.

Antes de implementar, havia uma bifurcação genuína de design (não uma simples lacuna de código) — confirmada com o usuário antes de codar:

- **Opção A (escolhida): avanço automático por liga.** Quando um jogador esgota os fixtures da temporada atual, o sistema gera automaticamente a próxima temporada daquela liga (mesmos clubes rivais, calendário novo) e o joga na hora — sem cron, sem gatilho externo, sem infraestrutura nova. Cada `Career` avança seu próprio número de temporada de forma independente; não existe mais "a" temporada ativa global.
- **Opção B (rejeitada por ora): temporada global com prazo fixo.** `Season.endsAt` viraria real, todo mundo trocaria de temporada junto numa data marcada, via job agendado ou comando de admin. Mais fiel a uma "temporada" no sentido esportivo tradicional, mas exige decidir duração, política pra quem está no meio da temporada quando ela vira, e um mecanismo de disparo (Routine/cron) que não dá pra validar de ponta a ponta neste ambiente. Rejeitada pelo mesmo princípio já usado pra matchmaking/Redis/filas (Risco #7): não adicionar infraestrutura sem tráfego real que a justifique.

Decisões de implementação:

- **`Season` deixou de ser um singleton.** `Season.number` continua `@unique` globalmente, mas agora várias linhas coexistem (temporada 1, 2, 3...) — cada uma é o "mundo compartilhado" de uma geração de ligas, exatamente como o pool de clubes rivais já era compartilhado por nacionalidade. `CareerRepository.getOrCreateActiveSeason()` foi substituído por `getOrCreateSeason(number, now)`, parametrizado.
- **`Career` ganhou `currentSeasonNumber` (schema + migration manual, já que este ambiente não roda `prisma migrate dev` contra um banco real — mesmo tratamento dado a todo schema change desde a Fase 4).** É esse campo, não mais um relógio global, que determina em qual temporada a liga de um jogador está. Uma carreira nova sempre começa na temporada 1; uma carreira retomada resume de onde parou.
- **Por que isso não colide (a preocupação original do Risco #33):** investigando o schema mais a fundo durante a implementação, descobri que `Tournament` já tem `@@unique([competitionId, seasonId])` — ou seja, a MESMA competição (`Competition.name`, ex. "Liga de Acesso — BR") pode legitimamente ter um `Tournament` por temporada, sem nenhuma colisão. `leagueNameFor` não precisou ganhar o número da temporada, ao contrário do que a adenda da Fase 9 havia previsto — o design do schema já resolvia isso, só não tinha sido verificado a fundo até agora.
- **Bug real encontrado e corrigido durante a implementação:** `InMemoryCompetitionRepository.getOrCreateSeasonLeague` (o adapter usado por TODOS os testes) chaveava o `Tournament` só por `competitionName`, ignorando `seasonId` — ao contrário do adapter Prisma, que sempre respeitou a chave composta certa. Sem essa correção, a temporada 2 de qualquer liga silenciosamente reutilizaria o calendário já esgotado da temporada 1, e os testes de rollover teriam passado por acidente (ou travado). Corrigido antes de escrever qualquer teste de rollover, não depois.
- **`playCareerMatch` faz o rollover dentro da MESMA chamada.** Ao encontrar `getNextFixtureForTeam` nulo: avança `Career.currentSeasonNumber`, chama `ensureCareerStarted` de novo (que resolve a nova temporada/time/clube automaticamente — nenhum outro caller de `ensureCareerStarted` precisou de nenhuma mudança), gera a nova liga via o novo helper `resolveLeagueForSeason` (compartilhado com `viewStandings.ts`, eliminando a duplicação que já existia entre os dois), e joga a primeira partida da nova temporada — tudo numa única resposta de `/jogar-carreira`, sem exigir uma segunda chamada do usuário.
- **`nextCareerStage` não pode regredir estágio.** Confirmado antes de mexer: a função só promove (`RESERVE`→`PROFESSIONAL`→`STARTER`) e nunca rebaixa, então o reset de `PlayerSeasonStat` por temporada nova não derruba um estágio já conquistado — só pode, na pior das hipóteses, atrasar a PRÓXIMA promoção (mesma categoria de risco de balanceamento já aceita nos Riscos #12/#20).
- **`seasonNameFor(number)`** (novo, `career/domain/season.ts`) substitui o nome fixo "SEASON 01 — THE BEGINNING" por uma lista cíclica de epítetos — puro, determinístico, testado isoladamente.
- **UI:** `/jogar-carreira` celebra o rollover ("🎊 Fim da temporada! Você avançou para a Temporada N..."); `/classificacao` mostra o número da temporada no título.

## Adenda (follow-up) — Conquistas: catálogo fixo + integração inline (não fire-and-forget)

Fecha o Risco #35 (conquistas mencionadas no prompt mestre, deliberadamente adiadas nas Fases 9/10 por serem "um sistema de progressão independente que merece seu próprio ciclo"). `Achievement`/`UserAchievement` já existiam no schema desde a Fase 0 — esta adenda é só ports/adapters/serviços/comandos, sem migration nova.

Decisões de arquitetura:

- **Catálogo pequeno e deliberadamente fechado no v1: 6 conquistas** (`FIRST_MATCH`, `FIRST_WIN`, `FIRST_GOAL`, `WORLD_RECORD`, `DUEL_WINNER`, `FIRST_PACK`), cada uma disparada por um dado que o chamador JÁ tem em mãos depois de uma chamada de serviço existente (resultado de partida, resultado de duelo, abertura de pacote) — nenhuma instrumentação nova de evento foi necessária. Conquistas que dependeriam de contadores vitalícios (ex.: "10 partidas jogadas", que exigiria um agregado cross-temporada que `PlayerSeasonStat` não mantém) ficaram fora deste v1.
- **Diferente da notícia de recorde (Fase 10), o desbloqueio de conquista é SÍNCRONO, dentro do próprio serviço que a disparou — não um evento assíncrono.** É uma escrita determinística e rápida no banco (get-or-create idempotente), não uma chamada a um LLM externo lento/não confiável — não há o mesmo motivo para isolar via `EventBus`. `checkAndUnlockAchievements(deps, userId, candidateKeys, now)` é chamado diretamente por `playCareerMatch`, `respondToDuel` e `openPack`, e o resultado (`achievementsUnlocked`) é devolvido no mesmo output que a Discord UI já usa pra montar o card — permite celebrar a conquista na mesma resposta, sem esperar um segundo turno.
- **`unlock` é idempotente por (userId, key)** — retorna `true` só na primeira vez, `false` em toda chamada seguinte, nunca lança erro nem duplica. Isso é o que permite os call sites simplesmente "declarar candidatos" (`achievementCandidates.push("FIRST_WIN")`) sem se preocupar em checar antes se o usuário já tem a conquista — o repositório garante a idempotência.
- **`respondToDuel` precisa rastrear qual JOGADOR quebrou o recorde, não só que "algum recorde foi quebrado".** O loop existente de `checkAndUpdateRecord` (Fase 9) só acumulava `recordsBroken: RecordCategory[]` compartilhado entre os dois lados do duelo — insuficiente pra saber de quem é a conquista `WORLD_RECORD`. Adicionado `recordBreakerPlayerIds: Set<string>` ao lado do loop existente, sem mudar o comportamento de `recordsBroken` em si.
- **`achievementUnlockLines` (novo, `discord/ui/`)** é o único lugar que sabe formatar "🏅 Conquista desbloqueada: X!" — reaproveitado por `careerMatchResultCard.ts`, `duelResultCard.ts` (uma vez por lado) e `abrirPacote.ts`, evitando reconstruir o mapa key→nome em cada um.
- **`/conquistas` mostra o catálogo inteiro, bloqueadas incluídas** (🔒/✅), não só as já desbloqueadas — dá uma noção de progresso ("3/6"), mesmo padrão de "mostrar o que falta" já usado em `/recordes` (Hall da Fama) e `/carreira`.

## Consequências

- Toda integração com Discord/Groq/Postgres exige credenciais reais que
  este ambiente não possui (`DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`,
  `DATABASE_URL`, `GROQ_API_KEY`). O código está pronto para recebê-las via
  `.env`, mas testes de integração real (login no Discord, `prisma migrate
  dev` contra um banco de verdade) ficam bloqueados até o usuário fornecer
  esses valores.
- `npm run typecheck`, `npm run lint` e `npm test` (unitários) rodam sem
  nenhuma credencial.
