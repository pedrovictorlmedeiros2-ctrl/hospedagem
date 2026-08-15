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
| 8 | Multiplayer (matchmaking, duelos, rating) | ✅ Implementada e testada — desafio direto, duelo simulado com o motor real, rating ELO, recompensa em coins | `/duelo-desafiar`, `/duelo-responder`, `/duelos`, 29 testes novos (270 no total). Ver seção "O que a Fase 8 entrega" abaixo |
| 9 | Global (top global, recordes, rivalidades, Hall of Fame, temporadas) | ✅ Ranking/recordes/rivalidades E rollover de temporada implementados e testados (rollover fechado num follow-up pós-Fase 11 — ver seção "Temporadas" abaixo) | `/ranking`, `/recordes`, `/rivalidade`, 29 testes novos (299 no total). Ver seção "O que a Fase 9 entrega" abaixo e adenda em docs/adr/0001 |
| 10 | Groq (narrativa: notícias, treinador, entrevistas) | ✅ Implementada e testada — funciona sem `GROQ_API_KEY` (fallback determinístico é o generator, não um modo degradado) | `/noticias`, `/treinador`, `/entrevista`, 41 testes novos (331 no total). Ver seção "O que a Fase 10 entrega" abaixo e adenda em docs/adr/0001 |
| 11 | Polish (UX, animações, acessibilidade, performance) | ✅ Implementada e testada — fecha os itens concretos de polish já adiados (carta detalhada/favoritar, N+1 de coleção, log vazando DATABASE_URL); revisão de acessibilidade sem achado; animações N/A pra Discord | `/carta`, `/favoritar`, 16 testes novos (347 no total). Ver seção "O que a Fase 11 entrega" abaixo e adenda em docs/adr/0001 |
| — | Temporadas (follow-up, fecha o Risco #33 deixado pela Fase 9) | ✅ Implementada e testada — rollover automático por liga, sem infraestrutura nova | `currentSeasonNumber` por carreira, `getOrCreateSeason`/`advanceCareerSeason`, 12 testes novos (352 no total). Ver seção "Temporadas: rollover automático" abaixo e adenda em docs/adr/0001 |
| — | Conquistas (follow-up, fecha o Risco #35 deixado pelas Fases 9/10) | ✅ Implementada e testada — catálogo fixo de 6 conquistas, desbloqueio síncrono integrado a carreira/duelo/pacote | `/conquistas`, 17 testes novos (369 no total). Ver seção "Conquistas" abaixo e adenda em docs/adr/0001 |

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

## O que a Fase 8 entrega

`src/multiplayer/` segue o mesmo padrão hexagonal: domínio puro
(`domain/elo.ts`, `domain/tier.ts`, `domain/duelReward.ts`,
`domain/labels.ts`, `domain/errors.ts`) → porta
(`ports/duelRepository.ts`) → adapters Prisma real + in-memory
(`adapters/`) → serviços (`services/challengeToDuel.ts`,
`services/respondToDuel.ts`, `services/listDuels.ts`). `Duel` já existia
no schema desde a Fase 1; esta é a primeira fase a escrever de verdade
nele.

**A primeira feature do projeto onde os DOIS lados são jogadores reais.**
Toda fase anterior era "o usuário que chama o comando vs. o mundo
compartilhado" (clube, mercado, cartas). Um duelo é literalmente dois
usuários do Discord reais competindo — isso mudou algumas decisões de
design:

- **Matchmaking v1 é desafio direto por menção (`/duelo-desafiar
  usuario:@Fulano`), não uma fila automática de pareamento.** Uma fila
  de verdade (pareamento automático por rating, held sujeita a
  concorrência entre múltiplos usuários entrando ao mesmo tempo) é
  infraestrutura real que não deveria ser construída sem dados de tráfego
  que a justifiquem — mesmo raciocínio já registrado no Risco #7 do ADR
  ("não adicionar infraestrutura sem tráfego real"). Desafio direto
  resolve "duelos multiplayer existem e funcionam" sem esse
  investimento.
- **O duelo é resolvido no motor de partida JÁ EXISTENTE, sem nenhuma
  mudança nele.** `buildSquadFromProfile` (Fase 3) já monta "um jogador
  real + 10 sintéticos" — um duelo simplesmente chama essa função duas
  vezes (uma pra cada jogador real) em vez de uma vez só + adversário
  totalmente sintético. Nenhuma linha do motor de simulação foi tocada.
- **O `Match` simulado do duelo não é persistido como `Match`/
  `MatchEvent`, só o `Duel` em si.** Mesma decisão estrutural já tomada
  em `/simular-amistoso` (Fase 3): não existe um `Team`/`Club` natural
  para ancorar o duelo (não é um jogo de liga, é 1x1 entre pessoas), e
  forçar a criação de times descartáveis só pra satisfazer as chaves
  estrangeiras de `Match` seria um mau uso do modelo. `Duel.matchId`
  fica null por enquanto — decisão consciente, documentada, mesmo padrão
  de honestidade de escopo da Fase 3.
- **`Player.globalRating` precisou de um valor inicial de verdade.** O
  schema tinha `@default(0)` — inofensivo enquanto nada lia esse campo,
  mas o primeiro duelo de qualquer jogador calcularia um gap de rating
  absurdo contra qualquer adversário que já tivesse jogado. Corrigido
  sem migração: `NewPlayerRecord` ganhou um campo `globalRating`
  explícito, e `createPlayerProfile` passa `STARTING_GLOBAL_RATING`
  (1000, definido em `player/domain/attributes.ts`) em vez de depender
  do default da coluna.
- **Rating ELO (fórmula padrão de xadrez, K=32).** Puro e testado
  isoladamente: soma zero entre os dois lados (a menos de
  arredondamento), justo-para-ambos em vitória/derrota, e recompensa mais
  um azarão vencendo um favorito do que o contrário. Tier (`DuelTier`) é
  hoje só um rótulo derivado da faixa de rating no momento do desafio —
  não restringe quem pode desafiar quem, decisão de escopo v1.
- **Ordem das operações em `respondToDuel`: resolver o duelo (transição
  guardada PENDING → FINISHED) ANTES de atualizar rating e pagar
  recompensa — não depois.** Diferente do resto da economia (Fases 6/7),
  onde a operação idempotente do wallet vem primeiro, aqui a atualização
  de rating (`Player.globalRating`) não tem nenhum mecanismo de
  idempotência próprio — é um valor absoluto, não um lançamento de
  ledger. Se a ordem fosse invertida, um retry genuíno depois de um
  crash reaplicaria o ELO uma segunda vez (corrompendo o rating). Com a
  transição do duelo como "trava" primeiro, o pior caso de uma queda no
  meio do caminho é "duelo resolvido mas rating/recompensa ainda não
  aplicados" — incompleto, não corrompido, recuperável — mesma categoria
  de risco já aceita em Injury/Match, FixtureResult/MatchResult e
  Contract/Transfer.
- **`UserRepository` ganhou `getById`.** Toda fase anterior só precisava
  resolver "Discord id → id interno" (`ensureUserForDiscordId`). Listar
  duelos (`/duelos`) precisa do caminho inverso — o `Duel` grava
  `challengerId`/`opponentId` como ids internos, e a UI do Discord
  precisa do `discordId` de volta pra mostrar o nome do adversário.

**O que foi validado de verdade:** 29 testes novos (270 no total):
`calculateEloUpdate` (soma zero entre os lados, simétrico ao inverter
quem venceu, zero num empate entre ratings iguais, favorito perde rating
num empate "esperado" ser vitória, K-factor escala o delta),
`tierForRating` (faixas corretas), `calculateDuelReward` (nunca zero),
`InMemoryDuelRepository` (transição guardada PENDING→FINISHED rejeita um
segundo resolve, `findOpenDuelBetween` funciona nos dois sentidos),
`challengeToDuel` (autodesafio bloqueado, oponente sem perfil bloqueado,
desafio duplicado bloqueado), `respondToDuel` (recusar não toca em
rating nem paga nada, aceitar atualiza os dois ratings em sentidos
opostos e paga os dois lados, responder um duelo já resolvido é
rejeitado com uma mensagem clara, responder sem ter um duelo pendente
daquele desafiante é rejeitado), `listDuels` (papel
CHALLENGER/OPPONENT correto, contraparte resolvida corretamente).

**O que NÃO foi implementado (decisão consciente):**
- **Fila de matchmaking automática.** Só desafio direto por menção — ver
  justificativa acima.
- **Tier não restringe quem pode desafiar quem.** Um BRONZE pode
  desafiar um ELITE hoje. Fica pra quando houver dados reais de uso pra
  saber se isso é um problema de verdade.
- **`Duel.matchId` nunca é preenchido** — o resultado do duelo não vira
  um `Match`/`MatchEvent` persistido, só o `Duel` com `winnerId`. Ver
  justificativa acima (mesmo padrão do `/simular-amistoso`).
- **`Rivalry`** (contagem de vitórias entre os mesmos dois jogadores ao
  longo do tempo) não foi tocado — pertence à Fase 9 (Global: rankings,
  recordes, rivalidades), que é exatamente onde o plano original já
  colocava essa feature, não uma omissão desta fase.
- **Sem limite de duelos simultâneos por jogador** — um usuário pode ter
  quantos desafios pendentes recebidos quiser ao mesmo tempo (contra
  adversários diferentes); só é bloqueado um segundo desafio contra o
  MESMO adversário enquanto o primeiro estiver aberto.

## O que a Fase 9 entrega

`src/global/` entra como um novo contexto hexagonal, mas com um formato
diferente de todo contexto anterior: não tem um "fluxo principal" próprio,
ele lê e reage a eventos de `career/` e `multiplayer/`. Domínio puro
(`domain/records.ts`, `domain/rivalry.ts`) → portas
(`ports/recordRepository.ts`, `ports/rivalryRepository.ts`) → adapters
Prisma real + in-memory (`adapters/`) → serviços
(`services/viewRanking.ts`, `services/checkAndUpdateRecord.ts`,
`services/viewRivalry.ts`, `services/viewRecords.ts`).

**Decisão de escopo, registrada antes de qualquer código:** o pedido
original de Fase 9 inclui "temporadas". Investigando o código, encontrei
que `getOrCreateActiveSeason` está hardcoded pra temporada 1 e
`leagueNameFor` nomeia a liga só pela nacionalidade (sem número de
temporada) — rollover de temporada é uma feature grande e hoje
inalcançável, sem nenhum caminho no código atual que leve a uma temporada
2. Implementá-la sem também corrigir `leagueNameFor` colidiria os nomes de
liga entre temporadas, e nada disso seria validável de ponta a ponta
neste ambiente (sem banco real). Decisão: entregar ranking/recordes/
rivalidades por completo, e documentar o gap como risco específico em vez
de uma versão rasa de "temporadas" que não pode ser provada. Mesmo
princípio de honestidade de escopo já usado nas Fases 3 e 8.

- **`/ranking` é computado ao vivo, sem `RankingSnapshot`.**
  `PlayerRepository.listTopPlayers(metric, limit)` faz `ORDER BY` + `LIMIT`
  direto (Prisma) ou um sort em memória (fake) a cada chamada. Sem
  tráfego real que justifique cache/job de recorrência, uma query
  ordenada já é instantânea e sempre correta — mesmo raciocínio do Risco
  #7 (não adicionar infraestrutura sem dados reais).
- **`Record` é append-only por desenho do schema** — sem unique constraint
  em `category` sozinho, então cada recorde quebrado grava uma linha nova,
  preservando o histórico completo de donos anteriores.
  `RecordRepository.getCurrentRecord` lê a linha mais recente por
  `achievedAt`; `setRecord` só cria, nunca faz update.
  `checkAndUpdateRecord` é check-then-act (não transacional) — mesma
  categoria de risco de corrida já aceita em `getOrCreateSeasonLeague`
  (Fase 5); o pior caso numa corrida real é uma linha de histórico a
  mais/perdida, nunca um valor corrompido.
- **`Rivalry.playerAId/playerBId` tem unique constraint direcional** —
  sem canonicalização o mesmo par de jogadores poderia fragmentar em duas
  linhas dependendo de quem desafiou primeiro. `canonicalizeRivalryPair`
  ordena os dois ids lexicograficamente antes de toda leitura/escrita.
- **Dois recordes no lançamento:** `HIGHEST_GLOBAL_RATING` (checado em
  `respondToDuel`, após a atualização de ELO) e `MOST_GOALS_SEASON`
  (checado em `playCareerMatch`, só quando `goals > 0`, pra não registrar
  "recorde de 0 gols" na primeira partida de carreira de qualquer
  jogador do mundo). Outras categorias ficam para quando houver sinal
  real de quais métricas os jogadores acompanham.
- **`respondToDuel` mantém a mesma ordem de operações da Fase 8:** a
  transição guardada do duelo (PENDING → FINISHED) continua vindo antes
  das atualizações de rating/recorde/rivalidade, porque nenhuma delas tem
  idempotência própria — um retry pós-crash não pode reaplicar ELO,
  recorde ou histórico de confronto uma segunda vez.
- **`PlayerRepository` ganhou `findById(playerId)`** (só existia
  `findByUserId`). `Record.holderPlayerId` e `Rivalry.playerAId/playerBId`
  guardam ids de `Player`, não de `User` — exibir o apelido do dono de um
  recorde exige resolver por esse id diretamente.

**O que foi validado de verdade:** 29 testes novos (299 no total):
`isNewRecord`/`canonicalizeRivalryPair` (domínio puro),
`InMemoryRecordRepository`/`InMemoryRivalryRepository` (persistência
append-only e canonicalização), `viewRanking` (ordena do maior pro menor,
respeita o limite, vazio sem jogadores), `checkAndUpdateRecord` (recorde
inédito, no-op quando não supera, atualiza e lembra o dono anterior),
`viewRivalry`/`viewRecords` (resolve apelidos, funciona nos dois sentidos
do par canonicalizado), `playCareerMatch` (reconhece `MOST_GOALS_SEASON`
com um seed determinístico onde o jogador real marca, não credita recorde
numa partida sem gols), `respondToDuel` (atualiza o histórico de
confronto e reporta o recorde mundial quando um é quebrado).

**O que NÃO foi implementado (decisão consciente):**
- **Rollover de temporada** — ver justificativa de escopo acima. Risco
  específico registrado no RISK_REGISTER.md.
- **Sistema de conquistas (`Achievement`/`UserAchievement`)** — mencionado
  no prompt mestre, mas é um sistema de progressão independente
  (definições, gatilhos, notificação) que merece seu próprio ciclo
  ANALISE→PLANEJE em vez de ser anexado apressadamente aqui.
- **Categorias de recorde além de rating e gols por temporada** (mais
  assistências, sequência de vitórias, etc.) — ficam para quando houver
  sinal real de uso.
- **UI de linha do tempo do histórico de recordes** — o histórico
  completo já existe no banco (append-only, nada descartado), só não tem
  uma superfície de Discord dedicada; `/recordes` mostra só o dono atual
  de cada categoria.

## O que a Fase 10 entrega

`src/narrative/` entra como um novo contexto hexagonal — mas, diferente
de todo contexto anterior, sua porta central (`NarrativeGenerator`) tem
TRÊS implementações compostas em camadas, não uma escolha entre
alternativas: domain/ (facts + templates puros e determinísticos) →
ports/ (`narrativeGenerator.ts`, `newsRepository.ts`) → adapters/
(`TemplateNarrativeGenerator`, `GroqNarrativeGenerator`,
`FallbackNarrativeGenerator`, Prisma + in-memory para `News`) →
services/ (`publishRecordNews.ts`, `askCoach.ts`,
`answerInterviewQuestion.ts`, `viewNews.ts`).

- **O fallback determinístico é o generator quando não há
  `GROQ_API_KEY` — não um modo degradado.** `TemplateNarrativeGenerator`
  é domínio puro (sem I/O), sempre disponível, sempre correto. Com a
  chave configurada, `FallbackNarrativeGenerator` (decorator) tenta
  `GroqNarrativeGenerator` primeiro e cai pro template em QUALQUER falha
  (erro de rede, timeout, resposta vazia, título/corpo não separados por
  linha) — nunca propaga o erro. Testado nos dois sentidos: sucesso do
  Groq é usado como está, qualquer exceção aciona o fallback.
- **`GroqNarrativeGenerator` depende de uma interface própria e estreita
  (`GroqChatClient`), não da classe `Groq` do SDK** — mesmo padrão de DI
  usado em todo adapter Prisma do projeto. Permite testar parsing e
  tratamento de erro com um cliente fake, sem rede real. Implementado e
  typechecado, mas NÃO validado contra a API real do Groq neste ambiente
  (sem `GROQ_API_KEY`) — mesmo tratamento dado a todo adapter Prisma.
- **A notícia de recorde mundial nunca é gerada no fluxo que quebrou o
  recorde.** `checkAndUpdateRecord` (Fase 9) ganhou uma dependência de
  `EventBus` e emite `RECORD_BROKEN` — tipo já modelado em
  `events/types.ts` desde a Fase 0/1, nunca emitido até agora. Um
  subscriber assíncrono em `src/index.ts` chama `publishRecordNews`.
  Como `EventBus.emit` nunca espera os handlers, uma chamada Groq lenta
  ou com falha jamais atrasa `/jogar-carreira` nem `/duelo-responder` —
  a materialização concreta da regra "Groq nunca no caminho crítico" já
  registrada desde o ADR original.
- **`/treinador` e `/entrevista` chamam o `NarrativeGenerator`
  sincronamente dentro do próprio comando** (diferente da notícia de
  recorde) — aqui a chamada narrativa É o propósito do comando, então uma
  falha do Groq só atinge aquele comando isolado, nunca o resultado de
  uma partida/economia/rating, e o fallback garante uma resposta útil de
  qualquer forma.
- **`/treinador` e `/entrevista` usam os mesmos fatos de temporada**
  (estágio, partidas/gols/assistências/nota média), diferenciados só por
  persona/prompt (treinador fala COM o jogador; entrevista responde COMO
  o jogador). Uma "última partida específica" pra entrevista exigiria uma
  nova consulta a `MatchRepository` que nenhuma outra feature precisa
  hoje — escopo mantido no que já é alcançável com o dado agregado
  existente.

**O que foi validado de verdade:** 41 testes novos (331 no total):
templates determinísticos (headline/body corretos, casos com/sem dono
anterior, mensagem de treinador reage a lesão/nota média, entrevista
ecoa a pergunta), `GroqNarrativeGenerator` (split título/corpo, erro em
resposta vazia ou sem separação de linha, via cliente fake),
`FallbackNarrativeGenerator` (usa a saída do Groq quando funciona, cai
pro template em qualquer exceção, loga o warning), `InMemoryNewsRepository`
(mais recente primeiro, respeita limite), `publishRecordNews` (publica
artigo, resolve e menciona o dono anterior, não falha quando o jogador não
é encontrado — só pula), `askCoach`/`answerInterviewQuestion` (fatos de
temporada corretos, valida pergunta vazia/longa demais),
`checkAndUpdateRecord` (emite `RECORD_BROKEN` só quando o recorde é
realmente batido, com o payload correto).

**O que NÃO foi implementado (decisão consciente):**
- **Só `RECORD_BROKEN` gera notícia hoje.** Outros gatilhos plausíveis
  (hat-trick, resultado surpreendente de liga, transferência de destaque)
  não foram conectados — `News` não tem relação com `User`/`Player`
  (sempre global), e mais gatilhos podem ser adicionados incrementalmente
  sem mudar a arquitetura.
- **`/entrevista` não se ancora numa partida específica** — usa o
  agregado de temporada, não o resultado da última partida jogada. Ver
  justificativa de escopo acima.
- **Sem rate limit dedicado em `/treinador`/`/entrevista`** além do que o
  próprio Discord já impõe em slash commands — se o custo de chamadas ao
  Groq se tornar um problema real de uso, um cooldown por jogador é a
  mitigação natural, adicionada quando houver tráfego real que a
  justifique (mesmo raciocínio do Risco #7).

## O que a Fase 11 entrega

"Polish" é tratado aqui como fechamento de itens concretos e já
registrados, não uma auditoria genérica sobre as 10 fases anteriores —
cada fase já revisa sua própria UX antes de ser marcada ✅, e o
ROADMAP.md sempre descreveu polish como "contínuo". Ver a justificativa
completa de escopo na adenda da Fase 11 em docs/adr/0001.

- **`/carta nome:...`** — visão detalhada de uma carta do catálogo:
  raridade, posição, overall, todos os atributos individuais, habilidade
  (quando existe), quantas cópias o usuário tem e se alguma está
  favoritada. `CardRepository` ganhou `findCardByName` (busca
  case-insensitive por nome) e `listAllCards`.
- **`/favoritar nome:...`** — fecha o Risco #28 (`setFavorite` já existia
  e já era testado desde a Fase 7, sem UI). É um toggle por nome de
  carta: cópias da mesma carta são fungíveis (level sempre 1 hoje), então
  não existe "qual cópia" pro usuário escolher — favorita a primeira
  cópia sem favorito, ou desfavorita a que já estiver marcada.
- **N+1 corrigido em `viewCollection`.** Antes: uma chamada
  `cardRepository.getCard(cardId)` por carta distinta na coleção. Agora:
  `listAllCards()` uma vez, indexado em memória — 2 chamadas fixas
  independente do tamanho da coleção.
- **Log de erro deixou de vazar `DATABASE_URL`.** Fecha o Risco #9
  (identificado na revisão de segurança da Fase 2, nunca mitigado até
  agora). `shared/redact.ts` escova qualquer connection string
  (`esquema://user:senha@host`) do `error` antes de todo `logger.error` —
  em `discord/client.ts` (falha de comando) e `src/index.ts`
  (`unhandledRejection` e o catch de topo de `main()`, este último lendo
  `process.env` diretamente pra cobrir até uma falha do próprio
  `loadEnv()`).
- **Acessibilidade revisada, sem achado.** Todo card Components V2 do
  projeto já combina cor de destaque com texto/emoji redundante — nunca
  só a cor carregando o significado.
- **Animações — não aplicável.** Slash commands com Components V2 não
  têm superfície de animação client-side; documentado explicitamente
  como N/A de plataforma, não como lacuna esquecida.

**O que foi validado de verdade:** 16 testes novos (347 no total):
`viewCardDetail` (rejeita nome inexistente, casa nome case-insensitive,
zero cópias antes de qualquer pacote, conta duplicatas e reflete cópia
favoritada), `toggleFavoriteCard` (rejeita carta inexistente, rejeita
favoritar carta não possuída, favorita no primeiro toggle, desfavorita
no segundo, nunca afeta a cópia de outro usuário), `redactSecrets`/
`redactError` (escova connection string, escova segredo literal
conhecido, não mexe em texto comum, preserva `name`/tipo do erro
original, passa por um valor não-Error/não-string sem alterá-lo).

**O que NÃO foi implementado (decisão consciente):**
- **Level de carta (`UserCard.level`) continua sempre 1** — nenhuma
  mecânica de evolução foi adicionada; é uma feature nova, não polish de
  algo já existente.
- **Sem auditoria de performance mais ampla.** Só o N+1 encontrado
  durante o trabalho de carta detalhada foi corrigido; uma varredura
  completa por N+1 em todo o codebase não foi feita — o catálogo de
  cartas era o único ponto onde o padrão N+1 crescia com um dado do
  usuário (tamanho da coleção) em vez de um dado fixo pequeno.
- **Pesos de IA/economia/sorteio de pacote não foram recalibrados**
  (Riscos #12/#20/#29) — dependem de dados reais de uso, não de mais um
  ajuste "no olho".

## Temporadas: rollover automático (follow-up, fecha o Risco #33)

A Fase 9 tinha adiado rollover de temporada por um motivo específico:
`getOrCreateActiveSeason` era fixo na temporada 1 pra sempre, e
`leagueNameFor` não incluía número de temporada — a suspeita registrada
na época era que implementar rollover sem antes corrigir isso colidiria
nomes de liga entre temporadas. Antes de codar este follow-up, essa
suspeita foi checada a fundo e uma pergunta de design genuína (não coberta
pela decisão de escopo da Fase 9) foi levada ao usuário — ver a adenda
completa em docs/adr/0001.

- **Rollover é automático e por liga, não um relógio global.** Ao
  esgotar os 12 fixtures da temporada atual, o próximo `/jogar-carreira`
  gera a temporada seguinte na hora (mesmos rivais, calendário novo) e já
  joga a primeira partida dela — nenhum comando extra, nenhum job
  agendado, nenhuma infraestrutura nova. `Career.currentSeasonNumber`
  (campo novo) é o que cada carreira usa pra saber em qual temporada
  está; não existe mais "a" temporada ativa única.
- **A suspeita de colisão da Fase 9 estava errada** — `Tournament` já
  tinha `@@unique([competitionId, seasonId])` no schema desde a Fase 5.
  A mesma competição (`Competition.name`, ex. "Liga de Acesso — BR")
  sempre pôde ter um `Tournament` por temporada sem colidir;
  `leagueNameFor` não precisou de nenhuma mudança.
- **Bug real encontrado (não o que a Fase 9 previu):**
  `InMemoryCompetitionRepository.getOrCreateSeasonLeague` — o adapter que
  TODOS os testes usam — chaveava o torneio só por `competitionName`,
  ignorando `seasonId`. Sem corrigir isso primeiro, os testes de rollover
  teriam reutilizado silenciosamente o calendário esgotado da temporada
  1. Corrigido antes de escrever qualquer teste novo.
- **`resolveLeagueForSeason`** (novo helper em `ensureLeagueTeams.ts`)
  elimina a duplicação que já existia entre `playCareerMatch.ts` e
  `viewStandings.ts` — os dois resolviam rivais/clube inicial/torneio com
  o mesmo bloco de código copiado.
- **`seasonNameFor(number)`** substitui o nome fixo "SEASON 01 — THE
  BEGINNING" por uma lista cíclica de epítetos, puro e testado.

**O que foi validado de verdade:** 12 testes novos (352 no total):
`seasonNameFor` (zero-padding, cicla os epítetos, determinístico),
`playCareerMatch` (12 partidas fecham a temporada 1 sem rollover, a 13ª
chamada rola automaticamente pra temporada 2, `viewStandings` reflete o
calendário zerado da temporada 2, encadeamento continua funcionando até
a temporada 3 depois de 25 partidas).

**O que NÃO foi implementado (decisão consciente):**
- **Sem UI de histórico multi-temporada** (ex.: comparar temporada 1 vs.
  temporada 2 lado a lado) — cada `/classificacao` mostra só a temporada
  atual da carreira.
- **`nextCareerStage` não foi recalibrado** para o novo comportamento de
  "contadores por temporada resetam" — a função já era monotônica
  (nunca rebaixa estágio), então nenhuma correção era necessária, mas o
  RITMO de promoção agora pode variar mais entre carreiras que rolam de
  temporada rápido vs. devagar. Mesma categoria de risco de balanceamento
  já aceita nos Riscos #12/#20.

## Conquistas (follow-up, fecha o Risco #35)

`Achievement`/`UserAchievement` já existiam no schema desde a Fase 0 —
este follow-up é só ports/adapters/serviços/comandos, sem migration
nova. Novo contexto hexagonal `src/achievements/`: domínio (catálogo
fixo de 6 conquistas) → porta (`AchievementRepository`) → adapters
Prisma + in-memory → serviços (`checkAndUnlockAchievements`,
`viewAchievements`).

- **6 conquistas no v1**, cada uma disparada por um dado que o chamador
  já tem em mãos: `FIRST_MATCH`/`FIRST_WIN`/`FIRST_GOAL` (em
  `playCareerMatch`), `WORLD_RECORD` (em `playCareerMatch` e
  `respondToDuel`, quando `checkAndUpdateRecord` confirma um recorde
  batido), `DUEL_WINNER` (em `respondToDuel`, pro lado vencedor),
  `FIRST_PACK` (em `openPack`). Nenhuma instrumentação de evento nova
  foi necessária.
- **Desbloqueio é síncrono, não um evento assíncrono** — diferente da
  notícia de recorde (Fase 10), que roda via `EventBus` porque envolve
  uma chamada a LLM lenta/não confiável. Desbloquear uma conquista é uma
  escrita de banco rápida e determinística, então
  `checkAndUnlockAchievements` é chamado direto dentro de
  `playCareerMatch`/`respondToDuel`/`openPack`, e o resultado
  (`achievementsUnlocked`) já sai no mesmo output que a UI usa — dá pra
  celebrar na mesma resposta do comando, sem precisar de um segundo turno.
- **`unlock` é idempotente por (userId, key)** — `true` só na primeira
  vez, `false` em toda chamada seguinte. Os call sites só "declaram
  candidatos" sem se preocupar em checar se o usuário já tem a conquista.
- **`/conquistas`** mostra o catálogo inteiro — desbloqueadas (✅) e
  bloqueadas (🔒) — dando uma noção de progresso ("3/6"), mesmo padrão
  de "mostrar o que falta" já usado em `/recordes`.
- **`achievementUnlockLines`** (novo, `discord/ui/`) é reaproveitado por
  `careerMatchResultCard.ts`, `duelResultCard.ts` (uma vez por lado do
  duelo) e `abrirPacote.ts`.

**O que foi validado de verdade:** 17 testes novos (369 no total):
`InMemoryAchievementRepository` (unlock idempotente, isolado por
usuário, lista mais-recente-primeiro), `checkAndUnlockAchievements`
(unlocks em lote, não re-reporta o que já foi desbloqueado, semeia o
catálogo sozinho), `viewAchievements` (catálogo completo bloqueado antes
de qualquer unlock, reflete timestamp real, nunca mistura usuários),
integração em `playCareerMatch` (FIRST_MATCH na primeira partida e nunca
mais, FIRST_GOAL+WORLD_RECORD juntos reaproveitando o seed
"goal-search-2" da Fase 9, FIRST_WIN com um seed determinístico
brute-forced "win-search-13"), `respondToDuel` (DUEL_WINNER pro lado
certo, WORLD_RECORD pro lado que realmente bateu o recorde), `openPack`
(FIRST_PACK no primeiro pacote e nunca mais).

**O que NÃO foi implementado (decisão consciente):**
- **Conquistas de contador vitalício** (ex.: "jogue 10 partidas",
  "vença 5 duelos") ficaram fora — exigiriam um agregado cross-temporada
  que `PlayerSeasonStat` não mantém hoje (é escopado por temporada, e
  temporadas resetam via rollover). Fica para quando houver justificativa
  de produto para esse tipo de agregado.
- **Sem notificação/celebração fora do card da ação que desbloqueou** —
  uma conquista só aparece na resposta do comando que a disparou; não há
  um DM ou canal de anúncio separado.
- **Level de recompensa por conquista não existe** — desbloquear uma
  conquista hoje não paga coins nem dá cartas, é puramente de progresso/
  vaidade. Adicionar recompensa é uma extensão pequena quando houver
  justificativa de produto.

## Revisão de segurança/concorrência da economia (follow-up)

Pedido explícito do usuário depois do follow-up de Conquistas: revisar
o codebase inteiro atrás de bugs e, especificamente, formas de "quebrar
a economia" via corrida. Não é uma nova feature — é uma auditoria +
correção, seguindo o mesmo ciclo ANALISE→PLANEJE→IMPLEMENTE→TESTE já
usado em toda fase anterior, desta vez aplicado a código já existente
em vez de código novo.

**Metodologia:** auditoria de todo ponto de construção de
`idempotencyKey` no codebase; scripts throwaway (`npx tsx`, apagados
depois de extrair o achado) disparando `Promise.all`/`Promise.allSettled`
contra os adapters in-memory pra confirmar ou descartar cada suspeita
empiricamente, em vez de só por leitura de código. `respondToDuel`
(Fase 8) serviu de controle positivo — sua transição de estado guardada
PENDING→FINISHED foi reconfirmada segura sob corrida real, e virou o
modelo de referência ("claim atômico é sempre a última porta antes da
mutação irreversível") pro resto da auditoria.

**3 races reais confirmadas e corrigidas** (detalhe completo nos Riscos
#45–47 em `docs/RISK_REGISTER.md`, decisão de design na adenda
correspondente do ADR 0001):

1. **`MatchRepository.persistMatchResult`** sem nenhuma proteção de
   idempotência em `existingMatchId` — a mais severa, porque é a
   fronteira de integridade mais central do produto (resultado de
   partida) e tinha MENOS proteção que qualquer outro caminho de
   escrita do sistema. Duas chamadas concorrentes de `/jogar-carreira`
   pra mesma rodada triplicavam `PlayerSeasonStat`, abrindo caminho pra
   promoção de estágio de carreira ilegítima.
2. **Bônus de assinatura de transferência** (`acceptTransferOffer`) —
   a `idempotencyKey` do bônus é escopada por clube de destino, então
   duas transferências concorrentes pra clubes DIFERENTES driblavam o
   cooldown de 30 dias inteiro e pagavam bônus duplicado (confirmado
   empiricamente: 2x o bônus numa corrida de teste).
3. **Cooldown de treino** (`trainPlayer`) — mesmo formato de race
   (check-then-act com `await`s no meio), sessões de treino duplicadas
   dentro da janela de 20h.

**Correção comum às três:** um claim atômico (compare-and-swap via
`UPDATE ... WHERE campo IS NULL OR <= cutoff`, que o lock de linha do
Postgres serializa) chamado como a ÚLTIMA porta antes da mutação
irreversível — nunca a primeira, porque claim-antes-de-checar
desperdiçaria o cooldown do jogador numa tentativa que falhou por outro
motivo (estamina baixa, saldo insuficiente, lesão ativa). Dois campos
novos (`Career.lastTransferClaimAt`, `Player.lastTrainingClaimAt`),
adicionados na mesma migration inicial — ainda não aplicada contra um
Postgres real neste ambiente.

**Um quarto achado, também corrigido** (Risco #48): `grantMatchReward`
sempre reportava `amount` no valor recém-calculado mesmo numa chamada
deduplicada — puramente cosmético (o saldo real da carteira sempre
esteve protegido), mas corrigido no mesmo pacote: `amount` agora reporta
`0` quando `alreadyGranted` é `true`, mesmo padrão que `salaryPaid` já
usava.

**O que foi validado de verdade:** 4 testes de regressão novos (373 no
total) convertendo cada script throwaway num cenário `Promise.allSettled`
permanente em vitest (`playCareerMatch.test.ts`,
`acceptTransferOffer.test.ts`, `trainPlayer.test.ts`,
`grantMatchReward.test.ts`), confirmando não só que a chamada perdedora
é rejeitada, mas que o estado final (saldo de carteira,
`PlayerSeasonStat`, atributos do jogador, valor reportado ao chamador)
reflete exatamente UMA operação bem-sucedida. `npx tsc --noEmit`, `npx
eslint .`, `npx vitest run` (373 passando) e `npm run build` — todos
limpos.

## Polish visual (follow-up)

Feedback direto de um usuário real testando o bot localmente pela
primeira vez: "achei 100% comandos e não tem muitas coisas igual um
FIFA". Levantamento das opções de melhoria (visual, profundidade de
gameplay ao vivo, quantidade de conteúdo) e decisão consciente de
começar pelo visual — menor risco, resultado visível imediato, sem
mexer em arquitetura ou nos fluxos de jogo já testados.

- **`discord/ui/progressBar.ts`** (novo) — helper compartilhado que
  renderiza uma barra unicode fixa (`▰▰▰▰▰▰▰▱▱▱`) pra qualquer métrica
  0..max. Discord não tem componente nativo de barra de progresso;
  dentro de um bloco de código (` ``` `) o conteúdo é monoespaçado de
  verdade, o que os TextDisplays normais não garantem.
- **`/carreira` (perfil e carreira)**: cartão de perfil ganhou uma
  grade de atributos estilo carta do FIFA — 3 letras + barra + valor
  (RIT/FIN/PAS/DRI/MAR/FIS pra jogador de linha, REF/POS/SEG/AER/1v1/PEN
  pro goleiro, ver `player/domain/labels.ts`). Cartão de carreira ganhou
  barra de estamina e barra de progresso da temporada (partidas
  jogadas/12, liga é sempre um returno duplo contra os 6 rivais).
- **Cartões de resultado de partida** (`/jogar-carreira`,
  `/simular-amistoso`, `/duelo-responder`): posse de bola virou barra
  visual em vez de só dois números; seção de destaques ganhou um
  cabeçalho "🎥 Melhores momentos" pra separar melhor do resumo. Os
  ícones por tipo de evento (⚽🟨🟥🚑❌🚩) já existiam desde a Fase 3 no
  motor (`game/engine/commentary.ts`) — não precisou de mudança ali.
- **`/classificacao`**: top 3 do campeonato ganhou medalha (🥇🥈🥉) em
  vez de só "1.", "2.", "3.".
- Nenhuma mudança em domínio/serviço/porta — só nos builders de UI
  (`discord/ui/*.ts`). Validado com um script throwaway renderizando
  cada card (perfil de linha, perfil de goleiro, carreira, classificação)
  e inspecionando o JSON gerado antes de apagar o script. `npx tsc
  --noEmit`, `npx eslint .`, `npx vitest run` (373, nada quebrou) e `npm
  run build` — todos limpos.
- **O que fica pra depois, por decisão consciente**: quantidade de
  conteúdo (mais clubes/cartas) e gameplay ao vivo (decisões de tática/
  substituição durante a partida) — a segunda é uma mudança de
  arquitetura bem maior (a partida hoje é simulada inteira de uma vez,
  não pausa em pontos de decisão) e foi deliberadamente deixada fora
  deste follow-up.
