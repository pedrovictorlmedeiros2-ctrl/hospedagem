# Development Roadmap

Uma fase só é marcada ✅ quando: código escrito, testado, integrado e
documentado — nunca só "código escrito". Ver Definition of Done no
briefing original do produto.

| Fase | Nome | Status | Notas |
|------|------|--------|-------|
| 0 | Discovery | ✅ | ADR 0001, DATABASE.md, RISK_REGISTER.md, este roadmap |
| 1 | Foundation | ✅ | Projeto TS, lint/format, logger, Prisma schema completo, event bus tipado, Discord client + 1 comando real (`/ping`) com Components V2, testes unitários, CI local (typecheck/lint/test) verde |
| 2 | Player (`/criar-perfil`, personalização) | ⏳ Não iniciada | Depende de credenciais reais para testar o fluxo Discord ponta a ponta |
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
