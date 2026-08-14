# Football Game

Jogo de futebol completo integrado ao Discord — carreira, competições,
cartas, economia, multiplayer e ranking global, com Discord Components V2
como interface principal.

Estado atual: **Fase 10 — Groq (narrativa)** implementada e testada —
notícias de recordes mundiais, conselhos do técnico e entrevistas pós-jogo
geradas por LLM, com fallback determinístico sempre disponível mesmo sem
`GROQ_API_KEY`. Fases 2 a 9 completas (carreira, competições, economia com
salário/transferências, cartas colecionáveis, duelos multiplayer com
rating ELO, ranking/recordes/rivalidades globais). Rollover de temporada
segue adiado (ver `docs/RISK_REGISTER.md`, risco #33). A integração real com
Discord e Postgres ainda não foi validada neste ambiente (sem
credenciais) — ver `docs/ROADMAP.md` para o que "implementado" significa
em cada fase, e `docs/adr/0001-stack-and-architecture.md` para as
decisões de arquitetura.

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
| `/pacotes` | Mostra os pacotes de cartas disponíveis para comprar |
| `/abrir-pacote` | Compra e abre um pacote — sorteia cartas por raridade e as adiciona à coleção |
| `/colecao` | Mostra sua coleção de cartas, agrupada com contagem |
| `/duelo-desafiar` | Desafia outro usuário do Discord para um duelo 1x1 |
| `/duelo-responder` | Aceita ou recusa um desafio recebido — se aceitar, o duelo é simulado na hora |
| `/duelos` | Mostra seus duelos recentes (enviados e recebidos) |
| `/ranking` | Mostra o ranking global de jogadores por rating (ELO) ou overall |
| `/recordes` | Mostra o Hall da Fama — os atuais recordes mundiais do jogo |
| `/rivalidade` | Mostra o histórico de confrontos (vitórias/derrotas) contra outro jogador |
| `/noticias` | Mostra as últimas notícias do mundo do jogo (hoje: recordes mundiais quebrados) |
| `/treinador` | Pede um conselho ao técnico sobre o andamento da temporada |
| `/entrevista pergunta:...` | Faz uma pergunta de entrevista pro seu jogador responder, em primeira pessoa |

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
