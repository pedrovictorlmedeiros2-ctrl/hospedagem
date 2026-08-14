# Football Game

Jogo de futebol completo integrado ao Discord — carreira, competições,
cartas, economia, multiplayer e ranking global, com Discord Components V2
como interface principal.

Estado atual: **Fase 4 — Career** implementada e testada (`/carreira`,
`/treinar`, `/jogar-carreira` — a primeira partida que persiste de
verdade em `Match`/`MatchEvent`/`PlayerSeasonStat`), além das Fases 2 e 3
completas. A integração real com Discord e Postgres ainda não foi
validada neste ambiente (sem credenciais) — ver `docs/ROADMAP.md` para o
que "implementado" significa em cada fase, e
`docs/adr/0001-stack-and-architecture.md` para as decisões de arquitetura.

## Comandos do jogo

| Comando | O que faz |
|---------|-----------|
| `/ping` | Health check do bot + banco de dados |
| `/criar-perfil` | Cria o jogador (nome, apelido, nacionalidade, idade, posição, pé, altura, estilo, número) |
| `/personalizar identidade` | Edita nome, apelido, número, frase e comemoração |
| `/personalizar visual` | Edita cores, tema, estilo de carta, moldura e fundo (cosmético, sem efeito no gameplay) |
| `/simular-amistoso` | Simula uma partida de teste do motor contra um adversário sintético (não persiste no banco) |
| `/carreira` | Mostra clube, estágio de carreira, estatísticas da temporada e status de lesão |
| `/treinar` | Treina um atributo (uma sessão por dia, retorno decrescente perto do limite) |
| `/jogar-carreira` | Joga a próxima partida pelo clube atual — persiste no banco, atualiza estatísticas e pode promover/lesionar o jogador |

## Stack

- Node.js 20+, TypeScript (strict, ESM)
- discord.js v14 (Components V2)
- PostgreSQL + Prisma
- Groq SDK (camada narrativa, isolada do gameplay)
- pino (logs estruturados) + zod (validação de env) + vitest (testes)

## Setup

```bash
npm install
cp .env.example .env   # preencher DISCORD_BOT_TOKEN, DISCORD_CLIENT_ID, DATABASE_URL
npx prisma generate
npx prisma migrate dev # requer DATABASE_URL válida
npm run deploy-commands # registra os slash commands no Discord
npm run dev
```

## Scripts

| Script | O que faz |
|--------|-----------|
| `npm run dev` | roda o bot em modo watch |
| `npm run build` / `npm start` | build de produção |
| `npm test` | testes unitários (não requerem credenciais) |
| `npm run lint` / `npm run typecheck` | qualidade de código |
| `npm run deploy-commands` | registra slash commands no Discord |
| `npm run prisma:migrate` | roda migrations contra `DATABASE_URL` |

## Documentação

- `docs/adr/` — Architecture Decision Records
- `docs/DATABASE.md` — modelo de dados e por quê
- `docs/ROADMAP.md` — fases, status e bloqueios ativos
- `docs/RISK_REGISTER.md` — riscos conhecidos e mitigação
