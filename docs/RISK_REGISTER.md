# Risk Register

Atualizado a cada fase. Um risco só sai da lista quando mitigado
de verdade (código + teste), nunca só por ter sido discutido.

| # | Risco | Impacto | Mitigação planejada | Status |
|---|-------|---------|----------------------|--------|
| 1 | Escopo do produto é maior que o razoável para um único ciclo de desenvolvimento | Alto — risco de gerar código superficial e não testado se tentado de uma vez | Roadmap faseado (docs/ROADMAP.md), Definition of Done por fase, nunca declarar fase concluída sem teste real | Ativo — mitigado por processo |
| 2 | Credenciais reais (Discord, Groq, Postgres) não disponíveis neste ambiente | Médio — impede testes de integração e execução real do bot | Todo o código parametrizado via `.env`/zod; testes unitários não dependem de credenciais; pedir credenciais ao usuário antes da Fase 2 em diante | Ativo |
| 3 | Motor de partida (Fase 3) é a peça de maior complexidade técnica (IA, estados, sincronização com Discord) | Alto — pode virar gargalo de performance ou bugs de concorrência | Desenhar como state machine determinística e testável isoladamente do Discord, sem I/O na lógica pura | Planejado |
| 4 | Economia (coins) sujeita a duplicação/race condition | Alto — quebra a integridade do produto | Ledger append-only (`WalletTransaction`) com `idempotencyKey` único; nunca mutar saldo diretamente (ver prisma/schema.prisma) | Modelado, lógica de aplicação pendente (Fase 6) |
| 5 | Groq indisponível ou retornando texto inválido | Baixo/Médio — não pode derrubar o jogo | Groq isolado numa camada de serviço com fallback determinístico (texto gerado por template); nunca chamado no caminho crítico de gameplay | Planejado (Fase 10) |
| 6 | Reinício do processo durante uma partida em andamento | Médio — partida não pode "sumir" | Estado da partida persistido incrementalmente (eventos de partida gravados conforme ocorrem, não só no fim); recovery na inicialização | Planejado (Fase 3) |
| 7 | Volume de usuários simultâneos desconhecido | Médio | Não adicionar infraestrutura (Redis/filas) sem tráfego real que justifique — decisão registrada em ADR 0001; reavaliar a cada fase com dados reais | Monitorando |
| 8 | Vulnerabilidades em dependências transitivas (`npm audit` reportou 5 no scaffold inicial) | Baixo no momento (sem deploy) | Revisar `npm audit` antes de qualquer deploy real; não usar `--force` sem entender a mudança breaking | Ativo — ver nota abaixo |

| 9 | Erros de conexão do Prisma podem incluir a connection string (com credenciais) na mensagem de erro, e `client.ts` loga `error` inteiro | Médio — vazamento de credencial em log | Não implementado ainda; próximo passo é redigir/filtrar `DATABASE_URL` antes de logar erros de infraestrutura | Identificado na revisão de segurança da Fase 2, não mitigado |
| 10 | Nome/apelido de jogador não são únicos globalmente (só `userId` é) | Baixo — decisão consciente, não bug | Documentado em docs/DATABASE.md; se precisar de unicidade de apelido no futuro, exige checar colisão + UX de sugestão de alternativa | Decisão aceita |
| 11 | Lista de nacionalidades válidas (`KNOWN_NATIONALITIES`) é um subconjunto curado do ISO 3166-1 alpha-2, não o catálogo completo | Baixo — jogador de um país fora da lista não consegue criar perfil | Documentado no próprio código; ampliar a lista é uma mudança pequena e segura quando um usuário real esbarrar nisso | Aceito por ora |

| 12 | Pesos de decisão da IA (`src/game/ai/decide.ts`) e constantes de resolução de ação (`resolveAction.ts`) são heurísticas ajustadas "no olho", não calibradas com dados reais | Médio — balanceamento pode estar longe do realista (ex.: média de ~2 gols/partida observada em amostra, plausível mas não validada contra estatística real de futebol) | Documentado no código e aqui; revisar quando houver dados reais de partidas jogadas | Aceito por ora, é o esperado para um v1 |
| 13 | `/simular-amistoso` não persiste a partida em `Match`/`MatchEvent` — só emite eventos no event bus | Baixo — é uma decisão consciente (ver ADR 0001, adenda Fase 3), mas significa que nenhum resultado de partida hoje afeta carreira/ranking/stats permanentes | Persistência real chega na Fase 4/5 quando houver Season/Team reais para a partida pertencer | Aceito, documentado |

| 14 | `Injury` é gravado num passo separado da transação de `Match` (não atômico entre `MatchRepository` e `CareerRepository`) | Baixo — pior caso é uma lesão "perdida" (partida gravada, lesão não), não corrupção de dado | Decisão registrada em ADR 0001, adenda Fase 4; se virar problema real, considerar um `UnitOfWork` cross-repositório | Aceito conscientemente |
| 15 | `TeamPlayer.ensureOnRoster` não é à prova de corrida real (chave única inclui `joinedAt`, então não dá pra usar upsert limpo) | Baixo — pior caso é uma linha de elenco duplicada numa janela de corrida estreita (primeira entrada de um jogador num time) | Documentado no código do adapter Prisma; corrigir se aparecer de verdade em produção | Aceito, mesmo padrão de risco baixo já usado no Club/User upsert |
| 16 | Sem recuperação passiva de estamina entre partidas/dias — só no intervalo da partida e ao custo de treinar | Baixo — jogar sem folga deixa a estamina cair até a escalação bancar o jogador automaticamente (efeito colateral aceitável, não é bug) | Fica para quando existir um "calendário real" (Fase 5) com conceito de descanso ativo | Aceito por ora |

## Nota sobre `npm audit`

Ao instalar as dependências iniciais, `npm audit` reportou 5 vulnerabilidades
(3 moderate, 1 high, 1 critical) em dependências transitivas. Nenhuma delas
foi corrigida automaticamente com `--force` porque isso pode trazer
breaking changes sem uma decisão consciente. Isso precisa ser revisado
antes de qualquer deploy em produção — registrado aqui para não ser
esquecido, não porque foi resolvido.
