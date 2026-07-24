---
feature: acoes-bi
updated_at: 2026-07-24T18:00:00Z
updated_by: scribe (haiku)
status: active
---

# BI Acoes — Tela de Produtividade Comercial (v6)

**Proposito:** Pagina /bi/acoes com KPIs (3 cards de valor + contadores), heatmap matrix consultor x cidade, tabela completa paginada (com etapa, valor e status do negocio vinculado, filtravel por status), graficos (pizza com leader lines + linha com area + barras verticais "Clientes em Risco") para analise de produtividade comercial (acoes CRM). Funis comerciais: VENDAS, Vendas AP, REPASSE DE MAQUINA.

## Entry Points
- `src/pages/bi/BiAcoes.tsx` — pagina principal (rota /bi/acoes)
- `src/components/bi/sections/AcoesSection.tsx` — secao de KPIs + ranking + graficos + tabelas
- `src/components/bi/sections/AcoesKpiGrid.tsx` — grid de KPIs com 3 cards de valor
- `src/components/bi/sections/AcoesDetailWithFilter.tsx` — wrapper da tabela detalhe com chips de filtro por status

## Dependencias Internas
- `src/hooks/bi/useAcoesBIRpc.ts` — hook de fetch para RPC acoes
- `src/hooks/bi/useAcoesDetalheRpc.ts` — hook de fetch para tabela detalhe (aceita statusNegocio)
- `src/hooks/bi/useClientesRiscoRpc.ts` — hook de fetch para RPC clientes em risco
- `src/services/biRpcService.ts` — fetchAcoesBI + fetchAcoesDetalhe (com p_status) + fetchClientesRisco
- `src/types/bi/` — tipos split em modulos (barrel em `src/types/biRpc.ts`), inclui ClientesRiscoFaixa e RpcClientesRisco
- `src/components/bi/AcoesRankingTable.tsx` — heatmap matrix consultor x cidade (usa fn_cli_cidade)
- `src/components/bi/AcoesClientesTable.tsx` — top 15 clientes mais atendidos no ANO ATUAL
- `src/components/bi/AcoesDetailTable.tsx` — tabela COMPLETA paginada (p_limit/p_offset/p_search), com colunas observacao, etapa, valor e status do negocio vinculado
- `src/components/bi/BiTableCard.tsx` — card DRY para tabelas (skeleton/error/empty states, 119 linhas)
- `src/components/bi/BiTopbarPortal.tsx` — dropdown "Tipo de Acao" na topbar
- `NegociosFilterContext` — contexto de filtros compartilhado (vendedor, periodo, tipoAcao, statusNegocio)

## Database
- RPC: `rpc_acoes_bi` v5 — usa `mirror.fn_cli_cidade()` (DRY), CTE `negocios_dedup` (dedup por ngo_numero), 3 cards de valor filtrados por funis comerciais
- RPC: `rpc_acoes_detalhe` v4 — tabela completa server-side, paginacao (p_limit/p_offset/p_search), campo `status` (ngo_conclusao), filtro opcional `p_status` (DEFAULT NULL, backward compat). Labels: "Em Andamento"="Em Aberto", "Ganha"="Ganho", "Perdida"="Perdido"
- RPC: `rpc_acoes_clientes_risco` — 5 faixas de dias sem contato (0-15, 16-30, 31-60, 61-90, +90) da carteira de clientes. Params: p_vendedor (match por usr_nomeusuario=aco_vendedor), p_cidade. Base = DISTINCT cli_idcliente da carteira total
- Funcao: `mirror.fn_cli_cidade(p_cli_id)` — resolve cidade do cliente (DRY, usada em ambas RPCs)
- Tabelas: `mirror.crm_acoes`, `mirror.crm_negocios`, `mirror.crm_carteira_clientes`
- Migration: `supabase/migrations/20260724_fn_cli_cidade_v5.sql` (supersede v4 inline e v3)
- Migration: `supabase/migrations/20260724_rpc_acoes_detalhe_v4.sql` (v4 com p_status + campo status)
- Migration: `supabase/migrations/20260724_rpc_acoes_clientes_risco.sql` (RPC nova)

## Padroes
- Server-side aggregation via RPC (nao agrega no browser)
- fn_cli_cidade centraliza resolucao de cidade (DRY — nao mais LATERAL LIMIT 1 duplicado)
- Dedup negocios via CTE negocios_dedup (elimina fan-out de ngo_numero duplicado)
- Paginacao server-side em AcoesDetailTable (p_limit/p_offset/p_search)
- Filtros via NegociosFilterContext (vendedor, periodo, tipo de acao, statusNegocio)
- Filtro por status: chips "Em Aberto"/"Ganho"/"Perdido" em AcoesDetailWithFilter; quando ativo, acoes sem negocio desaparecem (badge informa)
- Heatmap matrix: linhas=consultores, colunas=cidades (fn_cli_cidade do CLIENTE)
- porMes: ANO ATUAL fixo, NAO respeita filtro de datas
- Grafico "Tipo de Acao": PieChartWithLabels (SvgDonut) com leader lines e labels externos (nome + %, fontSize 11)
- Grafico de linha (SvgLine): area opacity 0.40
- Grafico "Clientes em Risco": VerticalBarChart com 5 faixas de dias sem contato; respeita filtro vendedor/cidade
- Tabela detalhe: etapa, valor e status null quando acao sem negocio vinculado (61%) — exibe "—"; valor formatado sem decimais (R$ 66.000)
- KPIs: valorAberto/negociosAberto, valorGanho/negociosGanho, valorPerdido/negociosPerdido, negociosTocados, negociosOutrosStatus
- StatusDesconhecidoAlert: alerta visual quando negociosOutrosStatus > 0

## Como Alterar com Seguranca
1. fn_cli_cidade e usada por AMBAS as RPCs + rpc_acoes_clientes_risco — alterar a funcao impacta heatmap + detalhe + risco
2. CTE negocios_dedup garante dedup por ngo_numero — remover causa fan-out (1472 vs 664 rows)
3. 3 cards de valor filtram por funis comerciais hardcoded — novos funis exigem alterar RPC
4. BiTopbarPortal depende do portal DOM node no layout
5. Alterar tipos exige editar modulos em src/types/bi/ (barrel em biRpc.ts)
6. `src/lib/acoesChartUtils.ts` e dead code (orphaned desde v5.1) — cleanup futuro, nao importar
7. rpc_acoes_detalhe v3 (7 params) deve ser dropada no deploy — v4 com DEFAULT NULL cobre backward compat
8. rpc_acoes_clientes_risco usa aco_vendedor = usr_nomeusuario (match direto) — alterar nomes no ETL quebra o chart

## Smoke
- `npm run build` → sucesso (sem erros TS)
- `npx vitest run` → 135/135 (inclui 9 testes de AcoesDetailTable)
- Abrir /bi/acoes → grafico "Tipo de Acao" e pizza (PieChartWithLabels) com leader lines e labels externos
- Tabela "Acoes do Periodo" tem colunas Etapa, Valor e Status (MARCELO FERNANDES: etapa "3-PROPOSTA AO CLIENTE", valor R$ 66.000)
- Chips de filtro por status: clicar "Ganho" → tabela filtra, badge informa acoes sem negocio ocultas
- Chart "Clientes em Risco" visivel com 5 barras (faixas de dias sem contato)
- Heatmap usa cidade do CLIENTE (fn_cli_cidade), nao emp_cidade
- StatusDesconhecidoAlert aparece se negociosOutrosStatus > 0
- `SELECT (public.rpc_acoes_detalhe('2026-07-01','2026-07-31',NULL,NULL,NULL,50,0,'Ganho'))::text` → 690 rows com status='Ganho'
- `SELECT (public.rpc_acoes_detalhe('2026-07-01','2026-07-31',NULL,NULL,NULL,50,0,NULL))::text` → 5567 rows (backward compat)
- `SELECT * FROM public.rpc_acoes_clientes_risco(NULL, NULL)` → totalCarteira=8731, 5 faixas
- `SELECT * FROM public.rpc_acoes_clientes_risco('MAYCON KALISKY', NULL)` → totalCarteira=334

## Riscos / Acoplamentos
- crm_negocios tem erro pendente (text DISTINCT) — CTE negocios_dedup pode retornar vazio se view nao sincroniza
- crm_carteira_clientes tem PK dup pendente — fn_cli_cidade usa LIMIT 1, mitigado; rpc_acoes_clientes_risco usa DISTINCT cli_idcliente (mitigado)
- NegociosFilterContext e compartilhado com outras telas BI — mudanca no shape (ex: statusNegocio) afeta esta pagina
- fn_cli_cidade depende de crm_carteira_clientes populada — cliente sem registro = cidade NULL
- 86% dos clientes estao na faixa +90 dias — valor esperado alto nessa barra (nao e bug)
- rpc_acoes_clientes_risco sem indice dedicado (125ms aceitavel hoje, monitorar se carteira crescer)
