---
feature: acoes-bi
updated_at: 2026-07-24T00:00:00Z
updated_by: scribe (haiku)
status: active
---

# BI Acoes — Tela de Produtividade Comercial (v5.1)

**Proposito:** Pagina /bi/acoes com KPIs (3 cards de valor + contadores), heatmap matrix consultor x cidade, tabela completa paginada (com etapa e valor do negocio vinculado), graficos (pizza com leader lines + linha com area) para analise de produtividade comercial (acoes CRM). Funis comerciais: VENDAS, Vendas AP, REPASSE DE MAQUINA.

## Entry Points
- `src/pages/bi/BiAcoes.tsx` — pagina principal (rota /bi/acoes)
- `src/components/bi/sections/AcoesSection.tsx` — secao de KPIs + ranking + graficos + tabelas
- `src/components/bi/sections/AcoesKpiGrid.tsx` — grid de KPIs com 3 cards de valor

## Dependencias Internas
- `src/hooks/bi/useAcoesBIRpc.ts` — hook de fetch para RPC acoes
- `src/services/biRpcService.ts` — fetchAcoesBI + fetchAcoesDetalhe (chamadas Supabase)
- `src/types/bi/` — tipos split em modulos (barrel em `src/types/biRpc.ts`, 22 linhas)
- `src/components/bi/AcoesRankingTable.tsx` — heatmap matrix consultor x cidade (usa fn_cli_cidade)
- `src/components/bi/AcoesClientesTable.tsx` — top 15 clientes mais atendidos no ANO ATUAL
- `src/components/bi/AcoesDetailTable.tsx` — tabela COMPLETA paginada (p_limit/p_offset/p_search), com colunas observacao, etapa e valor do negocio vinculado
- `src/components/bi/BiTableCard.tsx` — card DRY para tabelas (skeleton/error/empty states, 119 linhas)
- `src/components/bi/BiTopbarPortal.tsx` — dropdown "Tipo de Acao" na topbar
- `NegociosFilterContext` — contexto de filtros compartilhado

## Database
- RPC: `rpc_acoes_bi` v5 — usa `mirror.fn_cli_cidade()` (DRY), CTE `negocios_dedup` (dedup por ngo_numero), 3 cards de valor filtrados por funis comerciais
- RPC: `rpc_acoes_detalhe` v3 — tabela completa server-side (664 rows/mes), paginacao (p_limit/p_offset/p_search), colunas aco_atividadeexecutada + etapa + valor (via LEFT JOIN crm_negocios dedup)
- Funcao: `mirror.fn_cli_cidade(p_cli_id)` — resolve cidade do cliente (DRY, usada em ambas RPCs)
- Tabelas: `mirror.crm_acoes`, `mirror.crm_negocios`, `mirror.crm_carteira_clientes`
- Migration: `supabase/migrations/20260724_fn_cli_cidade_v5.sql` (supersede v4 inline e v3)
- Migration: `supabase/migrations/20260724_rpc_acoes_detalhe_v3.sql` (v3 com negocios_dedup LEFT JOIN)

## Padroes
- Server-side aggregation via RPC (nao agrega no browser)
- fn_cli_cidade centraliza resolucao de cidade (DRY — nao mais LATERAL LIMIT 1 duplicado)
- Dedup negocios via CTE negocios_dedup (elimina fan-out de ngo_numero duplicado)
- Paginacao server-side em AcoesDetailTable (p_limit/p_offset/p_search)
- Filtros via NegociosFilterContext (vendedor, periodo, tipo de acao)
- Heatmap matrix: linhas=consultores, colunas=cidades (fn_cli_cidade do CLIENTE)
- porMes: ANO ATUAL fixo, NAO respeita filtro de datas
- Grafico "Tipo de Acao": PieChartWithLabels (SvgDonut) com leader lines e labels externos (nome + %, fontSize 11)
- Grafico de linha (SvgLine): area opacity 0.40
- Tabela detalhe: etapa e valor null quando acao sem negocio vinculado (61%) — exibe "—"; valor formatado sem decimais (R$ 66.000)
- KPIs: valorAberto/negociosAberto, valorGanho/negociosGanho, valorPerdido/negociosPerdido, negociosTocados, negociosOutrosStatus
- StatusDesconhecidoAlert: alerta visual quando negociosOutrosStatus > 0

## Como Alterar com Seguranca
1. fn_cli_cidade e usada por AMBAS as RPCs — alterar a funcao impacta heatmap + detalhe
2. CTE negocios_dedup garante dedup por ngo_numero — remover causa fan-out (1472 vs 664 rows)
3. 3 cards de valor filtram por funis comerciais hardcoded — novos funis exigem alterar RPC
4. BiTopbarPortal depende do portal DOM node no layout
5. Alterar tipos exige editar modulos em src/types/bi/ (barrel em biRpc.ts)
6. `src/lib/acoesChartUtils.ts` e dead code (orphaned desde v5.1) — cleanup futuro, nao importar

## Smoke
- `npm run build` → sucesso (sem erros TS)
- `npx vitest run` → 135/135 (inclui 9 testes de AcoesDetailTable)
- Abrir /bi/acoes → grafico "Tipo de Acao" e pizza (PieChartWithLabels) com leader lines e labels externos
- Tabela "Acoes do Periodo" tem colunas Etapa e Valor (MARCELO FERNANDES: etapa "3-PROPOSTA AO CLIENTE", valor R$ 66.000)
- Heatmap usa cidade do CLIENTE (fn_cli_cidade), nao emp_cidade
- StatusDesconhecidoAlert aparece se negociosOutrosStatus > 0
- `SELECT (public.rpc_acoes_detalhe('2026-07-01','2026-07-31',NULL,NULL,NULL,1,0))::text` → retorna campos etapa e valor

## Riscos / Acoplamentos
- crm_negocios tem erro pendente (text DISTINCT) — CTE negocios_dedup pode retornar vazio se view nao sincroniza
- crm_carteira_clientes tem PK dup pendente — fn_cli_cidade usa LIMIT 1, mitigado
- NegociosFilterContext e compartilhado com outras telas BI — mudanca no shape afeta esta pagina
- fn_cli_cidade depende de crm_carteira_clientes populada — cliente sem registro = cidade NULL
