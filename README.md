# Football Game

Jogo de futebol completo integrado ao Discord — carreira, competições,
cartas, economia, multiplayer e ranking global, com Discord Components V2
como interface principal.

Estado atual: **Fase 6 — Economy** implementada e testada dentro do
escopo redefinido: coins, recompensa de partida, treino intensivo pago,
contratos com salário por partida e transferências entre clubes da liga
— tudo com ledger auditável e à prova de duplicação/corrida. Fases 2 a 5
completas. A integração real com Discord e Postgres ainda não foi
validada neste ambiente (sem credenciais) — ver `docs/ROADMAP.md` para o
que "implementado" significa em cada fase (inclusive o que ficou de fora
do mercado/transferências por decisão consciente), e
`docs/adr/0001-stack-and-architecture.md` para as decisões de
arquitetura.

## Comandos do jogo

| Comando | O que faz |
|---------|-----------|
| `/ping` | Health check do bot + banco de dados |
| `/criar-perfil` | Cria o jogador (nome, apelido, nacionalidade, idade, posição, pé, altura, estilo, número) |
| `/personalizar identidade` | Edita nome, apelido, número, frase e comemoração |
| `/personalizar visual` | Edita cores, tema, estilo de carta, moldura e fundo (cosmético, sem efeito no gameplay) |
| `/simular-amistoso` | Simula uma partida de teste do motor contra um adversário sintético (não persiste no banco) |
| `/carreira` | Mostra clube, estágio de carreira, estatísticas da temporada e status de lesão |
| `/treinar` | Treina um atributo (uma sessão por dia, retorno decrescente perto do limite); opção "intensivo" dobra o ganho por coins, mesmo cooldown |
| `/jogar-carreira` | Joga a próxima rodada agendada da liga — persiste no banco, atualiza classificação/estatísticas, paga recompensa em coins e pode promover/lesionar o jogador |
| `/classificacao` | Mostra a tabela da liga (pontos, saldo de gols, posição do seu clube) |
| `/carteira` | Mostra seu saldo de coins e o histórico recente de movimentações |
| `/contrato` | Mostra seu contrato atual: salário por partida, cláusula de rescisão e validade |
| `/propostas` | Lista propostas de transferência de outros clubes da sua liga |
| `/transferir` | Aceita uma proposta de transferência e assina com o novo clube |

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
