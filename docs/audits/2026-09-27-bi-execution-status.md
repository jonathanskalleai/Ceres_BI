# Execução do plano Power BI-like — status real — 2026-09-27

## Resumo

O plano foi executado até o ponto que pode ser validado com segurança nesta
sessão. O caminho de consulta continua sendo `React → FastAPI → PostgreSQL`;
o navegador não recebe fatos para fazer join ou cálculo de negócio. A resposta
do backend usa envelope `ok`/`partial`/`error`, contratos tipados, paginação e
telemetria redigida.

Ainda não é correto declarar **100% aprovado** ou publicar a nova release: o
working tree não foi implantado, não houve benchmark HTTP autenticado e a
expansão dos read models para todas as 11 dashboards ainda não foi concluída.
Os critérios finais do plano exigem essas evidências, não apenas uma compilação
verde.

## Entregas verificadas

### Contratos, filtros e resiliência

- Filtros são normalizados em um contrato canônico (`biFilterContract`) e a
  chave de consulta ordena arrays/retira vazios, evitando caches divergentes.
- O filtro de data/vendedor/cidade só aparece em rotas que realmente o
  consomem; Serviços, Admin, Produtos e Operacional permanecem explícitos como
  posição atual quando o read model não é temporal.
- Ações não aplica `tipoAcao` a ganhos, perdas, mapa, risco ou termômetro,
  porque esses fatos não possuem esse atributo. A tela informa essa exceção ao
  usuário em vez de simular um filtro.
- O mapa de Ações começa fechado e só consulta/renderiza os pinos quando o
  usuário abre o bloco.
- Desempenho propaga vendedor, cidade, funil, produto, origem, banco e motivo
  para os drill-downs. Respostas ausentes, `NaN` e `Infinity` geram erro de
  contrato; não são convertidas em zero.
- Cards, gráficos, tabelas e modais preservam a última resposta válida ou
  mostram estado de erro/retry. O banner global informa que campos vazios não
  significam zero.

### Backend e observabilidade

- `BiMetrics` agora expõe `db_ms` e `rows_returned` além de `query_ms`,
  `api_ms`, payload e cache.
- Rotas RPC, semânticas, Painel, read models e lote de Ações emitem os mesmos
  campos no evento `bi_query`; o agregador offline e o benchmark HTTP também
  calculam p50/p95/p99 para banco e linhas sem registrar filtros, SQL, PII ou
  tokens.
- Falhas de um bloco do Painel/Ações produzem envelope parcial e não fabricam
  dados para o bloco que falhou.
- A próxima migration local (`20260928_bi_semantic_snapshots_all_dashboards.sql`)
  amplia o refresh Import para os contratos das demais dashboards e preserva o
  fallback DirectQuery por filtro. Ela ainda não foi aplicada na VPS.
- A migration local `20260929_desempenho_semantic_kpis.sql` mantém a RPC
  canônica como fonte de dados, mas acrescenta `taxaConversao` no wrapper SQL.
  Assim, a tela não recompõe quantidade/valor no React. Ela também ainda não
  foi aplicada na VPS e deve entrar na mesma janela de banco da publicação dos
  snapshots.
- A migration local `20260930_bi_server_derived_kpis.sql` preserva as RPCs
  canônicas de Ações como funções `*_core` restritas e publica wrappers com
  `ticketMedioGanho` e `taxaGanho` calculados no PostgreSQL. Os cards de Ações,
  Resultado Comercial e Pedidos Ganhos deixaram de dividir/agregar esses
  indicadores no navegador. Ela ainda não foi aplicada na VPS.
- O hook de compatibilidade de Serviços não baixa mais linhas de
  `mirror.ordens_servico`; ele delega ao mesmo `rpc_servicos_bi`/gateway da
  dashboard ativa.
- O script de publicação agora assume o gateway Python habilitado quando a
  flag não é declarada (`VITE_BI_API_ENABLED=true`), mantendo `false` apenas
  como configuração inválida para produção; o rollback seguro é a imagem web
  imutável anterior.
- Ações agora falha fechado em builds de produção quando o gateway está
  desabilitado; o fallback de RPC direta ficou restrito ao desenvolvimento e
  aos testes de rollback. Assim, uma configuração ausente não devolve o BI ao
  acesso direto do navegador.
- O endpoint de status dos read models possui também o alias versionado usado
  pelo gateway, mantendo o monitor de frescor funcional durante a migração.

### Banco de produção

A migration aditiva
`supabase/migrations/20260927_desempenho_drilldown_cross_filters.sql` foi
aplicada somente no PostgreSQL da VPS canônica `178.238.235.203` (SSH `2222`).
As duas funções de drill-down foram criadas com `SECURITY DEFINER`,
`search_path` fixo, ACL sem `anon` e `EXECUTE` somente para
`authenticated`, `service_role` e `ceres_bi_api`.

Smoke real após a migration:

- ambas as funções existem e retornam JSON válido;
- filtro de produto vazio retorna uma lista válida;
- paridade no período 2026-01-01…2026-09-30: ganhos `135 = 135` e perdas
  `165 = 165` (RPC antiga = RPC filtrada sem filtro cruzado);
- paridade pós-otimização no período 2026-01-01…2026-09-30: ganhos `135 = 135`
  e perdas `165 = 165`, comparando o JSON completo (linhas, ordenação e campos)
  das RPCs antigas e filtradas sem filtro cruzado.
- benchmark pontual anual em cinco chamadas: ganhos antigos ~0,59–0,72 s;
  ganhos filtrados com produto ~0,44–0,50 s; perdas filtradas com produto
  ~0,15–0,16 s. O `EXPLAIN (ANALYZE, BUFFERS)` do ganho filtrado ficou em
  ~480 ms / 5.250 buffers. A melhoria veio de reduzir a coorte por período,
  status e funil antes de executar `STRING_AGG` de produtos e a função de
  cidade. Ainda é uma medição de banco, não um benchmark HTTP autenticado.
- smoke de combinações reais (produto, origem, banco, condição e motivo)
  retornou JSON válido e totais coerentes (`47`, `47`, `4`, `135` para ganhos;
  `0`, `71`, `62`, `165` para perdas), sem exceção ou fallback numérico.

As RPCs principais, medidas diretamente no PostgreSQL em cinco execuções
anuais, ficaram aproximadamente em `Desempenho 1,01–1,16 s`, `Ações core
0,69–0,80 s` e `mapa 0,30–0,37 s`. Isso atende a meta de banco isolado, mas não
substitui a medição ponta a ponta com usuário autenticado.

Nenhum serviço da aplicação foi reiniciado nem recebeu o working tree desta
sessão; os serviços `ceresbi_bi`, `ceresbi_web` e `ceresbi_bi_refresh` continuam
na imagem publicada `8105af8c61b9`. A migration é aditiva e foi recarregada
pelo PostgREST via `NOTIFY`.

## Evidências locais

| Gate | Resultado |
| --- | --- |
| Python (`bi-service/tests`) | 38 testes aprovados |
| Ferramentas de baseline/benchmark (`ops`) | 19 testes aprovados |
| Vitest | 51 arquivos / 292 testes aprovados |
| TypeScript (`tsc --noEmit`) | aprovado |
| ESLint dos arquivos alterados | aprovado |
| Vite build | aprovado; apenas avisos de chunks grandes |
| `git diff --check` | aprovado |
| ESLint global | não aprovado: 126 problemas preexistentes fora do escopo |
| Ruff global | não aprovado: 11 imports preexistentes fora do escopo |

## Pendências que bloqueiam o aceite final

1. Publicar a aplicação por canário e validar `/health`, SHA, smoke autenticado
   e rollback; o bundle atual ainda não está em produção.
2. Executar benchmark HTTP autenticado frio/quente/concorrente (2 e 10 usuários)
   com pelo menos 20 amostras por cenário para obter p50/p95/p99 reais.
3. Aplicar a migration local de snapshots semânticos ampliados e publicar os
   contratos em canário. Hoje há quatro read models físicos; os demais passam a
   ter uma camada Import de payload por essa migration, mas ainda precisam de
   validação de paridade e carga antes de substituir o DirectQuery filtrado.
4. Completar a matriz de paridade das 11 dashboards, incluindo modais, filtros
   combinados, payload e rollback por dashboard.
5. Rodar os gates FULL (reviewer, security e QA) ancorados ao SHA da release;
   os JSONs existentes são de uma release anterior e não validam este diff.

Até esses itens serem executados e aprovados, o estado correto é
**implementação local + correção de banco validada, release pendente**. Não
seria honesto informar ao cliente que a migração completa já terminou.
