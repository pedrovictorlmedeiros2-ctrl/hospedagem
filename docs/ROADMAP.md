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
| 6 | Economy (coins, mercado, transferências, contratos) | ⏳ Não iniciada | Schema do ledger já modelado (WalletTransaction) |
| 7 | Cards (cartas, packs, inventário) | ⏳ Não iniciada | Schema já modelado (Card/CardPack/PackOdds/UserCard) |
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
