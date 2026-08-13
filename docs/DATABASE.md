# Database Design

Schema completo em `prisma/schema.prisma`. Este documento explica as
decisões que não são óbvias só de ler o schema.

## Princípios

- **Sem JSON gigante.** Cada entidade do briefing (`User`, `Player`, `Club`,
  `Team`, `Season`, `Match`, `Competition`, `Tournament`, `Transfer`,
  `Contract`, `Card`, `CardPack`, `Inventory`, `PlayerStats`, `Career`,
  `Training`, `Injury`, `Notification`, `News`, `Ranking`, `Achievement`,
  `Rivalry`, `Record`) é uma tabela relacional própria, não um blob.
- **`Json` só para dados verdadeiramente flexíveis**, nunca para relações
  que precisam ser consultadas/agregadas (ex.: `Card.attributes` é `Json`
  porque é um bag de atributos cosmético-ish por versão da carta; já
  `MatchPlayerStat` tem colunas explícitas porque ranking/rating fazem
  agregação SQL em cima disso).
- **Economia é um ledger append-only, não um contador.** `Wallet.coins` é
  cache do saldo; a fonte de verdade é `WalletTransaction`, com
  `idempotencyKey` único — isso é o que impede duplicação de recompensa e
  torna a operação segura sob concorrência (duas requisições com a mesma
  `idempotencyKey` não conseguem aplicar o efeito duas vezes).
- **OVR, Form e Global Rating são três colunas diferentes** em `Player`
  (`overall`, `form`, `globalRating`), exatamente porque o briefing exige
  que não sejam a mesma métrica.

## Decisões específicas

### `Team` vs `Club`

`Club` é a organização persistente (nome, país, orçamento, reputação).
`Team` é o elenco de um `Club` (ou de uma seleção nacional, via
`kind: NATIONAL`) **para uma `Season` específica** — isso é o que permite
elenco mudar de temporada pra temporada sem reescrever histórico. O vínculo
jogador↔elenco fica em `TeamPlayer`, com `joinedAt`/`leftAt`, então dá pra
reconstruir "quem jogava em que time em que data" sem ambiguidade.

### `Tournament` genérico, não uma tabela por competição

`Competition` (definição: Brasileirão, Libertadores, Copa do Mundo...) e
`Tournament` (uma edição dessa competição numa `Season`) são genéricos de
propósito — o briefing proíbe explicitamente hardcode de uma competição
específica. `TournamentStage` modela grupos/oitavas/quartas/semi/final como
dados, não como código.

### Eventos de partida (`MatchEvent`) em vez de só o placar

Gols, cartões, escanteios, pênaltis e substituições viram linhas em
`MatchEvent` com `minute` e `metadata` (Json, para dados específicos do tipo
de evento, ex. quem deu a assistência). Isso serve dois propósitos: permite
reconstruir a linha do tempo da partida, e é a fonte de fatos estruturados
para o sistema de notícias (Groq narra `MatchEvent`s, nunca inventa
estatística).

### Por que `Record.previousHolderId` é `String?` solto, sem FK

`Record` referencia o jogador anterior que detinha a marca só para exibir
"quem foi quebrado", não para navegação relacional — mantido como campo
solto (sem `@relation`) para não criar uma segunda FK para `Player` que
exigiria `onDelete` cuidadoso sem ganho real de uso.

## O que este schema conscientemente NÃO modela ainda

- Estado interno do motor de partida em tempo real (posição de cada
  jogador em cada tick, física da bola). Isso é estado de runtime da Fase
  3, não dado persistente — só o *resultado* (placar, eventos, stats) é
  gravado. Ver ADR 0001.
- Pesos/parâmetros da IA adaptativa — também runtime, não schema.
- Qualquer coisa de monetização real (compra com dinheiro real). O
  briefing pede transparência/compliance *se* houver — não foi pedido para
  implementar agora, então não foi modelado para evitar campos mortos.

## Migrations

Nenhuma migration foi rodada ainda porque não há `DATABASE_URL` real neste
ambiente. `npx prisma generate` roda sem banco (só lê o schema) e foi usado
para validar que o schema compila. `npx prisma migrate dev` precisa de uma
connection string real de Postgres — isso é uma decisão/ação do usuário
(ver docs/adr/0001, seção Consequências).
