# Football Game

Jogo de futebol completo integrado ao Discord — carreira, competições,
cartas, economia, multiplayer e ranking global, com Discord Components V2
como interface principal.

Estado atual: **Fase 3 — Game Engine** com o núcleo do motor de partida
implementado e testado (`/simular-amistoso`), além da Fase 2 completa
(`/criar-perfil`, `/personalizar`). A integração real com Discord e
Postgres ainda não foi validada neste ambiente (sem credenciais), e a
partida ainda não persiste no banco nem tem interface ao vivo por botão —
ver `docs/ROADMAP.md` para o que "implementado" significa em cada fase, e
`docs/adr/0001-stack-and-architecture.md` para as decisões de arquitetura.

## Comandos do jogo

| Comando | O que faz |
|---------|-----------|
| `/ping` | Health check do bot + banco de dados |
| `/criar-perfil` | Cria o jogador (nome, apelido, nacionalidade, idade, posição, pé, altura, estilo, número) |
| `/personalizar identidade` | Edita nome, apelido, número, frase e comemoração |
| `/personalizar visual` | Edita cores, tema, estilo de carta, moldura e fundo (cosmético, sem efeito no gameplay) |
| `/simular-amistoso` | Simula uma partida completa do seu jogador contra um adversário sintético — mostra placar, posse e lances (motor de partida, sem interface ao vivo ainda) |

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
