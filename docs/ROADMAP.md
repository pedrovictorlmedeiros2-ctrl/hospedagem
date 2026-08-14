# Development Roadmap

Uma fase só é marcada ✅ quando: código escrito, testado, integrado e
documentado — nunca só "código escrito". Ver Definition of Done no
briefing original do produto.

| Fase | Nome | Status | Notas |
|------|------|--------|-------|
| 0 | Discovery | ✅ | ADR 0001, DATABASE.md, RISK_REGISTER.md, este roadmap |
| 1 | Foundation | ✅ | Projeto TS, lint/format, logger, Prisma schema completo, event bus tipado, Discord client + 1 comando real (`/ping`) com Components V2, testes unitários, CI local (typecheck/lint/test) verde |
| 2 | Player (`/criar-perfil`, personalização) | 🟡 Implementado, não validado contra Discord/Postgres reais | Domínio + serviços + comandos completos, 57 testes unitários verdes. Ver seção "O que 'implementado' significa aqui" abaixo |
| 3 | Game Engine (núcleo da partida, IA) | ⏳ Não iniciada | Maior risco técnico do projeto — ver RISK_REGISTER #3 |
| 4 | Career (treino, escalação, calendário) | ⏳ Não iniciada | |
| 5 | Competitions (ligas, copas, temporadas, seleção) | ⏳ Não iniciada | Schema já suporta genericamente (Competition/Tournament/Stage) |
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
