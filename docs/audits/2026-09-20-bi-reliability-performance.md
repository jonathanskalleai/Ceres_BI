# Auditoria de confiabilidade e performance do BI

**Data:** 20/09/2026
**Escopo:** 11 rotas `/bi/*`, hooks/RPCs usados por essas rotas, banco PostgreSQL de produção, comportamento visual e gates locais.
**Modo:** leitura e diagnóstico. Nenhum código, schema, índice ou serviço de produção foi alterado.

## Veredito executivo

O BI está operacional e as 11 telas renderizaram em produção, porém a base **não está pronta para receber um PASS de confiabilidade**. O risco principal não é indisponibilidade do servidor: CPU, memória, locks e cache do PostgreSQL estavam saudáveis. Os problemas são de contrato de dados, tratamento de erro e desenho das consultas.

O gate final desta auditoria é **FAIL / NEEDS WORK** pelos seguintes bloqueadores:

1. O monitor de ETL pode apresentar **“Saúde Geral: OK” quando a RPC falha e retorna lista vazia**.
2. A tela Ações exibe filtros globais de categoria e funil, mas os ignora silenciosamente. Isso foi reproduzido em produção.
3. Diversas telas convertem falhas de RPC em zeros/listas vazias plausíveis, sem alerta ao usuário.
4. O endpoint configurado para telemetria do frontend não existe no serviço de IA versionado; falhas podem ficar apenas no console.
5. `rpc_resultados_negocios_bi` permanece em aproximadamente **1,67 s de mediana dentro do banco**, antes da latência HTTP/renderização.
6. Há dois monólitos acima do hard gate estrutural: `BiDesempenhoVendas.tsx` (841 linhas) e `AcoesSection.tsx` (433 linhas).

## Metodologia

- Inspeção das rotas, páginas, hooks e contratos RPC.
- Smoke autenticado no frontend produtivo das 11 rotas.
- Medição do tempo de navegação até o conteúdo final substituir skeletons/spinners.
- Reprodução de filtro em produção, sem mutação de dados.
- Consultas somente leitura no PostgreSQL (`BEGIN READ ONLY`, timeout de 30 s).
- Amostras repetidas para os RPCs mais caros e consulta a `pg_stat_statements`.
- Reconciliação de KPIs agregados entre telas e RPCs de detalhe.
- Gates locais: TypeScript, testes, build e lint.

As medições de tela são amostras de uma sessão autenticada, com cache normal do navegador e rede do momento. Elas servem como baseline operacional, não como p95 estatístico.

## Tempos das telas em produção

| Tela | Tempo observado até conteúdo final | Resultado funcional |
|---|---:|---|
| Painel | 1.886 ms | Renderizou |
| Comercial | 3.320 ms | Renderizou; mais lenta da amostra |
| Pedidos | 1.961 ms | Renderizou |
| Produtos | 1.715 ms | Renderizou |
| Serviços | 1.305 ms | Renderizou |
| Operacional | 1.395 ms | Renderizou |
| Administrativo | 2.524 ms | Renderizou |
| Ações | 2.684 ms | Conteúdo principal renderizou; mapa chega em onda posterior |
| Inteligência | 2.322 ms | Renderizou |
| Monitor ETL | 2.844 ms | Renderizou, mas possui falso positivo em falha |
| Desempenho | 2.221 ms | Renderizou |

Na primeira passagem não houve erro de console. Em uma recarga fria posterior de Ações, a tela permaneceu apenas com o cabeçalho por mais de 15 segundos e registrou dois timeouts de perfil (`PROFILE_REQUEST_TIMEOUT_MS = 8.000`). A tela se recuperou depois, portanto o achado é de latência/transiência, não de indisponibilidade permanente. Não foi observado HTTP 429; a evidência coletada aponta timeout, não rate limit.

O mapa de Ações terminou carregado com **57 de 76 oportunidades**, consolidadas em **50 pinos**; 19 ficaram sem coordenada conforme o próprio contrato da tela. Em uma observação intermediária, os contadores ainda estavam em zero antes da onda secundária terminar. A UI precisa diferenciar “carregando” de “resultado zero”.

### Matriz por tela

| Tela | Tratamento de falha | Risco principal |
|---|---|---|
| Painel | Insuficiente | Aproximadamente 14 queries únicas; agregadores convertem ausência em zero/vazio |
| Comercial | Adequado nas seções principais | Maior tempo visual da amostra e dependência do RPC mais caro |
| Pedidos | Insuficiente | Erro da query não chega ao usuário; fallback numérico parece dado real |
| Produtos | Visível | Sem bloqueador funcional encontrado na amostra |
| Serviços | Insuficiente | Seções consomem dados/loading e não apresentam erro da RPC |
| Operacional | Visível | Sem bloqueador funcional encontrado na amostra |
| Administrativo | Insuficiente | Erro não é apresentado; pode renderizar vazio |
| Ações | Parcial | Filtros ignorados, maior fan-out, ondas tardias e alguns erros secundários ocultos |
| Inteligência | Insuficiente | Cinco fontes podem virar blocos vazios/zeros sem explicação |
| Monitor ETL | Crítico | Falha/lista vazia pode virar “Saúde Geral: OK” |
| Desempenho | Insuficiente | Hook retorna erro, página ignora; arquivo monolítico de 841 linhas |

## Tempos dos RPCs no PostgreSQL

Medições diretas no banco, sem rede HTTP:

| RPC | Amostras repetidas | Mediana aproximada | Classificação |
|---|---:|---:|---|
| `rpc_resultados_negocios_bi` | 1.671,8 / 1.526,2 / 1.667,7 ms | **1.668 ms** | Crítico |
| `rpc_desempenho_vendas_bi` (9 funis) | 971,1 / 640,3 / 806,1 ms | **806 ms** | Alto |
| `rpc_acoes_em_andamento` | 429,2 / 534,3 / 443,5 ms | **444 ms** | Alto |
| `rpc_acoes_funil_gestao_periodo` | 494,6 / 344,4 / 333,3 ms | **344 ms** | Atenção |
| `rpc_acoes_bi_periodo` | 311,3 / 257,6 / 465,4 ms | **311 ms** | Atenção |

Outras amostras representativas:

| RPC | Tempo direto observado |
|---|---:|
| `rpc_evolucao_ganhos_perdidos_12m` | 329,9 ms |
| `rpc_clientes_criticos_bi` | 239,7 ms |
| `rpc_acoes_termometro_fechamento` | 209,9 ms |
| `rpc_acoes_mapa_oportunidades` | 205,4 ms |
| `rpc_acoes_pedidos_ganhos` | 218,1 ms |
| `rpc_acoes_desperdicio_ano_corrente` | 166,2 ms |
| `rpc_acoes_negocios_perdidos` | 149,1 ms |
| `rpc_acoes_detalhe` | 137,3 ms |
| `rpc_admin_bi` | 127,2 ms |
| `rpc_negocios_bi_expandido` | 106,0 ms |
| `rpc_negocios_bi` | 85,2 ms |
| `rpc_etl_status` | 56,8 ms quente; histórico registrou 1.262,3 ms |
| `rpc_pedidos_bi` | 36,8 ms |
| `rpc_operacional_bi` | 25,8 ms |
| `rpc_produtos_bi` | 16,3 ms |
| `rpc_inteligencia_esforco_bi` | 9,1 ms |
| `rpc_parque_renovacao_bi` | 5,9 ms |
| `rpc_pedidos_pendentes_esteira` | 5,0 ms |
| `rpc_servicos_bi` | 3,5 ms |

### Evidência histórica recente do PostgREST

O `pg_stat_statements` havia sido zerado em 20/09/2026 14:42 UTC, então a janela é curta e inclui a própria auditoria. Ainda assim, confirma variabilidade relevante:

- `rpc_acoes_bi_periodo`: média 612,5 ms, máximo 1.693,4 ms, 18 chamadas.
- `rpc_acoes_funil_gestao_periodo`: média 742,2 ms, máximo 2.020,8 ms, 8 chamadas.
- `rpc_desempenho_vendas_bi`: média 995,8 ms, máximo 1.070,5 ms, 2 chamadas.
- `rpc_evolucao_ganhos_perdidos_12m`: média 658,1 ms, máximo 916,2 ms, 5 chamadas.
- `rpc_resultados_negocios_bi`: 1.516,7 ms em 1 chamada.
- `rpc_etl_status`: 1.262,3 ms em 1 chamada, contra 56,8 ms na amostra quente direta.

## Causa dos gargalos de banco

### `rpc_resultados_negocios_bi`

É o maior gargalo persistente. O wrapper chama o núcleo que:

- invoca `rpc_acoes_bi_periodo` e `rpc_acoes_funil_gestao_periodo`;
- volta a ler/agregar `crm_negocios` e `crm_acoes`;
- usa 16 CTEs materializadas;
- aplica muitos casts `timestamp::date` nos predicados;
- repete agregações para período atual e anterior.

Isso cria trabalho duplicado e reduz a capacidade do otimizador de usar índices normais de timestamp. O RPC permaneceu perto de 1,6 s mesmo com cache aquecido.

### Predicados não sargáveis

Há uso amplo de `::date` sobre colunas de timestamp. Exemplos de volume por função:

- `rpc_negocios_bi_expandido`: 26 casts;
- `rpc_resultados_negocios_bi_core`: 24 casts;
- `rpc_acoes_bi`: 15 casts;
- `rpc_evolucao_ganhos_perdidos_12m`: 13 casts;
- `rpc_acoes_funil_gestao_periodo`: 9 casts.

Preferir intervalos semiabertos sobre o timestamp original, por exemplo `coluna >= p_from AND coluna < p_to + interval '1 day'`, preservando a semântica de timezone já adotada. Índices de expressão são uma alternativa, mas aumentam custo de escrita e manutenção.

### Índices

Existem índices úteis para ações, negócio canônico e aprovação de pedidos. Os padrões de consulta auditados indicam lacunas prováveis em:

- `crm_negocios.ngo_datafechamento`;
- `crm_pedidos.pdo_dthpedido`;
- datas de `ordens_servico` — impacto atual pequeno pelo volume baixo.

Também há índices redundantes, que não devem ser removidos sem medição e autorização explícita:

- `idx_acoes_ngo_nro_negocio` e `idx_acoes_ngo_nronegocio`;
- `idx_acoes_tipo_contato` e `idx_acoes_tipocontato`;
- `idx_crm_negocios_numero_atualizacao` sobreposto pelo índice canônico coberto.

Os scripts ETL ativos inspecionados não executam `ANALYZE` explicitamente após cargas. As estatísticas existentes pareciam utilizáveis, então a ação correta é validar o autovacuum/analyze e, se necessário, incluir `ANALYZE` controlado ao fim das cargas — não assumir que as estatísticas estão ausentes.

## Confiabilidade dos dados

### Filtro global ignorado em Ações — alto

`BiAcoes` consome apenas `dateRange`; o próprio comentário informa que categoria/funil não se aplicam. Porém a topbar continua exibindo os dois controles.

Reprodução em produção:

1. Período: setembro/2026.
2. Estado inicial: categoria `Todos`, “Total de Ações” = 594.
3. Categoria alterada para `Repasse`.
4. O controle mostrou `Repasse`, mas “Total de Ações” permaneceu 594 e o restante da tela não mudou.

Isso viola a expectativa básica de um BI: o usuário vê um filtro aplicado que não influencia os números.

### Contratos diferentes entre telas — médio/alto

Para setembro/2026:

- Ações/Comercial: 5 ganhos, R$ 225.300; 9 perdidos, R$ 2.271.200.
- Desempenho com todos os 9 funis: 8 pedidos, R$ 435.300; 9 perdidos, R$ 2.271.200.
- Pedidos: 14 pedidos, R$ 841.700, por usar semântica mais ampla de status/data.

Os números reconciliam dentro de cada contrato, mas as telas não deixam clara a diferença. Ações exclui Repasse; Desempenho inclui Repasse por padrão; Pedidos possui outro universo. Sem um dicionário visível de métrica, isso parece divergência de dados.

### Falhas viram zeros ou vazio — crítico

Foram encontrados caminhos em que erro de query não é apresentado:

- Painel: múltiplos hooks agregadores substituem ausência por zero/lista vazia.
- Pedidos e Administrativo: estado de erro não é consumido na seção.
- Inteligência: cinco queries podem resultar em blocos vazios sem erro visível.
- Desempenho: o hook retorna `isError/error`, mas a página não os usa.
- Monitor ETL: o hook retorna erro, mas a página usa apenas `tables` e `isLoading`.

O caso mais grave está no Monitor ETL: `[].every(...)` retorna `true`, então erro/lista vazia produz `allHealthy = true` e exibe **Saúde Geral: OK** com zero tabelas.

### Observabilidade incompleta — alto

O frontend possui handlers globais e `reportClientError`, mas a release configura `/api/ai/telemetry` e não há rota `telemetry` no serviço FastAPI versionado. Além disso, React Query captura rejeições; telas que ignoram `error` não disparam necessariamente `window.error` ou `unhandledrejection`.

Resultado: uma RPC pode falhar, a UI mostrar zero e nenhuma telemetria útil chegar ao backend.

## Infraestrutura

- Cache hit do PostgreSQL: 99,62%.
- Sem queries longas ativas, locks não concedidos, deadlocks ou uso de temporários no momento da inspeção.
- Host com aproximadamente 7,8 GB de RAM, 4,8 GB disponíveis e swap sem uso.
- Carga em torno de 1,2 e container do banco com baixo uso de CPU.
- Disco em 82%, com cerca de 14 GB livres: monitorar e definir alerta, mas não foi a causa da lentidão observada.

Conclusão: o recurso físico está adequado para a carga atual. A prioridade é reduzir trabalho por consulta, fan-out e duplicação.

## Qualidade do código e build

| Gate | Resultado |
|---|---|
| TypeScript `tsc --noEmit` | PASS |
| Testes | PASS — 27 arquivos, 215 testes |
| Build Vite | PASS |
| Lint | FAIL — 126 erros, 25 avisos |
| Smoke produtivo | 11/11 rotas renderizaram |
| Reviewer estrutural | FAIL |
| QA de confiabilidade | FAIL / NEEDS WORK |

Achados adicionais:

- `BiDesempenhoVendas.tsx`: 841 linhas.
- `AcoesSection.tsx`: 433 linhas.
- Bundle principal: aproximadamente 776,6 kB minificado / 234,8 kB gzip.
- Chunk do tema/gráficos: aproximadamente 670,3 kB minificado / 227,5 kB gzip.
- O build alerta para chunks acima de 500 kB.
- O lint falha majoritariamente por dívida acumulada, inclusive `any` em funções antigas, mas há também warnings de dependência de hooks em componentes do BI.

## Plano de correção priorizado

### P0 — confiança antes da apresentação

1. Corrigir o falso verde do Monitor ETL: erro ou `tables.length === 0` deve resultar em estado vermelho/indisponível, nunca “OK”.
2. Padronizar um `BiErrorState` obrigatório para todas as telas/hook groups; não converter erro em zero.
3. Na tela Ações, ocultar categoria/funil ou implementar os filtros em todos os RPCs da página. A opção mais segura de curto prazo é ocultar controles que não se aplicam e explicar o contrato.
4. Criar/validar o endpoint real de telemetria e executar um evento de teste recebido ponta a ponta.
5. Adicionar smoke automatizado que force uma RPC a falhar e confirme que a UI mostra erro, não zero/OK.

### P1 — performance de consulta

1. Reescrever `rpc_resultados_negocios_bi_core` para uma única base filtrada, removendo chamadas aninhadas e CTEs materializadas redundantes.
2. Substituir `timestamp::date` por intervalos sargáveis.
3. Medir com `EXPLAIN (ANALYZE, BUFFERS)` antes/depois e criar índices somente com evidência.
4. Consolidar RPCs da mesma tela em um contrato agregado quando leem a mesma base/período.
5. Definir orçamento: RPC crítica p95 <= 800 ms e tela executiva p75 <= 2,5 s, sem estado vazio intermediário.

### P2 — consistência e manutenção

1. Publicar um dicionário de métricas com fonte, data de evento, exclusões e status incluídos.
2. Exibir o universo aplicado em cada tela (`Vendas sem Repasse`, `Todos os 9 funis`, etc.).
3. Dividir `BiDesempenhoVendas` e `AcoesSection` em containers/hooks/seções menores.
4. Sanear lint e adicionar o gate ao CI.
5. Separar chunks de gráficos/mapa e evitar carregar bibliotecas pesadas antes da seção ficar visível.
6. Monitorar espaço em disco e retenção de `sync_log`.

## Critérios para novo PASS

- Nenhuma tela mostra zero, vazio ou “OK” quando sua fonte falha.
- Todo filtro visível altera os RPCs/KPIs correspondentes ou é explicitamente desabilitado/oculto.
- Evento de erro do frontend recebido no backend/observabilidade em teste controlado.
- `rpc_resultados_negocios_bi` abaixo do orçamento acordado em amostras repetidas e p95 monitorado.
- Reconciliação automatizada entre agregados e detalhes para ganhos, perdas e pedidos.
- Lint, TypeScript, testes e build verdes.
- Smoke autenticado das 11 rotas, incluindo mapa com pinos e cenário de falha de RPC.
