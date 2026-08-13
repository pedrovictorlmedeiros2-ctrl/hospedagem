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

## Nota sobre `npm audit`

Ao instalar as dependências iniciais, `npm audit` reportou 5 vulnerabilidades
(3 moderate, 1 high, 1 critical) em dependências transitivas. Nenhuma delas
foi corrigida automaticamente com `--force` porque isso pode trazer
breaking changes sem uma decisão consciente. Isso precisa ser revisado
antes de qualquer deploy em produção — registrado aqui para não ser
esquecido, não porque foi resolvido.
