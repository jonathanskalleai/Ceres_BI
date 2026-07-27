---
feature: acoes-bi
updated_at: 2026-07-27T14:00:00Z
updated_by: scribe (haiku)
status: active
---

# BI Acoes — Tela de Gestao Comercial (v8)

**Proposito:** Pagina /bi/acoes com 9 indicadores de gestao comercial organizados em 5 blocos: funil de conversao (visitas → oportunidades → ganhos + ranking de consultores), gestao de carteira (clientes em risco por dias sem contato, com 4 critérios ordenáveis), esforço e retorno (tabela-ranking com InlineBar: top consultores por visitas vs valor), mapa de oportunidades (pinos geoloc com toggle estoque/período + cluster de pinos) e listas de gestão (sem contato, desperdício, negativas paginadas com search). Funis: VENDAS, Vendas AP, REPASSE DE MAQUINA. Semântica: visita=aco_tipocontato='Visita'; oportunidade=negócio comercial distinto tocado por ≥1 ação no período; fechamento=ngo_conclusao='Ganho' (status atual).

## Entry Points
- `src/pages/bi/BiAcoes.tsx` — pagina principal (rota /bi/acoes)
- `src/components/bi/sections/AcoesSection.tsx` — secao de KPIs + ranking + graficos + tabelas (v7)
- `src/components/bi/sections/AcoesKpiGrid.tsx` — grid de KPIs com 3 cards de valor (v6)
- `src/components/bi/sections/AcoesDetailWithFilter.tsx` — wrapper da tabela detalhe com chips de filtro por status + paginação numerada server-side (v8)
- `src/components/bi/AcoesFunilConversao.tsx` — bloco 1: funil visitas→oportunidades→ganhos + ranking consultores (NOVO)
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
- RPC: `rpc_acoes_bi` v5 — usa `mirror.fn_cli_cidade()` (DRY), CTE `negocios_dedup` (dedup por ngo_numero), 3 cards de valor (v6)
- RPC: `rpc_acoes_detalhe` v5 — tabela completa server-side, paginacao numerada PAGE_SIZE=50 LIMIT/OFFSET; dedup condicional: quando p_status IS NOT NULL (Ganho/Perdido), aplica ROW_NUMBER PARTITION BY ngo_nronegocio (apenas ação mais recente de cada negócio único), total conta negócios únicos; quando p_status IS NULL comportamento inalterado (v8)
- RPC: `rpc_acoes_clientes_risco` — 5 faixas de dias sem contato (v6)
- RPC: `rpc_acoes_funil_gestao` (NOVO v7) — funil visitas→oportunidades→ganhos + rankingConsultores + diasParados + meta. Params: p_from, p_to, p_vendedor, p_cidade. Retorna ~70-100ms
- RPC: `rpc_acoes_gestao_listas` (NOVO v7) — listas paginadas por p_tipo (sem_contato | desperdicio | negativas). Params: p_tipo, p_from, p_to, p_vendedor, p_cidade, p_limit, p_offset, p_search, p_dias_min, p_dias_max. Lança EXCEPTION se p_tipo inválido
- RPC: `rpc_acoes_mapa_oportunidades` v2 (NOVO v7.2) — pinos geoloc, toggle estoque/período. Params: p_vendedor, p_cidade, p_from (opcional), p_to (opcional). Quando p_from/p_to NULL = estoque aberto completo; quando preenchidos = tocadas no período. Coordenada por cascata (última ação do cliente → fallback carteira). Retorna lat/lng, diasParado, ngoNumero, valor
- Funcao: `mirror.fn_cli_cidade(p_cli_id)` — resolve cidade do cliente (DRY, v6)
- Tabelas: `mirror.crm_acoes`, `mirror.crm_negocios`, `mirror.crm_carteira_clientes`
- Índices (proposta rejeitada): `mirror.idx_acoes_diasParado` e `mirror.idx_negocios_vendedores` — benchmark mostrou 0 ganho queries atuais, custo +escrita; documentado em `20260725_idx_acoes_gestao.sql`
- Migration: `supabase/migrations/20260725_rpc_acoes_funil_gestao.sql` (NOVO)
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
- KPIs: 13 cards de valor com prop `formula` (conceito de negócio em linguagem clara, exibido no tooltip hover) além do `dataSource` técnico (v8.1)
- StatusDesconhecidoAlert: alerta visual quando status desconhecido > 0 (v6)
- Toggle mapa com counts dinâmicos: ChipToggle exibe count derivado de `data?.total` e `data?.comCoordenada` via useMemo (v7.3)
- Badge de contexto no funil: texto explicativo fixo com `role="note"` em AcoesFunilConversao (v7.3, a11y)
- Mini-cards top 3 "sem contato": AcoesGestaoCarteiraSummary renderiza antes da gestão; usa useAcoesGestaoListasRpc com limit:3, retorna null se dados vazios (v7.3)
- PieCharts substituídos por HorizontalBarChart ordenado DESC em AcoesSection: PieChartWithLabels NÃO é dead code (usado em 5 outras sections) — apenas removido desta tela (v7.3)

## Como Alterar com Seguranca
### v6 (vigente)
1. fn_cli_cidade e usada por AMBAS as RPCs + rpc_acoes_clientes_risco — alterar a funcao impacta heatmap + detalhe + risco
2. CTE negocios_dedup garante dedup por ngo_numero em rpc_acoes_bi — remover causa fan-out (mais que dobra as linhas retornadas). Em rpc_acoes_detalhe v5, dedup condicional por ROW_NUMBER PARTITION BY ngo_nronegocio aplica-se apenas quando p_status IS NOT NULL — remover a window function causa duplicatas no filtro Ganho/Perdido
3. 3 cards de valor filtram por funis comerciais hardcoded — novos funis exigem alterar RPC
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
11. **`ngo_datafechamento` é inutilizável no funil VENDAS:** há negócios com status Ganho, mas **nenhum** com `ngo_datafechamento` preenchida no ano. Não usar para "fechou no período" — filtrar por ela zera o funil
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

## Smoke
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
### v6 (vigente)
- crm_negocios tem erro pendente (text DISTINCT) — CTE negocios_dedup pode retornar vazio se view nao sincroniza
- crm_carteira_clientes tem PK dup pendente — fn_cli_cidade usa LIMIT 1, mitigado; rpc_acoes_clientes_risco usa DISTINCT cli_idcliente (mitigado)
- NegociosFilterContext e compartilhado com outras telas BI — mudanca no shape (ex: statusNegocio) afeta esta pagina
- fn_cli_cidade depende de crm_carteira_clientes populada — cliente sem registro = cidade NULL
- 86% dos clientes estao na faixa +90 dias — valor esperado alto nessa barra (nao e bug)
- rpc_acoes_clientes_risco sem indice dedicado (125ms aceitavel hoje, monitorar se carteira crescer)

### v7 (novos riscos)
- **`supabase_rest` perda de listen:** acontece periodicamente neste ambiente — `NOTIFY pgrst, 'reload schema'` é aposta; todo deploy de RPC pode exigir `docker kill -s SIGUSR1` no container para o schema recarregar
- **RPCs invisíveis à role `anon`:** todas as novas RPCs exigem sessão autenticada — PGRST202 (Postgrest esconde função que role não pode executar) é indistinguível de "função não aplicada"
- **`mirror.sync_metadata` cego:** 0 linhas para `crm_acoes`/`crm_negocios`/`crm_carteira_clientes` — monitoramento de ETL possivelmente não vê sincronização nessas views
- **Índices duplicados rejeitados:** `idx_acoes_ngo_nro_negocio`/`idx_acoes_ngo_nronegocio` (832 kB, zero scans do segundo) e `idx_acoes_tipocontato`/`idx_acoes_tipo_contato` — custo mantencao > benefício nas queries atuais
- **Override dark CSS quebrado:** `:root` não-layered de `index.css` emitido DEPOIS `.dark` (Tailwind v3); especificidade 0,1,0 idêntica, ordem de origem decide. Afeta `--voux-danger`/`--voux-success` em 19 componentes dark (a11y, não estética) — demanda MEDIUM própria
- **`diasParado == null` — 38% pinos:** negócio nunca tocado por ação; pinta champagne ("saudável") — pior caso. Pré-existente
- **Migrations `20260630`/`20260631` untracked:** 5 migrations aplicadas na VPS seguem fora do repo há um mês
- **Atribuição valor por ngo_vendedores:** 10 negócios (dos 1000+) têm ngo_vendedores = NULL → 0.89% perda; mapeamento usr_codusuario → nome pode falhar silenciosamente
- **crm_negocios erro `text DISTINCT`:** pendente desde v3; CTE negocios_dedup pode vazio se view não sincroniza
- **crm_carteira_clientes PK dup:** pendente desde v8 ETL; fn_cli_cidade usa LIMIT 1 (mitigado), rpc_acoes_clientes_risco usa DISTINCT (mitigado)
- **NegociosFilterContext compartilhado:** mudança no shape (ex: statusNegocio) afeta esta página + outras telas BI
- **fn_cli_cidade depende carteira populada:** cliente sem registro = cidade NULL
- **`/bi/servicos` vazio em Jul/2026:** rpc_servicos_bi retorna 200 com 0 linhas (legítimo — nenhuma ação/serviço naquele mês); diferencia-se de erro de privilégio (que daria PGRST202). Vazio e negado parecem iguais na UI — sem data, ambos mostram card vazio
- **`useSyncStatus` dead code:** hook órfão em `src/hooks/bi/` (sem consumidor); monitor de ETL vivo usa `useEtlStatus` via RPC. Cleanup pendente

### v7.1 (privilégios)
- **As RPCs de ações exigem sessão autenticada:** chamada anônima retorna 401 — comportamento esperado desde 2026-07-26. Toda tela BI precisa estar logada para receber dado; 401 em massa após deploy é sintoma de sessão, não de RPC faltando
