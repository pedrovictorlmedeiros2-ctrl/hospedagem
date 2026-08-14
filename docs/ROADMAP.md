# Development Roadmap

Uma fase só é marcada ✅ quando: código escrito, testado, integrado e
documentado — nunca só "código escrito". Ver Definition of Done no
briefing original do produto.

| Fase | Nome | Status | Notas |
|------|------|--------|-------|
| 0 | Discovery | ✅ | ADR 0001, DATABASE.md, RISK_REGISTER.md, este roadmap |
| 1 | Foundation | ✅ | Projeto TS, lint/format, logger, Prisma schema completo, event bus tipado, Discord client + 1 comando real (`/ping`) com Components V2, testes unitários, CI local (typecheck/lint/test) verde |
| 2 | Player (`/criar-perfil`, personalização) | 🟡 Implementado, não validado contra Discord/Postgres reais | Domínio + serviços + comandos completos, 57 testes unitários verdes. Ver seção "O que 'implementado' significa aqui" abaixo |
| 3 | Game Engine (núcleo da partida, IA) | 🟡 Núcleo implementado e testado; sem persistência nem UI ao vivo ainda | Motor puro/determinístico + `/simular-amistoso`, 34 testes novos. Ver seção "O que a Fase 3 entrega" abaixo e adenda em docs/adr/0001 |
| 4 | Career (treino, escalação, calendário) | 🟡 Implementado e testado; primeira partida com persistência real | `/carreira`, `/treinar`, `/jogar-carreira`, 19 testes novos (137 no total). Ver seção "O que a Fase 4 entrega" abaixo |
| 5 | Competitions (ligas, copas, temporadas, seleção) | 🟡 Liga real implementada e testada; mata-mata só no domínio; seleção adiada | `/classificacao`, calendário turno/returno real, 26 testes novos (169 no total). Ver seção "O que a Fase 5 entrega" abaixo |
| 6 | Economy (coins, mercado, transferências, contratos) | ✅ Implementada e testada — coins, recompensas, treino intensivo, contratos com salário e transferências entre clubes da liga | `/carteira`, `/contrato`, `/propostas`, `/transferir`, 52 testes novos (221 no total). Ver seção "O que a Fase 6 entrega" abaixo |
| 7 | Cards (cartas, packs, inventário) | ✅ Implementada e testada — catálogo fixo, sorteio ponderado, abertura à prova de duplicação | `/pacotes`, `/abrir-pacote`, `/colecao`, 20 testes novos (241 no total). Ver seção "O que a Fase 7 entrega" abaixo |
| 8 | Multiplayer (matchmaking, duelos, rating) | ⏳ Não iniciada | Schema já modelado (Duel) |
| 9 | Global (top global, recordes, rivalidades, Hall of Fame, temporadas) | ⏳ Não iniciada | Schema já modelado (RankingSnapshot/Record/Rivalry) |
| 10 | Groq (narrativa: notícias, treinador, entrevistas) | ⏳ Não iniciada | Depende de `GROQ_API_KEY` |
| 11 | Polish (UX, animações, acessibilidade, performance) | ⏳ Não iniciada | Contínuo, revisado a cada fase anterior também |

## Bloqueios ativos para avançar além da Fase 1

Estes não são "problemas de código" — são decisões/insumos que só o
usuário pode fornecer:

1. **`DISCORD_BOT_TOKEN` + `DISCORD_CLIENT_ID`** — criar uma aplicação em
   https://discord.com/developers/applications (ou fornecer uma existente).
2. **`DATABASE_URL`** — uma instância PostgreSQL real (local, Docker, ou
   gerenciada) para rodar `prisma migrate dev` e testar persistência de
   verdade.
3. **`GROQ_API_KEY`** — só necessário a partir da Fase 10, não bloqueia as
   fases 2-9.

Sem (1) e (2), dá para continuar escrevendo e testando unitariamente a
lógica de domínio (regras de carreira, cálculo de OVR, motor de partida
puro, etc.), mas não dá para validar a integração real ponta a ponta —
e "validar" é parte da Definition of Done, não um extra.

## O que "implementado" significa na Fase 2

A Fase 2 (`/criar-perfil`, `/personalizar`) está com o código completo:
validação de domínio, cálculo de atributos/OVR por posição, repositórios
com porta/adapter trocável (`PlayerRepository`, `UserRepository`, cada um
com uma implementação Prisma real e uma implementação em memória para
teste), serviços de caso de uso, e os dois comandos Discord com
Components V2.

**O que foi validado de verdade:** `npm run typecheck`, `npm run lint`,
`npm run build` e `npm test` — 57 testes unitários cobrindo validação de
campo a campo, duplicidade de perfil, autorização (usuário tentando editar
perfil alheio), corrida de criação simultânea (`Promise.allSettled`), e
propagação correta de um erro de repositório simulando banco indisponível
(sem ser mascarado/engolido).

**O que NÃO foi validado:** login real no Discord, registro real dos
slash commands (`npm run deploy-commands` nunca rodou contra a API do
Discord), e nenhuma escrita real no Postgres (`prisma migrate deploy`
nunca rodou contra um banco de verdade — o arquivo
`prisma/migrations/20260814000000_init/migration.sql` foi gerado
offline via `prisma migrate diff`, não aplicado). O teste de integração em
`tests/integration/player/prismaPlayerRepository.test.ts` existe e roda
um round-trip real create/find/update, mas fica **pulado** (não "passando
com mock") quando `DATABASE_URL` não aponta para um Postgres alcançável —
que é o caso deste ambiente. Rodar `npm test` mostra isso explicitamente:
`1 skipped` com um aviso no stderr.

## O que a Fase 3 entrega

O motor (`src/game/`) é puro, determinístico (seed → mesmo resultado
sempre) e sem I/O — ver a adenda "Fase 3" em
`docs/adr/0001-stack-and-architecture.md` para as decisões de escopo
(zona abstrata 0-4 em vez de física contínua, sem persistência em
Match/Team/Season ainda, goleiro manual adiado).

**O que foi validado de verdade:** 34 testes unitários novos (94 no
total), incluindo testes estatísticos multi-seed que provam que os
atributos importam de verdade — não é só "roda sem erro":
- Determinismo: mesmo seed produz `MatchResult` idêntico byte a byte.
- Um time 90 OVR bate um time 25 OVR por +1 gol de saldo em média (60
  partidas simuladas).
- Um goleiro 95 de atributo sofre menos gols que um de 15, tudo mais
  igual (60 partidas simuladas de cada lado).
- Todo mecanismo do briefing dispara pelo menos uma vez em 150 partidas:
  gol, cartão amarelo, cartão vermelho, escanteio, impedimento, pênalti
  (convertido e perdido), lesão, substituição.
- Uma escalação nunca fica vazia (jogador expulso/lesionado sem
  substituto disponível ainda deixa o time em campo, só reduzido).
- **Bug real encontrado e corrigido na autorrevisão:** ao montar a
  escalação em torno do jogador real do usuário
  (`playFriendlyMatch.ts`), o código original substituía o jogador na
  posição sorteada por índice `0` quando a posição do jogador real
  (DM/AM/LW/RW) não existia literalmente na formação 4-4-2 sintética —
  index `0` é o goleiro, então qualquer perfil DM/AM/LW/RW quebraria a
  validação de escalação (zero goleiros titulares). Corrigido para
  substituir por grupo de posição (defesa/meio/ataque), nunca o goleiro a
  menos que a posição real também seja goleiro. Há um teste de regressão
  cobrindo as 12 posições possíveis.

**O que NÃO foi implementado ainda (deferido conscientemente, não
esquecido):**
- **Persistência em `Match`/`MatchEvent`/`MatchPlayerStat`.** Essas
  tabelas exigem `Team`/`Season`/`Competition` reais, que só existem a
  partir da Fase 4/5. `/simular-amistoso` emite `MATCH_STARTED` /
  `MATCH_FINISHED` no event bus (para quem quiser reagir), mas não grava
  no banco — persistir uma partida de teste forçaria fabricar
  registros falsos de temporada/clube só para satisfazer as foreign
  keys.
- **Interface ao vivo por botão** (controles contextuais a cada lance,
  como o briefing pede). `/simular-amistoso` roda a partida inteira de
  uma vez e mostra o resultado final — não há troca de mensagem a cada
  minuto nem timers. Isso é um projeto de UI à parte (estado de
  interação por partida, componentes que mudam por contexto de jogo).
- **Controle manual de goleiro.** O goleiro é sempre controlado pela IA
  neste v1; controle manual por botão depende da interface ao vivo acima
  existir primeiro.
- Os pesos de decisão da IA (quem chuta, quando pressiona, etc.) são um
  ponto de partida ajustado "no olho", não calibrado com dados reais de
  partida — não existe partida real ainda para calibrar contra.

## O que a Fase 4 entrega

`src/career/` segue o mesmo padrão hexagonal das fases anteriores
(domain → ports → adapters → services). Ela é o que finalmente dá sentido
a persistir uma partida de verdade: cria Season/Club/Team reais, então
`/jogar-carreira` grava `Match`/`MatchEvent`/`MatchPlayerStat`/
`PlayerSeasonStat` de verdade (via `MatchRepository`, com Prisma real +
in-memory testável, igual ao padrão de todo repositório neste projeto).

**O que foi validado de verdade:** 19 testes de serviço novos (137 no
total) — carreira idempotente (chamar `/carreira` várias vezes não
recria nada), jogadores da mesma nacionalidade dividem o mesmo clube
inicial, treino respeita cooldown e retorno decrescente, progressão de
estágio de carreira bate exatamente com a regra de domínio (não só "às
vezes promove"), escalação banca o jogador machucado (não ignora a
lesão), e uma lesão realmente registrada afeta a escalação da partida
seguinte. Um teste estatístico inicial de lesão (40 tentativas com seed
aleatória) falhou porque a chance de o jogador REAL se machucar é baixa
(~0,7% por partida, já que ele é só 1 de 22 em campo) — em vez de
aumentar tentativas às cegas, `seed` virou injetável no serviço (só para
teste, nunca usado pelo comando Discord) e uma seed determinística que
produz lesão foi encontrada rodando o próprio serviço — teste
determinístico, não estatístico frágil.

**Bug real encontrado e corrigido na autorrevisão:** a estamina do
jogador real nunca era gravada de volta no banco depois de uma partida —
só `/treinar` mexia nela, então a fadiga de jogar simplesmente
desaparecia. Corrigido: `playCareerMatch` agora persiste a estamina final
do jogador ao fim de cada partida. Um segundo bug relacionado: o valor de
estamina calculado pelo motor é fracionário (ex.: `67.95`), mas
`Player.stamina` é `Int` no schema — corrigido arredondando antes de
gravar.

**Decisões de arquitetura registradas** (ver adenda "Fase 4" em
`docs/adr/0001-stack-and-architecture.md`): só o jogador real tem uma
linha `Player` de verdade — companheiros/adversários sintéticos nunca
viram `TeamPlayer`, `MatchEvent.playerId` ou `MatchPlayerStat`;
`PlayerSeasonStat` é escrito/lido só pelo `MatchRepository` (não pelo
`CareerRepository`, para não ter dois donos da mesma tabela); `Injury` é
gravado num passo separado (não atômico com o `Match`) porque é estado de
carreira, não resultado de partida — risco pequeno e documentado, não
ignorado.

**O que NÃO foi implementado ainda:**
- **Recuperação passiva de estamina entre partidas.** Hoje só existe
  recuperação no intervalo (dentro do motor) e o custo de treinar. Jogar
  vários dias seguidos sem folga drena estamina permanentemente até a
  escalação te bota no banco automaticamente — realista, mas não existe
  ainda um "descanso" ativo que o jogador possa escolher.
- **Calendário real de treino.** "Uma sessão de treino por dia" ainda usa
  cooldown por horas, não um calendário semanal de verdade
  (treino/jogo/folga por dia da semana). A Fase 5 resolveu a metade
  "partida" disso (calendário de liga real); a metade "treino" continua
  pendente.
- **Transferências/contratos.** O jogador fica no clube inicial para
  sempre neste v1; `Contract`/`Transfer` (já modelados no schema) não são
  usados ainda — isso é Fase 6 (Economy).

## O que a Fase 5 entrega

`src/competitions/` segue o mesmo padrão hexagonal. `Competition` e
`Tournament` (modelados desde a Fase 1) ganham conteúdo de verdade:
calendário gerado pelo método do círculo (turno e returno — cada clube
enfrenta cada rival uma vez em casa, uma vez fora), classificação
calculada a partir dos `Match`es reais, e `/jogar-carreira` agora joga a
próxima rodada agendada, não mais um oponente sorteado a cada chamada.

**O que foi validado de verdade:** 26 testes novos (169 no total),
incluindo um teste de integração que joga a temporada inteira via
`playCareerMatch` (12 partidas, contra os 6 rivais exatamente 2 vezes
cada — uma em casa, uma fora — e confirma que a 13ª chamada é recusada
com `SeasonCompleteError`). Também testado: fixtures round-robin corretas
para contagem par e ímpar de times, classificação com desempate por
saldo de gols/gols marcados, chave de mata-mata seedada (1º contra
último), e que duas carreiras da mesma nacionalidade enxergam
exatamente a mesma liga.

**Bug real encontrado e corrigido na autorrevisão:** dois clubes rivais
diferentes podiam gerar o **mesmo nome de exibição** (dois sorteios
independentes de tipo+cidade colidindo — aconteceu de verdade num teste
manual: dois clubes distintos ambos "Clube Recreativo Porto Novo" na
mesma tabela). Corrigido indexando o nome do lugar pelo número de ordem
do rival (0 a 5) em vez de sortear independentemente — garante nomes
distintos para o pool fixo de 6 rivais.

**Decisões de arquitetura registradas** (ver adenda "Fase 5" em
`docs/adr/0001-stack-and-architecture.md`): liga primeiro, mata-mata
depois (motor de chave testado no domínio, não conectado a nenhum
comando ainda); convocação para seleção adiada (precisa de histórico
entre temporadas que ainda não existe); `MatchRepository` ganhou
`existingMatchId` opcional para atualizar uma rodada agendada em vez de
sempre criar uma partida nova; casa/visitante agora é real (a Fase 4
sempre tratava o clube do jogador como mandante, o que não era
realista).

**O que NÃO foi implementado ainda:**
- **Mata-mata conectado a um comando.** `generateKnockoutBracket` existe
  e está testado, mas nenhuma copa real usa ele ainda.
- **`Tournament.status` nunca vira `FINISHED`.** Fica `IN_PROGRESS` para
  sempre, mesmo depois da temporada esgotada — não afeta nada
  funcionalmente hoje (nada lê esse campo), mas é uma lacuna a fechar
  quando houver transição real de temporada.
- **Liga só cresce até o primeiro grupo de times gerado por
  nacionalidade.** Se um novo jogador de uma nacionalidade já vista
  aparecer depois da liga gerada, ele entra no mesmo clube/liga
  normalmente (era esse o design). O que não existe é uma liga que
  aceita novos CLUBES no meio da temporada — decisão consciente, ver ADR.

## O que a Fase 6 entrega

`src/economy/` segue o mesmo padrão hexagonal das demais fases: domínio
puro (`domain/matchReward.ts`, `domain/marketValue.ts`,
`domain/contract.ts`, `domain/transferOffer.ts`, `domain/errors.ts`) →
portas (`ports/walletRepository.ts`, `ports/marketRepository.ts`) →
adapters Prisma real + in-memory (`adapters/`) → serviços
(`services/grantMatchReward.ts`, `services/viewWallet.ts`,
`services/ensureContract.ts`, `services/viewContract.ts`,
`services/listTransferOffers.ts`, `services/acceptTransferOffer.ts`).
`Wallet`/`WalletTransaction`/`Contract`/`Transfer` já existiam no schema
desde a Fase 1; esta fase é a primeira a escrever de verdade neles.

A fase foi entregue em duas passadas. A primeira cobriu o ledger, uma
fonte (recompensa de partida) e um sumidouro (treino intensivo) —
deliberadamente sem mercado/transferências/contratos ainda, porque
construir um sistema de negociação completo na mesma passada que a
fundação do ledger arriscaria entregar algo mal testado. A segunda
passada fechou o restante do escopo original ("mercado; transferências;
contratos"), incluindo um refactor estrutural que se revelou necessário
no caminho — ver abaixo.

**Como o dinheiro entra (source) e sai (sink):**
- **Recompensa de partida** (`economy/domain/matchReward.ts`): titular
  vs banco, resultado, gols/assistências, nota alta ("man of the
  match"). Banco sempre recebe um valor fixo pequeno, nunca zero.
- **Salário** (`economy/domain/contract.ts`, pago em `playCareerMatch`):
  contratual, não depende de desempenho — pago toda partida,
  independente de resultado ou de o jogador ter começado no banco.
- **Bônus de assinatura de transferência** (`economy/domain/
  transferOffer.ts`, `services/acceptTransferOffer.ts`): 15% da taxa de
  transferência negociada — não a taxa inteira (ver "proteção
  antiexploração" abaixo).
- **Treino intensivo** (sumidouro, `career/services/trainPlayer.ts`):
  dobra o ganho da MESMA sessão de `/treinar` por coins, sem tocar no
  cooldown nem no custo de estamina.

Pesos de recompensa/valor de mercado são heurística ajustada no olho para
um v1, mesma categoria de risco aceito dos pesos de IA do motor (Risco
#12).

**Contratos** (`/contrato`): todo jogador com carreira ativa tem um
contrato com o clube atual — salário por partida e cláusula de rescisão
derivados do valor de mercado (`calculateMarketValue`: cresce com
overall, cai com idade fora do auge). `ensureContract` é um bootstrap
idempotente (mesmo padrão de `ensureCareerStarted`): assina um contrato
novo quando não existe nenhum, quando o anterior expirou (180 dias), ou
quando ficou órfão de um clube que o jogador já deixou.

**Transferências** (`/propostas`, `/transferir`): os 6 clubes rivais da
liga do jogador podem fazer propostas por ele, disponíveis quando o
overall do jogador atinge um piso relativo à reputação do clube
interessado (hoje todos os rivais têm a mesma reputação fixa — ver
limitação abaixo). A proposta do dia é **determinística**: derivada de
um RNG seedado por (jogador, clube, dia do calendário), o mesmo truque de
`career/services/trainPlayer.ts` para o treino intensivo — `/propostas`
(consulta) e `/transferir` (aceite) sempre concordam no mesmo valor sem
precisar persistir uma proposta à parte. Aceitar uma proposta: encerra o
contrato antigo, tira o jogador do elenco do clube atual, coloca no
elenco do novo, atualiza `Career.currentClubId`, grava um `Transfer` e
assina um contrato novo.

**Proteção antiexploração da transferência** (o ponto mais arriscado
desta fase): pagar a taxa de transferência INTEIRA ao jogador a cada
transferência permitiria farm de coins quase ilimitado saltando entre os
6 rivais repetidamente. Duas mitigações independentes: (1) o jogador
recebe só um bônus de assinatura (15% da taxa) — a taxa em si é só
registro histórico no `Transfer.fee`, como no futebol real, onde quem
paga a taxa é o clube comprador ao clube vendedor, não ao jogador; (2)
cooldown real de 30 dias entre transferências (`canTransferNow`, mesmo
formato de `canTrainNow`), então mesmo o bônus reduzido não pode ser
repetido em sequência.

**Refactor estrutural necessário: `ensureCareerStarted` ignorava
`Career.currentClubId`.** Ao implementar a transferência, descobri que
`ensureCareerStarted` sempre reresolvia o clube pela nacionalidade do
jogador (`starter-club:<nacionalidade>`), nunca lendo
`career.currentClubId` — ou seja, mesmo se uma transferência atualizasse
esse campo, a próxima chamada de `/carreira`, `/treinar` ou
`/jogar-carreira` ignorava silenciosamente e devolvia o jogador ao clube
inicial. Corrigido: quando a carreira já existe, o clube atual vem de
`careerRepository.getClubById(career.currentClubId)`; a resolução por
nacionalidade só roda no bootstrap de uma carreira nova. Isso exigiu
adicionar `getClubById`, `getClubByTeamId`, `leaveRoster` e
`updateCareerClub` à `CareerRepository` (Prisma + in-memory), e
generalizar a resolução do clube adversário em `playCareerMatch` (antes
buscava só na lista fixa de rivais via `rivals.find(...)`, o que quebra
quando o adversário é o antigo clube do jogador, que nunca esteve nessa
lista).

**Segundo bug real, encontrado pelos próprios testes (não por revisão
manual):** depois do refactor acima, `buildLeagueTeams` continuava usando
o clube ATUAL do jogador para montar a lista de times da liga — depois de
uma transferência, esse clube já é um dos 6 rivais, duplicando um id de
time e derrubando `generateRoundRobinFixtures` ("duplicate team id") na
primeira vez que a liga fosse gerada para um jogador já transferido.
Corrigido com `ensureStarterTeam` (`career/services/
ensureLeagueTeams.ts`): a composição da liga (clube inicial + 6 rivais)
agora é resolvida a partir do clube inicial FIXO da nacionalidade,
nunca do clube atual do jogador — a liga não muda de membros só porque
alguém trocou de clube dentro dela. Adicionado teste de regressão
específico para este cenário.

**O que foi validado de verdade:** 52 testes novos desde a Fase 5 (221
no total): cálculo de recompensa/valor de mercado/contrato/proposta de
transferência (puro), `InMemoryWalletRepository` e
`InMemoryMarketRepository` (crédito/débito, saldo insuficiente não muda
o saldo, idempotência em chamada repetida E concorrente via
`Promise.all`), `ensureContract` (assina/renova/idempotente),
`listTransferOffers`/`acceptTransferOffer` (proposta bate entre consulta
e aceite, bônus menor que a taxa, cooldown bloqueia segunda
transferência, clube desconhecido rejeitado, transferência bloqueada com
lesão ativa), integração completa em `playCareerMatch` (recompensa +
salário somados batem com o saldo da carteira; depois de uma
transferência, a próxima partida já reflete o novo clube; a liga
continua com exatamente 7 clubes distintos, não duplicados).

**O que NÃO foi implementado (decisão consciente, não esquecido):**
- **Mercado de compra/venda de jogadores sintéticos.** A arquitetura do
  jogo (Fase 3) tem só UM jogador real por partida simulada — os outros
  21 são gerados na hora, não são entidades persistentes negociáveis.
  Um mercado de compra/venda faria sentido para uma arquitetura
  multi-jogador-real-por-elenco, que este produto não tem hoje.
- **Transferência internacional (entre ligas de nacionalidades
  diferentes).** Só entre o clube atual e os 6 rivais da MESMA liga.
- **Voltar ao clube inicial depois de sair dele.** O clube inicial não
  faz parte do pool de rivais, então nunca aparece como destino de
  proposta — uma vez que o jogador transfere para um rival, o caminho de
  volta ao clube inicial não existe (limitação aceita do modelo de "pool
  fixo de rivais").
- **Empréstimos (`TransferType.LOAN`).** Só transferência permanente
  (`PERMANENT`) está implementada; o enum já suporta `LOAN`/`FREE`, sem
  lógica ainda.
- **Diferenciação de reputação entre rivais.** Os 6 clubes rivais têm
  reputação fixa idêntica (45, decisão da Fase 5) — o gate de overall
  para receber proposta hoje é igual para todos, então não existe
  "clube grande" vs "clube pequeno" de verdade ainda.
- **Tokens** (segunda moeda) não tem fonte ou sumidouro — só existe
  porque o schema já a previa.
- **Limites/tetos de saldo** não implementados — nada hoje faria o saldo
  crescer rápido o bastante para isso importar.

## O que a Fase 7 entrega

`src/cards/` segue o mesmo padrão hexagonal: domínio puro
(`domain/catalog.ts`, `domain/packOpening.ts`, `domain/labels.ts`) →
porta (`ports/cardRepository.ts`) → adapters Prisma real + in-memory
(`adapters/`) → serviços (`services/ensureCatalog.ts`,
`services/listPacks.ts`, `services/openPack.ts`,
`services/viewCollection.ts`). `Card`/`CardPack`/`PackOdds`/`UserCard`/
`PackOpening` já existiam no schema desde a Fase 1; esta fase é a
primeira a escrever de verdade neles.

**Catálogo fixo, sem migração de schema.** 15 cartas fictícias (nomes
inventados, mesma disciplina de `career/domain/clubNaming.ts` para
clubes) e 3 pacotes (Bronze/Prata/Ouro, cada um com odds por raridade
diferentes — Ouro inclui a única carta SPECIAL, fixada via
`pinnedCardId`) vivem como constantes TypeScript em
`cards/domain/catalog.ts`, get-or-criadas idempotentemente por um id
fixo e legível (`"card-legendary-01"`, `"pack-ouro"`) em vez de um
`cuid()` gerado. Isso reaproveita exatamente o mesmo truque já usado
para o pool fixo de clubes rivais (Fase 4/5) — e, ao contrário do que
achei inicialmente necessário, **não precisou de nenhuma coluna nova no
schema**: `Card.id`/`CardPack.id` já aceitam um valor explícito no
`create`, só o `@default(cuid())` deixa de entrar em ação.

**Sorteio de pacote é puro e determinístico** (`cards/domain/
packOpening.ts`, `drawPackCards`): rola raridade por peso (reaproveita
`weightedPick`, já usado no motor de partida — não reinventado), depois
resolve pra uma carta específica (a pinada, ou uma aleatória dentro do
pool daquela raridade). 100% testável sem banco.

**O bug que quase entrou: idempotência que protegia o pagamento mas não
as cartas.** No primeiro rascunho, `openPack` gerava um nonce aleatório
por chamada para a idempotencyKey da carteira — o que protege contra
cobrança duplicada, mas um retry genuíno da MESMA interação do Discord
geraria um nonce DIFERENTE a cada tentativa, então se o pagamento já
tivesse sido debitado (idempotente, sem cobrar de novo) mas o desenho
das cartas fosse reexecutado, o jogador ganharia um segundo conjunto de
cartas de graça. Corrigido antes de qualquer teste ser escrito, não
depois de um bug encontrado: a chave de idempotência agora vem do
`interaction.id` do Discord (passado pela camada de comando como
`requestId`, nunca gerado dentro do serviço), e essa MESMA chave seedeia
o RNG do sorteio E vira o id explícito do `PackOpening` — então um retry
genuíno reproduz o mesmo sorteio e `CardRepository.recordPackOpening`
colide no id primário (mesmo padrão de captura de `P2002` já usado em
`PrismaWalletRepository`), devolvendo as cartas já sorteadas em vez de
criar um segundo lote. Testado explicitamente com dois `requestId`
iguais vs diferentes.

**Ordem das operações minimiza o pior caso.** `openPack` debita a
carteira (SINK) ANTES de sortear/persistir qualquer carta — se o saldo
não cobre, `InsufficientFundsError` interrompe tudo sem desenhar nada.
Se o processo cair entre o débito e o registro das cartas, o pior caso é
"pago mas sem cartas ainda" — recuperável com um retry (mesmo
`requestId` reproduz o mesmo sorteio e completa o registro), mesma
categoria de risco já aceita em Match/Injury, FixtureResult/MatchResult
e Contract/Transfer.

**Achado durante a autorrevisão desta fase (não um bug de código, um
gap de UX):** `/carteira` tinha rótulos amigáveis só para
`MATCH_REWARD`/`INTENSIVE_TRAINING` — as razões `SALARY` e
`TRANSFER_SIGNING_BONUS`, adicionadas na Fase 6b, apareciam no extrato
como o código cru em vez de um texto legível. Corrigido junto com a
adição de `PACK_PURCHASE` nesta fase.

**O que foi validado de verdade:** 20 testes novos (241 no total):
`drawPackCards` (determinismo, respeita pesos, carta pinada sempre
resolve pro id fixo, nunca escolhe fora do pool da raridade sorteada,
erro claro se o pool estiver vazio), `ensureCatalog`/
`InMemoryCardRepository` (catálogo idempotente, odds corretas, favoritar
só afeta o dono do UserCard), `openPack` (cobra o preço certo, garante
exatamente `cardCount` cartas, rejeita saldo insuficiente sem conceder
nada, rejeita pacote inexistente, retry idêntico não cobra nem sorteia
de novo, `requestId` diferente é uma compra nova de verdade, a carta
SPECIAL pinada do Pacote Ouro sempre resolve pro id certo), e
`viewCollection` (agrupa duplicatas com contagem, ordena por raridade).

**O que NÃO foi implementado (decisão consciente):**
- **Cartas não afetam gameplay.** É uma camada de colecionismo pura por
  enquanto — nenhuma carta altera squads, partidas ou atributos do
  jogador real. Conectar cartas ao motor de partida (ex.: "equipar" um
  bônus) é um gancho natural para uma fase futura, mas fazer isso agora
  misturaria a validação do loop de colecionismo com a do motor de
  partida antes de qualquer um dos dois estar provado sozinho.
- **Favoritar carta não tem comando dedicado.** `UserCard.isFavorite` e
  `CardRepository.setFavorite` existem e estão testados (inclusive a
  checagem de que só o dono pode favoritar a própria carta), mas nenhum
  comando Discord os expõe ainda — fica pronto para quando houver uma
  visão detalhada de carta (Fase 11, polish).
- **Level de carta (`UserCard.level`) sempre fica em 1.** Modelado no
  schema, sem nenhuma mecânica de evolução ainda.
- **`CardPack.priceTokens`** não é usado — todos os pacotes hoje só têm
  preço em coins, mesma situação de `Wallet.tokens` (Risco #21).
- **Catálogo é fixo e pequeno (15 cartas, 3 pacotes).** Sem eventos
  sazonais, cartas históricas ou expansão do catálogo — o suficiente pra
  provar o loop de abrir pacotes, não uma coleção "completa".
