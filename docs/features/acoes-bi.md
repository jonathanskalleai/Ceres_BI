---
feature: acoes-bi
updated_at: 2026-08-03T00:30:00Z
updated_by: "@dev (contrato v9/v6: oportunidades, ganhos e perdidos separados)"
status: active
---

# BI Acoes — Tela de Gestao Comercial (v9 / funil v6)

**Proposito:** Pagina `/bi/acoes` com indicadores de gestao comercial em cinco blocos: atividade e desfechos do periodo (visitas → oportunidades abertas, mais ganhos e perdas como desfechos paralelos + ranking de consultores), gestao de carteira, esforço e retorno, mapa de oportunidades e listas de gestão.

## Os TRES contratos (leia antes de qualquer SQL ou ajuste de numero)

A tela mistura **tres fontes diferentes**, cada uma com a sua data de competencia
e a sua unidade. Elas NAO sao fatias do mesmo universo e **nao se somam**. Esta
tabela e o contrato; qualquer numero que a contradiga esta errado.

| Indicador | Fonte | Data de competencia | Unidade / valor |
|---|---|---|---|
| **Oportunidades** (liquidas) | `mirror.crm_acoes` ligada a negocio canonico | `aco_dthconclusao` | negocio distinto ainda `Em Andamento` / `SUM(ngo_vlrtotalnegociado)` |
| **Ganhos** | `mirror.crm_pedidos` ligado a negocio canonico | `pdo_dthaprovacao` | **pedido** / `SUM(pdo_vlrpedido)` |
| **Perdidos** | `mirror.crm_negocios` canonizado | `ngo_datafechamento` | **negocio** / `SUM(ngo_vlrtotalnegociado)` |

- Os tres excluem `ngo_funil = 'REPASSE DE MAQUINA'`. **Visitas NAO excluem** —
  as 546 de julho/2026 valem todas.
- Ganho e Perdido sao **desfechos PARALELOS**, nao degraus consecutivos. NAO
  existe taxa `ganhos / (ganhos + perdidos)`: as reguas de valor sao diferentes
  (R$ de pedido faturavel vs R$ negociado potencial) e as janelas tambem.
- `ngo_datacadastro` e `ngo_dataatualizacao` **nunca** definem a janela de um
  indicador. `ngo_dataatualizacao` serve so como ordenacao tecnica para escolher
  a versao canonica do negocio, ANTES de qualquer filtro de status.
- Um unico seletor de periodo e aplicado as tres datas. A UI declara isso com o
  texto fixo: "Período dos eventos: ações por conclusão, ganhos por aprovação de
  pedido e perdas por fechamento de negócio."

### Chave canonica de `crm_negocios` (fechada com evidencia)

```sql
DISTINCT ON (ngo_numero) ... ORDER BY ngo_numero,
  ngo_dataatualizacao DESC NULLS LAST, dthregistro DESC NULLS LAST
```

Verificado no banco vivo em 2026-08-02T23:00Z: 242 `ngo_numero` empatam nessa
chave, mas todos sao **linhas de produto do mesmo negocio** (divergencia em
conclusao/fechamento/valor/funil/vendedor: **0**) — qualquer linha devolve a
mesma resposta. Os 4 negocios com `ngo_conclusao` divergente sao resolvidos por
`ngo_dataatualizacao DESC`. Canonizar **nao** subconta negocio multi-produto:
`ngo_vlrtotalnegociado` e o total do negocio repetido nas linhas de produto.
**Nunca usar `ctid` como regra de negocio.**

## Entry Points
- `src/pages/bi/BiAcoes.tsx` — pagina principal (rota /bi/acoes)
- `src/components/bi/sections/AcoesSection.tsx` — secao de KPIs + ranking + graficos + tabelas (v7)
- `src/components/bi/sections/AcoesKpiGrid.tsx` — grid de KPIs. **v9: 2 cards de valor** (Ganho e Perdido); o card "Valor em Aberto" FOI REMOVIDO do grid junto com o bucket "aberto" da RPC. `GANHO_SOURCE` e `PERDIDO_SOURCE` sao constantes SEPARADAS de proposito — nao existe mais base compartilhada entre cards de regua diferente
- `src/components/bi/sections/AcoesDesfechosPeriodo.tsx` — **NOVO v9**: os dois desfechos lado a lado (Ganhos/pedidos e Perdidos/negocios), cada um imprimindo a propria fonte e data de competencia + aviso de `perdidosSemAtribuicao`. Extraido de `AcoesFunilConversao` para manter os dois abaixo do gate de 300 linhas (114 linhas)
- `src/components/bi/sections/AcoesDetailWithFilter.tsx` — wrapper da tabela detalhe com chips de filtro por status + paginação numerada server-side (v8)
- `src/components/bi/sections/AcoesFunilConversao.tsx` — bloco 1, **renomeado na UI para "Atividade e desfechos do periodo"** (v9). Deixou de ser funil: visitas → oportunidades abertas como atividade, e Ganhos/Perdidos como desfechos paralelos. Motivo medido: em julho/2026, dos 193 negocios tocados so 111 receberam visita (96 vieram de telefonema/whatsapp, 30 de "outro") — o topo nao contem a base, entao nunca foi funil
- `src/components/bi/AcoesRankingConsultores.tsx` — ranking com 4 critérios (visitas, oportunidades, ganhos, valor) e toggle client-side (NOVO)
- `src/components/bi/AcoesEsforcoRetorno.tsx` — bloco 2: tabela-ranking esforço vs retorno com InlineBar, toggle consultor/cliente, 8 linhas + "ver mais" (v7.2, reescrito)
- `src/components/bi/AcoesGestaoCarteira.tsx` — bloco 3: clientes em risco com 5 faixas dias sem contato, colapsável (NOVO)
- `src/components/bi/sections/AcoesGestaoCarteiraSummary.tsx` — mini-cards top 3 "sem contato" antes da gestão; usa useAcoesGestaoListasRpc limit:3, retorna null se vazio (NOVO v7.3, 76 linhas)
- `src/components/bi/AcoesGestaoCarteiraTables.tsx` — tabelas paginadas das 3 listas: sem-contato, desperdicio, negativas (NOVO)
- `src/components/bi/AcoesMapaOportunidades.tsx` — bloco 4: mapa colapsável com toggle "Todas abertas" | "Tocadas no mês" + cluster de pinos (v7.2, modificado)
- `src/components/bi/dashboard/mapa/OportunidadeMarkers.tsx` — pinos: cor por dias parado, popup com info (NOVO)
- `src/components/bi/ChipToggle.tsx` — chip com estado ativo/inativo, reutilizavel (NOVO)
- `src/components/bi/BiGestaoErro.tsx` — card de erro com debug gateado por isBiDebugEnabled() (NOVO)

## Dependencias Internas
- `src/hooks/bi/useAcoesBIRpc.ts` — hook de fetch para RPC acoes
- `src/hooks/bi/useAcoesDetalheRpc.ts` — hook de fetch para tabela detalhe (aceita statusNegocio)
- `src/hooks/bi/useClientesRiscoRpc.ts` — hook de fetch para RPC clientes em risco (v6)
- `src/hooks/bi/useAcoesFunilRpc.ts` — hook de fetch para rpc_acoes_funil_gestao (NOVO)
- `src/hooks/bi/useAcoesGestaoListasRpc.ts` — hook de fetch para rpc_acoes_gestao_listas (NOVO)
- `src/hooks/bi/useAcoesMapaRpc.ts` — hook de fetch para rpc_acoes_mapa_oportunidades (NOVO)
- `src/services/biRpcService.ts` — fetchAcoesBI + fetchAcoesDetalhe + fetchClientesRisco + fetchAcoesFunilGestao + fetchAcoesGestaoListas + fetchAcoesMapaOportunidades (v7)
- `src/types/bi/` — tipos expandidos: AcoesFunilRow, AcoesGestaoListaRow, AcoesMapaOportunidadeRow + existentes (barrel em `src/types/biRpc.ts`)
- `src/components/bi/AcoesRankingTable.tsx` — heatmap matrix consultor x cidade (v6)
- `src/components/bi/AcoesClientesTable.tsx` — top 15 clientes mais atendidos no ANO ATUAL (v6)
- `src/components/bi/AcoesDetailTable.tsx` — tabela COMPLETA paginada com paginação numerada server-side (v8)
- `src/components/bi/PaginationControls.tsx` — componente reutilizável de paginação numerada (124 linhas), design VOUX (champagne active, JetBrains Mono números, pill buttons), a11y (role=navigation, aria-current, aria-label) (NOVO v8)
- `src/components/bi/BiTableCard.tsx` — card DRY para tabelas (skeleton/error/empty states, 119 linhas)
- `src/components/bi/BiGestaoErro.tsx` — error state com debug gateado (NOVO)
- `src/components/bi/BiTopbarPortal.tsx` — dropdown "Tipo de Acao" na topbar
- `src/components/bi/charts/ScatterChart.tsx` — DELETADO v7.2 (scatter removido, substituído por tabela-ranking)
- `src/components/bi/charts/primitives/SvgScatter.tsx` — DELETADO v7.2 (primitiva SVG do scatter removido)
- `src/components/bi/charts/InlineBar.tsx` — barra horizontal inline para rankings (NOVO v7.2, 34 linhas)
- `src/components/bi/charts/BarChart.tsx` — propaga `itemColors` para SvgBarV como `barColors` (v7.3, cor por barra)
- `src/components/bi/charts/primitives/SvgBarV.tsx` — aceita `barColors?: string[]` (cor por índice, fallback para `color` se ausente) (v7.3)
- `src/components/dashboard/mapa/ClusterMarker.tsx` — agrupa pinos por coordenada (4 decimais), badge numérico, popup com lista (NOVO v7.2, 93 linhas)
- `src/bi/debug/isBiDebugEnabled.ts` — gate de debug por flag isBiDebugEnabled (NOVO)
- `src/services/bi/acoesGestaoService.ts` — logica de transformacao dos dados de gestao (NOVO)
- `src/lib/bi/acoesGestaoUtils.ts` — utilitarios: diasParado, mapeadores de criteria (NOVO)
- `NegociosFilterContext` — contexto de filtros compartilhado (vendedor, periodo, tipoAcao, statusNegocio)

## Database
- **Fonte de verdade em producao:** `rpc_acoes_bi` (v9) e `rpc_acoes_funil_gestao` (v6); antes de validar ou alterar números, leia a função instalada e as migrations mais recentes (`20260802_rpc_acoes_bi_v9_perdidos_negocios.sql` e `20260802_rpc_acoes_funil_gestao_v6_perdidos_negocios.sql`). O banco e Supabase self-hosted na VPS; o MCP/`supabase/config.toml` não acessam esse alvo.
- **Contrato de ganhos:** CTE `pedidos_dedup` usa `DISTINCT ON (pdo_codigointerno) ORDER BY pdo_dthaprovacao DESC NULLS LAST`. A CTE `pedidos_periodo` então exige os quatro criterios juntos: `pdo_situacaopedido = 'Aprovado'`, `pdo_dthaprovacao::date` dentro da janela, negocio **canonico** com `ngo_conclusao = 'Ganho'` e `ngo_funil != 'REPASSE DE MAQUINA'`.
- **Fan-out de ganho CORRIGIDO na v9:** o join passou a usar `negocios_canonicos` em vez do `mirror.crm_negocios` cru. Medido em 2026: `125 linhas / R$ 16.689.847,18` → `121 pedidos / R$ 15.130.847,18` (**−4 pedidos, −R$ 1.559.000,00**). **Julho/2026 nao se move** (26 ganhos / R$ 2.753.425,30) e a validacao da planilha do cliente (R$ 1.660.540 / 13 pedidos ate 23/07) nao e afetada. O acumulado do ano CAI — e correcao, nao regressao.
- **`rpc_acoes_bi` v9 — o bucket "aberto" saiu inteiro.** REMOVIDOS do JSON: `valorAberto`, `negociosAberto`, `valorTocado`, `negociosTocados`. `valorPerdido`/`negociosPerdido` mudaram de SEMANTICA sem mudar de nome (eram 0 fixo; agora vem de NEGOCIO por `ngo_datafechamento`). `negociosOutrosStatus` era 0 fixo e agora e REALIMENTADO: conta negocio canonico fechado na janela com status fora dos 3 conhecidos (hoje 0 — e zero legitimo, sinal de saude, nao campo morto).
- **`rpc_acoes_funil_gestao` v6 — oportunidade agora e LIQUIDA.** `funil.oportunidades` conta negocio canonico tocado por acao na janela, sem Repasse, **e ainda `ngo_conclusao = 'Em Andamento'`**. Campos NOVOS: `funil.valorOportunidades`, `funil.perdidos`, `funil.valorPerdido`, `meta.perdidosSemAtribuicao`. Nada foi removido. `funil.visitas` esta INALTERADA.
- **Oportunidade e metrica de ESTADO, nao de evento.** Um mes ja fechado MUDA retroativamente quando um negocio dele for concluido depois. Isso e a definicao funcionando, nao falha de carga — a UI declara isso no card e no rodape do bloco.
- **Deltas medidos (fotografia 2026-08-02T23:00Z / 2026-08-03T00:05Z — dado vivo, nao fixture):**
  - Oportunidades julho/2026: `193` → `167` (exclusao de Repasse) → **`112`** (desconto liquido). Valor: R$ 13.264.057,00.
  - Oportunidades 2026: `833` → `724` → **`536`**. `valorOportunidades` 2026 = **R$ 57.864.317,51**.
  - Perdidos deixam de ser 0 fixo: julho/2026 = **7 negocios / R$ 1.060.000,00** (VENDAS 5 / R$ 450.000 + ADM 2 / R$ 610.000).
- **Filtros (v6):** `p_vendedor`/`p_cidade` agora filtram **tambem** ganhos e perdidos, pelo DONO do negocio (`ngo_vendedores → usuarios`) e por `fn_cli_cidade`; antes o desfecho era global e ignorava o filtro. Oportunidades/visitas seguem `aco_vendedor` (atribuicao HIBRIDA por design). **`p_tipo_acao` afeta SOMENTE visitas/oportunidades** — pedido e negocio nao tem tipo de acao, e a UI declara isso.
- `diasParados` permanece uma métrica de ações em negócios Em Andamento, com semântica separada; a CTE `parados` foi mantida **byte a byte** igual a v5 de proposito (ver pendencias).
- Tabelas-chave: `mirror.crm_acoes`, `mirror.crm_pedidos`, `mirror.crm_negocios`, `mirror.usuarios` e `mirror.crm_carteira_clientes`.
- Validação observada no banco vivo em 2026-08-02 para julho/2026: `rpc_acoes_bi` retornou 26 ganhos e R$ 2.753.425,30; o funil retornou 546 visitas, 193 oportunidades e 26 ganhos. É fotografia de dados dinâmicos, não valor fixo de teste.
- RPC: `rpc_acoes_detalhe` v5 — tabela completa server-side, paginacao numerada PAGE_SIZE=50 LIMIT/OFFSET; dedup condicional: quando p_status IS NOT NULL (Ganho/Perdido), aplica ROW_NUMBER PARTITION BY ngo_nronegocio (apenas ação mais recente de cada negócio único), total conta negócios únicos; quando p_status IS NULL comportamento inalterado (v8)
- RPC: `rpc_acoes_clientes_risco` — 5 faixas de dias sem contato (v6)
- RPC: `rpc_acoes_gestao_listas` (NOVO v7) — listas paginadas por p_tipo (sem_contato | desperdicio | negativas). Params: p_tipo, p_from, p_to, p_vendedor, p_cidade, p_limit, p_offset, p_search, p_dias_min, p_dias_max. Lança EXCEPTION se p_tipo inválido
- RPC: `rpc_acoes_mapa_oportunidades` v2 (NOVO v7.2) — pinos geoloc, toggle estoque/período. Params: p_vendedor, p_cidade, p_from (opcional), p_to (opcional). Quando p_from/p_to NULL = estoque aberto completo; quando preenchidos = tocadas no período. Coordenada por cascata (última ação do cliente → fallback carteira). Retorna lat/lng, diasParado, ngoNumero, valor
- Funcao: `mirror.fn_cli_cidade(p_cli_id)` — resolve cidade do cliente (DRY, v6)
- Tabelas: `mirror.crm_acoes`, `mirror.crm_negocios`, `mirror.crm_carteira_clientes`
- Índices (proposta rejeitada): `mirror.idx_acoes_diasParado` e `mirror.idx_negocios_vendedores` — benchmark mostrou 0 ganho queries atuais, custo +escrita; documentado em `20260725_idx_acoes_gestao.sql`
- **Migrations vigentes do contrato de tres fontes (criadas, NAO aplicadas):** `supabase/migrations/20260802_rpc_acoes_bi_v9_perdidos_negocios.sql` e `supabase/migrations/20260802_rpc_acoes_funil_gestao_v6_perdidos_negocios.sql`.
- Migrations da regra anterior de ganhos: `supabase/migrations/20260731_rpc_acoes_bi_v8_pedidos_repassse.sql` e `supabase/migrations/20260731_rpc_acoes_funil_gestao_v5_pedidos_repassse.sql`. Refletem a função hoje INSTALADA, mas seguem **não rastreadas no Git** — ver pendências (bloqueia deploy da v9/v6).
- Migration histórica: `supabase/migrations/20260725_rpc_acoes_funil_gestao.sql` (primeira versão do funil)
- Migration: `supabase/migrations/20260725_rpc_acoes_gestao_listas.sql` (NOVO)
- Migration: `supabase/migrations/20260725_rpc_acoes_mapa_oportunidades.sql` (NOVO)
- Migration: `supabase/migrations/20260727_rpc_acoes_mapa_oportunidades_v2.sql` (NOVO v7.2 — adiciona p_from/p_to opcionais)
- Migration: `supabase/migrations/20260725_idx_acoes_gestao.sql` — no-op: comentário documentando rejeição de índices

## Padroes (v7)
- Server-side aggregation via RPC (nao agrega no browser)
- Atribuição HÍBRIDA: visitas/oportunidades por aco_vendedor; ganhos/valor por ngo_vendedores → usr_codusuario → usr_nomeusuario. Motivo: 17% ganhos tocados >1 consultor (10,4% ano corrente) — unificar as duas pontas quebra soma com card
- fn_cli_cidade centraliza resolucao de cidade (DRY, v6)
- Dedup negocios via CTE (elimina fan-out ngo_numero duplicado, v6)
- Paginacao server-side em AcoesDetailTable (numerada, PAGE_SIZE=50, PaginationControls.tsx) e AcoesGestaoListasTable (v8 + NOVO)
- Filtros via NegociosFilterContext (vendedor, periodo, tipoAcao) — estendido com critérios de gestao (v7)
- Ranking consultores: 4 critérios (visitas, oportunidades, ganhos, valor) com toggle client-side — NÃO refetch (v7)
- Tabela-ranking esforço × retorno: InlineBar + BiTableCard, toggle consultor/cliente, 8 linhas visíveis + "ver mais", ordenação por visitas desc (v7.2, substituiu scatter)
- Mapa de oportunidades v2: toggle "Todas abertas" (estoque) | "Tocadas no mês" (período via p_from/p_to); ClusterMarker agrupa pinos por coordenada arredondada a 4 decimais, badge numérico, popup com lista de negócios (v7.2)
- Pinos cor por dias parado: < 90 dias = champagne (`#d4b896`), >= 90 = vermelho (`#b83a28`); 38% sem geolocalizacao = cor champagne também (v7)
- Listas gestao: sem-contato, desperdicio e negativas — search/filter server-side; "desperdicio" encolhe bastante ao aplicar a janela de data (v7)
- Heatmap matrix: linhas=consultores, colunas=cidades (fn_cli_cidade do CLIENTE, v6)
- Card "Clientes em Risco": 5 faixas dias sem contato + barras com cores sequenciais champagne→terracota via SvgBarV `barColors` (v7.3, era cor única)
- KPIs com prop `formula` (conceito de negócio em linguagem clara, exibido no tooltip hover) além do `dataSource` técnico (v8.1). **v9: cada card de valor carrega a PRÓPRIA fonte** — não há mais constante `VALOR_BASE` compartilhada, porque Ganho e Perdido não compartilham régua
- StatusDesconhecidoAlert: alerta visual quando `negociosOutrosStatus > 0` — **v9: sem soma de cards** (ver armadilha 23)
- Toggle mapa com counts dinâmicos: ChipToggle exibe count derivado de `data?.total` e `data?.comCoordenada` via useMemo (v7.3)
- Badge de contexto no funil: texto explicativo fixo com `role="note"` em AcoesFunilConversao (v7.3, a11y)
- Mini-cards top 3 "sem contato": AcoesGestaoCarteiraSummary renderiza antes da gestão; usa useAcoesGestaoListasRpc com limit:3, retorna null se dados vazios (v7.3)
- PieCharts substituídos por HorizontalBarChart ordenado DESC em AcoesSection: PieChartWithLabels NÃO é dead code (usado em 5 outras sections) — apenas removido desta tela (v7.3)

## Como Alterar com Seguranca
### Contrato de ganhos (obrigatorio antes de qualquer SQL manual)
1. Leia a RPC/migration vigente; uma query ad hoc não é referência de negócio.
2. Conte **pedido**, nunca linha crua: aplique `DISTINCT ON (pdo_codigointerno)` antes de agregar. Um `JOIN` ou carga incremental pode multiplicar linhas.
3. Aplique todos os quatro critérios juntos: pedido `Aprovado`, data de aprovação na janela, negócio `Ganho` e exclusão de `REPASSE DE MAQUINA`. Não troque o último por `IN (...)` e não omita `ngo_conclusao='Ganho'`.
4. Para validar o que a tela mostra, chame primeiro a RPC no banco vivo. Só compare uma query manual se ela reproduzir exatamente as CTEs da função e os seus parâmetros.
5. Não misture a contagem de `rpc_pedidos_bi` com `/bi/acoes`: são produtos diferentes e podem ter filtros distintos.

### v6 (vigente)
1. fn_cli_cidade e usada por AMBAS as RPCs + rpc_acoes_clientes_risco — alterar a funcao impacta heatmap + detalhe + risco
2. A deduplicação depende do produto: ganhos usa `pedidos_dedup` por `pdo_codigointerno`; `rpc_acoes_detalhe` usa `ROW_NUMBER PARTITION BY ngo_nronegocio` somente quando p_status não é NULL. Remover qualquer uma das duas altera as contagens.
3. Os cards de valor (2 desde a v9: Ganho e Perdido) excluem `REPASSE DE MAQUINA` na RPC — mudar o recorte de funil exige alterar a RPC, não a UI
4. BiTopbarPortal depende do portal DOM node no layout
5. Alterar tipos exige editar modulos em src/types/bi/ (barrel em biRpc.ts)
6. `src/lib/acoesChartUtils.ts` e dead code (orphaned desde v5.1) — cleanup futuro, nao importar
7. rpc_acoes_detalhe v4 (7 params) deve ser dropada no deploy — v5 com DEFAULT NULL cobre backward compat. Dead code: ACOES_DETALHE_LIMIT (export nunca usado) removido em v8
8. rpc_acoes_clientes_risco usa aco_vendedor = usr_nomeusuario (match direto) — alterar nomes no ETL quebra o chart

### v7 (novas armadilhas)
9. **Atribuição HÍBRIDA por design:** visitas/oportunidades por `aco_vendedor`; ganhos/valor por `ngo_vendedores → usuarios.usr_codusuario → usr_nomeusuario`. Motivo: 17% dos ganhos comerciais na base (10,4% ano corrente) são tocados por >1 consultor — atribuir por ação inflava o ranking. Unificar as duas pontas quebra a soma com o card
10. **Canvas não resolve `var()`:** `CircleMarker` com `preferCanvas` desenha via `ctx.fillStyle`, que descarta CSS custom properties em silêncio e cai em `#000000`. Cor tem que ser resolvida para hex no render (`getComputedStyle().getPropertyValue().trim()`) com fallback. Já causou pinos 100% pretos com legenda mentindo
10.1. **ClusterMarker agrupa por 4 decimais:** coordenadas arredondadas a 4 casas definem grupo — alterar precisão muda a quantidade de clusters visíveis; popup lista até N negócios (v7.2)
10.2. **Toggle mapa "Tocadas no mês" depende de p_from/p_to na RPC v2:** se o hook `useAcoesMapaRpc` receber from/to, filtra por período; NULL = estoque completo. Remover os params da RPC quebra o toggle (v7.2)
11. **CORRIGIDA em 2026-08-02 — a versão anterior desta armadilha era FALSA e teria bloqueado a v9.** O texto antigo dizia que `ngo_datafechamento` é "inutilizável" e que filtrar por ela "zera o funil". Medição no banco vivo desmente: o campo está **100% preenchido** nos dois desfechos — **828/828** em `Ganho` e **808/808** em `Perdido`, com distribuição mensal plausível (jan 32, fev 22, mar 11, abr 28, mai 13, jun 13, jul 7 nos perdidos). É a data de competência OFICIAL do card Perdido desde a v9.
    O que era verdade é bem mais estreito: **no recorte funil `VENDAS` + `ngo_conclusao='Ganho'` não há fechamentos em 2026**. Isso é um caso pontual daquele recorte, não uma propriedade da coluna. Generalizar um recorte vazio para "a coluna não presta" foi o erro — e é o tipo de armadilha que congela uma correção correta por mais de uma versão.
    **Risco residual honesto (não eliminado):** se o CRM permitir reabrir/refechar um negócio, o mês da perda migra retroativamente e a série histórica de Perdidos fica instável. Hoje o campo é utilizável; se um mês já fechado mudar de valor sem carga nova, a suspeita é essa.
12. **`error.message` nunca vai ao DOM sem `isBiDebugEnabled()`:** security standard #6. Bloco gateado está duplicado em `BiGestaoErro` e `BiTableCard` — se surgir 3º consumidor, extrair componente único (foi a duplicação que produziu "um lugar gateado, o outro não")
13. **`p_from/p_to = NULL` na lista `desperdicio` desliga o filtro de janela:** sem janela a lista retorna várias vezes mais linhas que com a janela do ano. Não é bug. Mesma semântica no mapa v2: NULL = estoque completo

### v7.3 (melhorias UX — novas armadilhas)
14. **`SvgBarV.barColors` é por índice:** array posicional — se a ordem das barras mudar (sort diferente), as cores seguem o índice, não o dado. BarChart propaga via `itemColors`. Fallback para `color` (cor única) se `barColors` ausente
15. **ChipToggle count depende de `data?.total` / `data?.comCoordenada`:** valores vêm do hook `useAcoesMapaRpc`. Se a RPC mudar o shape do retorno (ex: renomear campo), count mostra `undefined` em silêncio
16. **AcoesGestaoCarteiraSummary retorna `null` se vazio:** componente invisível quando não há dados — não é bug, é design. Mas se o hook falhar (erro de rede), também retorna null → indistinguível de "sem dados"
17. **PieChartWithLabels NÃO é dead code:** removido de AcoesSection (v7.3) mas ainda usado em 5 outras sections. Não deletar o componente

### v8 (dedup + paginação numerada — novas armadilhas)
18. **Dedup condicional em rpc_acoes_detalhe v5:** ROW_NUMBER PARTITION BY ngo_nronegocio aplica-se APENAS quando p_status IS NOT NULL. Quando p_status IS NULL (sem filtro), todas as ações retornam sem dedup — alterar essa lógica quebra a contagem total vs filtrada
19. **Total conta negócios únicos no modo filtrado:** quando dedup ativo, o total retornado é COUNT(DISTINCT ngo_nronegocio), não COUNT(*) das linhas — PaginationControls usa esse total para calcular páginas. Trocar por count de linhas quebra a paginação
20. **Paginação numerada reseta página 1 ao trocar filtros:** PaginationControls.tsx depende do hook resetar `page=1` ao mudar statusNegocio/vendedor/período. Se o hook não resetar, usuário vê página N de um filtro anterior (vazia ou dados errados)
21. **ACOES_DETALHE_LIMIT removido:** era export dead code. Se algum consumidor externo importava (não deve), vai quebrar no build — build limpo confirma

### v9 / funil v6 (contrato de tres fontes — novas armadilhas)
22. **Nao somar Ganho com Perdido, em lugar nenhum.** Ganho e R$ de PEDIDO faturavel; Perdido e R$ NEGOCIADO potencial. A soma nao tem significado. Foi exatamente essa soma (`valorAberto + valorGanho + valorPerdido` vs `valorTocado`) que quebrou o `StatusDesconhecidoAlert` e obrigou a reescrita dele
23. **`StatusDesconhecidoAlert` foi REPONTADO, nao removido** (decisao explicita do usuario). Ele nao compara mais soma de cards: dispara so com `negociosOutrosStatus > 0` e avisa que existe um 4o status de negocio que a tela nao representa. Motivo de manter: o card Perdido passou a depender INTEIRAMENTE de `ngo_conclusao`, entao um status novo do ERP o encolheria em silencio. Deletar o detector porque a conta dele ficou errada seria trocar alarme falso por cegueira
24. **`funil` NAO tem `valorGanho`.** A RPC do funil devolve a CONTAGEM de pedidos aprovados, nao a soma. O componente de desfechos aponta para o card "Valor Ganho" (que le `rpc_acoes_bi`) em vez de renderizar R$ 0. Se alguem "consertar" isso passando 0, volta a mentir
25. **`oportPorFechamento` e `visitasPorOportunidade` continuam no JSON e podem ser exibidos, mas NUNCA rotulados como taxa de conversao.** Na UI o primeiro aparece como "Indice de janela". Ganho e perda sao paralelos: nao existe conversao entre eles
26. **`perdidosSemAtribuicao` e obrigatorio na UI, nao opcional.** O total global INCLUI o perdido sem dono; sob filtro de consultor ele sai, e a soma por consultor fica menor que o total. Sem expor a excecao, parece bug. Medido: 1 de 117 perdidos em 2026 (ganhos: 0 de 121) — **em janelas de 2025 o furo pode ser maior, medir antes de confiar no ranking historico**
27. **Oportunidade e ESTADO:** mes fechado muda retroativamente quando um negocio dele for concluido depois. Nao abrir chamado de "carga errada" sem antes checar se foi isso

## Smoke
### v9 / funil v6 (contrato de tres fontes — SEMPRE rodar)
- `npm run build` → sucesso; `npx vitest run` → 169/169 (12 arquivos)
- `SELECT (public.rpc_acoes_bi('2026-07-01','2026-07-31',NULL,NULL,NULL))::text` → o objeto `kpis` **NAO** contem as chaves `valorAberto`, `negociosAberto`, `valorTocado`, `negociosTocados` (bucket "aberto" removido inteiro)
- Mesma chamada → `valorPerdido` > 0 e `negociosPerdido` > 0 (deixaram de ser 0 fixo). Julho/2026 esperado: **7 negocios / R$ 1.060.000,00**
- Mesma chamada → `negociosOutrosStatus = 0`. **Zero AQUI e sinal de saude, nao campo morto**: significa que o ERP so tem os 3 status conhecidos
- `SELECT * FROM public.rpc_acoes_funil_gestao('2026-07-01','2026-07-31',NULL,NULL)` → `funil.visitas = 546` (INALTERADA — visitas nao filtram Repasse), `funil.oportunidades = 112` (liquida, era 193), `funil.valorOportunidades ≈ R$ 13.264.057,00`, `funil.perdidos = 7`, `funil.valorPerdido ≈ R$ 1.060.000,00`
- `SELECT * FROM public.rpc_acoes_funil_gestao('2026-01-01','2026-12-31',NULL,NULL)` → `oportunidades = 536` (era 833 → 724 → 536), `valorOportunidades ≈ R$ 57.864.317,51`
- **Ganho sem fan-out, qualquer janela:** `COUNT(*)` deve ser IGUAL a `COUNT(DISTINCT pdo_codigointerno)` no conjunto de ganhos apos canonizacao. 2026 deve dar **121 pedidos / R$ 15.130.847,18** (antes: 125 linhas / R$ 16.689.847,18)
- **Perdido conta uma vez:** `COUNT(*) = COUNT(DISTINCT ngo_numero)` no conjunto de perdidos
- **Cancelado nao entra:** nenhum `pdo_situacaopedido='Cancelado'` alimenta Perdidos (inspecao da SQL instalada)
- **Nenhuma clausula de periodo** usa `ngo_datacadastro` ou `ngo_dataatualizacao` (grep na definicao instalada; `ngo_dataatualizacao` so pode aparecer em `ORDER BY` de dedup)
- **Filtros:** com `p_vendedor` preenchido, `funil.ganhos` e `funil.perdidos` DIMINUEM (antes eram globais e ignoravam o filtro). Com `p_tipo_acao` preenchido, ganhos e perdidos ficam IGUAIS (o filtro so afeta visitas/oportunidades)
- `meta.perdidosSemAtribuicao` medido em julho/2026 (esperado 0) **e em uma janela de 2025** (valor desconhecido — reportar o que der, nao assumir 0)
- **UI `/bi/acoes`:** card "Valor em Aberto" **AUSENTE** do grid (nao R$ 0, nao tooltip herdado); card "Valor Perdido" com tooltip citando `mirror.crm_negocios` + `ngo_datafechamento` + `ngo_vlrtotalnegociado` e **zero mencao a pedido Cancelado**; card "Valor Ganho" declarando que a regua e R$ de PEDIDO aprovado
- **UI bloco 1:** titulo "Atividade e desfechos do periodo" (nao "Funil de Conversao"); nota fixa `role="note"` com o texto "Período dos eventos: ações por conclusão, ganhos por aprovação de pedido e perdas por fechamento de negócio."; Ganhos e Perdidos lado a lado com fonte e data visiveis; **nenhuma taxa ganho/(ganho+perdido) em lugar nenhum**
- **UI:** com `perdidosSemAtribuicao > 0`, a explicacao aparece; com 0, nao aparece

### v6 (regressão — SEMPRE rodar)
- `npm run build` → sucesso (sem erros TS)
- `npx vitest run` → 164/164 (12 arquivos, inclui testes novos AcoesFunilConversao, AcoesEsforcoRetorno, AcoesMapaOportunidades, etc)
- Abrir /bi/acoes → grafico "Tipo de Acao" e pizza (PieChartWithLabels) com leader lines e labels externos
- Tabela "Acoes do Periodo" tem colunas Etapa, Valor e Status: a linha mostra etapa e valor do negocio vinculado; acao sem negocio exibe "—" nas duas colunas
- Chips de filtro por status: clicar "Ganho" → tabela filtra, badge informa acoes sem negocio ocultas
- Chart "Clientes em Risco" visivel com 5 barras (faixas de dias sem contato)
- Heatmap usa cidade do CLIENTE (fn_cli_cidade), nao emp_cidade
- StatusDesconhecidoAlert aparece se negociosOutrosStatus > 0
- `SELECT (public.rpc_acoes_detalhe('2026-07-01','2026-07-31',NULL,NULL,NULL,50,0,'Ganho'))::text` → **todas** as linhas com status='Ganho', dedup por ngo_nronegocio (1 ação por negócio único); nenhuma com outro status
- `SELECT (public.rpc_acoes_detalhe('2026-07-01','2026-07-31',NULL,NULL,NULL,50,0,NULL))::text` → estritamente MAIS linhas que a chamada acima (sem dedup, backward compat do 8º param)
- `SELECT * FROM public.rpc_acoes_clientes_risco(NULL, NULL)` → totalCarteira na ordem de ~8,7 mil clientes em 5 faixas; a soma das 5 faixas bate com o total
- `SELECT * FROM public.rpc_acoes_clientes_risco(<nome de um consultor>, NULL)` → totalCarteira estritamente menor que o total sem filtro

### v7 (novos indicadores — SEMPRE rodar)
- Abrir `/bi/acoes` → expande corretamente em 5 blocos
- **Bloco 1 — Funil + Ranking:** funil estritamente decrescente (visitas > oportunidades > ganhos) no ano corrente; o ranking expõe **ao menos um** consultor com `visitas > 100` e `ganhos = 0` — é o caso que motivou a feature (asserção de existência: não depende de QUEM está no topo, então não quebra no dia em que a pessoa fechar um negócio); o topo de "valor ganho" ser diferente do topo de "visitas" é **consistente com** a atribuição híbrida (armadilha 9) — é sinal, não prova: a prova é o teste unitário `sortRanking — valorGanho desc`
- **Bloco 2 — Esforço e Retorno:** tabela-ranking visível com InlineBar, toggle consultor/cliente funcional (muda agrupamento sem refetch), 8 linhas + botão "ver mais"
- **Bloco 3 — Gestão de Carteira:** card "Clientes em Risco" mostra 5 faixas dias sem contato; clicar faixa 31-60 → abre aba "Sem contato" com a **mesma contagem** exibida na barra (drill-down bate com o chart)
- **Bloco 4 — Mapa:** mapa visível e colapsável, toggle "Todas abertas" | "Tocadas no mês" funcional (alterna entre estoque completo e filtrado por período), ClusterMarker agrupa pinos com badge numérico, clicar cluster abre popup com lista de negócios
- Expandir mapa, varrer pixels do canvas de markers → **0 px `rgb(0,0,0)`**, >0 px `#b83a28` (vermelho >= 90), >0 px `#d4b896` (champagne < 90)
- Clicar pino vermelho → popup mostra `diasParado >= 90` (validado: 173 dias vermelho, 38 dias champagne)
- Clicar os 4 critérios do ranking (visitas, oportunidades, ganhos, valor) → ordem muda **sem nova request** (ordenação client-side, não refetch)
- **Bloco 5 — Listas de Gestão:** 3 abas (sem-contato, desperdício, negativas) com paginação e search; o total de cada aba bate com o rodapé de paginação, e "negativas" é a menor das três
- `SELECT * FROM public.rpc_acoes_funil_gestao('2026-01-01','2026-12-31',NULL,NULL)` → visitas > oportunidades > ganhos (funil não pode inverter); `rankingConsultores` não vazio
- `SELECT (public.rpc_acoes_gestao_listas('sem_contato','2026-01-01','2026-12-31',NULL,NULL,50,0,NULL,NULL,NULL))::text` → maior das 3 listas; contagem bate com o card "Clientes em Risco"
- `SELECT (public.rpc_acoes_gestao_listas('desperdicio','2026-01-01','2026-12-31',NULL,NULL,50,0,NULL,NULL,NULL))::text` → estritamente MENOS linhas que a mesma chamada com `p_from/p_to = NULL` (armadilha 13)
- `SELECT (public.rpc_acoes_gestao_listas('negativas','2026-01-01','2026-12-31',NULL,NULL,50,0,NULL,NULL,NULL))::text` → menor das 3 listas, não vazia
- `SELECT (public.rpc_acoes_gestao_listas('tipo_invalido',...))::text` → EXCEPTION (p_tipo é validado, não silencia)
- `SELECT * FROM public.rpc_acoes_mapa_oportunidades(NULL,NULL,NULL,NULL)` → `comCoordenada + semCoordenada = total`; plota ~82% dos negócios abertos e o rodapé informa quantos ficaram sem coordenada; `valorNoMapa` < valor total (o resto é o sem-coordenada) — modo "Todas abertas"
- `SELECT * FROM public.rpc_acoes_mapa_oportunidades(NULL,NULL,'2026-07-01','2026-07-31')` → estritamente MENOS pinos que a chamada acima (modo "Tocadas no mês" filtra por período)
- **Vazamento de erro técnico no DOM** (gate do security standard #6 — fix de `4072fa2`; testar SEMPRE, a asserção é grepável de propósito): forçar o card de erro e medir
  - sem a flag → `getByText(/PGRST|biRpcService|Could not find the function/).count() === 0` (só a mensagem amigável no DOM)
  - com `bi_debug=true` → a mesma contagem é **> 0** (o diagnóstico técnico volta, para uso interno)
  - o passo mede os dois lados de propósito: só o `=== 0` passaria também se o card de erro nunca renderizasse

### v7.1 (pós-security-gate — SEMPRE rodar após deployment)
- **AVISO METODOLÓGICO:** limpar route interception (`page.unrouteAll()`) no início de toda rodada de QA. A injeção de falha de rodada anterior (`p_qa_forcado`) persistiu no contexto Playwright e simulou quebra total de `/bi/acoes` (5 RPCs 404) — quase provocou rollback indevido
- Logado, percorrer `/bi/painel` → 200 com dado real; ganhos + em-andamento batem com o total de negócios e a taxa de conversão exibida
- Percorrer `/bi/pedidos`, `/bi/servicos` (`rpc_servicos_bi` 200, vazio legítimo em Jul/2026), `/crm/negocios`, `/crm/mapa` (Leaflet, 2 RPCs) → todos 200
- `/bi/acoes` logado: **0** elementos `alert`, 5 blocos com dado real, funil decrescente, mapa plotando a maior parte dos negócios abertos
- F5 + navegação rápida entre telas → **zero** 401/403 e zero `42501`/`permission denied` no body
- **Todas** as requisições `/rest/v1` em 200, com `role=authenticated` nos headers
- Smoke v7 anterior continua passando (regressão verificada)

### v7.3 (melhorias UX — SEMPRE rodar)
- Abrir `/bi/acoes` → toggle do mapa exibe counts numéricos (ex: "Todas abertas (42)" / "Tocadas no mês (12)") — counts > 0 quando há dados
- Chart "Clientes em Risco" → barras com gradiente sequencial champagne→terracota (primeira barra mais clara, última mais escura) — NÃO cor única
- Bloco 1 (Funil) → badge de contexto visível com `role="note"` (inspecionar DOM: `[role="note"]` presente dentro do funil)
- Antes do bloco "Gestão de Carteira" → mini-cards top 3 "sem contato" visíveis (3 cards com nome de cliente + dias); se base sem dados de carteira, seção não renderiza (null) — não é erro
- AcoesSection → gráficos de distribuição usam barras horizontais ordenadas DESC (HorizontalBarChart), NÃO pizza — PieChartWithLabels ausente desta tela (mas NÃO deletado do projeto)
- `npm run build` → sucesso (sem erros TS nas 6 files tocadas)

### v8 (dedup + paginação numerada — SEMPRE rodar)
- `SELECT (public.rpc_acoes_detalhe('2026-07-01','2026-07-31',NULL,NULL,NULL,50,0,'Ganho'))::text` → linhas mostram apenas a ação mais recente de cada negócio único (sem duplicatas por ngo_nronegocio); total retornado = count de negócios únicos, não de linhas raw
- `SELECT (public.rpc_acoes_detalhe('2026-07-01','2026-07-31',NULL,NULL,NULL,50,0,NULL))::text` → estritamente MAIS linhas que a chamada com 'Ganho' (sem dedup, backward compat)
- Abrir `/bi/acoes` → clicar chip "Ganho" → tabela detalhe mostra paginação numerada (botões de página 1, 2, 3...), NÃO "carregar mais"
- Trocar filtro de status (ex: Ganho → Perdido) → paginação reseta para página 1 automaticamente
- `npm run build` → sucesso (sem erros TS; ACOES_DETALHE_LIMIT não referenciado em nenhum import)

## Riscos / Acoplamentos

### PENDENCIAS CONHECIDAS (v9 — abertas, com dono a definir)

- **BLOQUEIA DEPLOY — migrations untracked.** As v8/v5 (regra de ganhos hoje instalada) e mais 9 migrations estao aplicadas na VPS e **fora do Git**. Publicar a v9/v6 como "supersede v8" sem a v8 existir no repositorio nao faz sentido e deixa producao e repo divergentes. Ordem obrigatoria antes de qualquer push: (1) versionar as ja aplicadas, (2) comparar cada uma com a funcao INSTALADA no banco, (3) so entao incluir v9/v6.
- **Bug do acento na CTE `parados` (ramo morto, demanda propria).** A CTE compara com `'REPASSE DE MÁQUINA'` **com acento**, que nunca casa com a base (gravada sem acento). O filtro e um no-op silencioso: hoje nao exclui nada. NAO foi corrigido aqui de proposito — corrigir muda "Dias Parados" (`diasParados.negociosAbertos`, 531→530 em 2026), que esta fora do objetivo desta entrega. Exige migration e validacao proprias.
- **CTE `parados` preservada byte a byte vs v5**, por decisao explicita. `ngo_datacadastro` aparece ali apenas como ORDENACAO de dedup — nao e clausula de periodo, entao nao viola o contrato das tres fontes. Unificar isso e demanda propria.
- **DECISAO PENDENTE do cliente — definicao de "oportunidade".** A v9/v6 adotou a definicao **A** (tocadas no periodo, ainda abertas: julho 112 / R$ 13.264.057,00). Alternativas medidas: **B** estoque aberto hoje (2.828 / R$ 380.294.194,39 — nao reage ao seletor de periodo, porque o mirror nao guarda historico de status) e **C** criadas no periodo por `ngo_datacadastro` (141, 110 abertas / R$ 16.065.886,25). Se **C** for adotada, a regra "`ngo_datacadastro` nunca data indicador" precisa ser reescrita para "so pode datar o evento de CRIACAO, nunca desfecho" — mudanca de regra a ser feita explicitamente, nunca em silencio.

### v6 (vigente)
- **Histórico de ETL, não estado atual:** `crm_negocios` (text DISTINCT) e `crm_carteira_clientes` (PK duplicada) já falharam. Na verificação de 2026-08-02, ambos estavam `idle` em `mirror.sync_control`; se a tela aparentar falta de dados, valide o ciclo atual antes de assumir que o incidente histórico voltou.
- NegociosFilterContext e compartilhado com outras telas BI — mudanca no shape (ex: statusNegocio) afeta esta pagina
- fn_cli_cidade depende de crm_carteira_clientes populada — cliente sem registro = cidade NULL
- 86% dos clientes estao na faixa +90 dias — valor esperado alto nessa barra (nao e bug)
- rpc_acoes_clientes_risco sem indice dedicado (125ms aceitavel hoje, monitorar se carteira crescer)

### v7 (novos riscos)
- **`supabase_rest` perda de listen:** acontece periodicamente neste ambiente — `NOTIFY pgrst, 'reload schema'` é aposta; todo deploy de RPC pode exigir `docker kill -s SIGUSR1` no container para o schema recarregar
- **RPCs invisíveis à role `anon`:** todas as novas RPCs exigem sessão autenticada — PGRST202 (Postgrest esconde função que role não pode executar) é indistinguível de "função não aplicada"
- **Não use somente `mirror.sync_metadata`:** a fonte operacional primária é `mirror.sync_control` e a data máxima da tabela; metadados auxiliares podem não refletir todas as views.
- **Índices duplicados rejeitados:** `idx_acoes_ngo_nro_negocio`/`idx_acoes_ngo_nronegocio` (832 kB, zero scans do segundo) e `idx_acoes_tipocontato`/`idx_acoes_tipo_contato` — custo mantencao > benefício nas queries atuais
- **Override dark CSS quebrado:** `:root` não-layered de `index.css` emitido DEPOIS `.dark` (Tailwind v3); especificidade 0,1,0 idêntica, ordem de origem decide. Afeta `--voux-danger`/`--voux-success` em 19 componentes dark (a11y, não estética) — demanda MEDIUM própria
- **`diasParado == null` — 38% pinos:** negócio nunca tocado por ação; pinta champagne ("saudável") — pior caso. Pré-existente
- **Migrations locais não rastreadas:** há migrations aplicadas na VPS fora do Git, inclusive as versões atuais da regra de ganhos. Produção e repositório podem divergir se uma mudança for feita sem primeiro versionar esse histórico.
- **Atribuição valor por `ngo_vendedores`:** vendedor ausente ou sem mapeamento em `usuarios` deixa o ganho fora do ranking, embora ele permaneça no total do funil.
- **NegociosFilterContext compartilhado:** mudança no shape (ex: statusNegocio) afeta esta página + outras telas BI
- **fn_cli_cidade depende carteira populada:** cliente sem registro = cidade NULL
- **`/bi/servicos` vazio em Jul/2026:** rpc_servicos_bi retorna 200 com 0 linhas (legítimo — nenhuma ação/serviço naquele mês); diferencia-se de erro de privilégio (que daria PGRST202). Vazio e negado parecem iguais na UI — sem data, ambos mostram card vazio
- **`useSyncStatus` dead code:** hook órfão em `src/hooks/bi/` (sem consumidor); monitor de ETL vivo usa `useEtlStatus` via RPC. Cleanup pendente

### v7.1 (privilégios)
- **As RPCs de ações exigem sessão autenticada:** chamada anônima retorna 401 — comportamento esperado desde 2026-07-26. Toda tela BI precisa estar logada para receber dado; 401 em massa após deploy é sintoma de sessão, não de RPC faltando
