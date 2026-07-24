---
feature: acoes-bi
updated_at: 2026-07-24T00:00:00Z
updated_by: scribe (haiku)
status: active
---

# BI Acoes — Tela de Produtividade Comercial (v5)

**Proposito:** Pagina /bi/acoes com KPIs (3 cards de valor + contadores), heatmap matrix consultor x cidade, tabela completa paginada e graficos para analise de produtividade comercial (acoes CRM). Funis comerciais: VENDAS, Vendas AP, REPASSE DE MAQUINA.

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
- `src/components/bi/AcoesDetailTable.tsx` — tabela COMPLETA paginada (p_limit/p_offset/p_search), com coluna observacao
- `src/components/bi/BiTableCard.tsx` — card DRY para tabelas (skeleton/error/empty states, 119 linhas)
- `src/components/bi/BiTopbarPortal.tsx` — dropdown "Tipo de Acao" na topbar
- `NegociosFilterContext` — contexto de filtros compartilhado

## Database
- RPC: `rpc_acoes_bi` v5 — usa `mirror.fn_cli_cidade()` (DRY), CTE `negocios_dedup` (dedup por ngo_numero), 3 cards de valor filtrados por funis comerciais
- RPC: `rpc_acoes_detalhe` v2 — tabela completa server-side (664 rows/mes), paginacao (p_limit/p_offset/p_search), coluna aco_atividadeexecutada
- Funcao: `mirror.fn_cli_cidade(p_cli_id)` — resolve cidade do cliente (DRY, usada em ambas RPCs)
- Tabelas: `mirror.crm_acoes`, `mirror.crm_negocios`, `mirror.crm_carteira_clientes`
- Migration: `supabase/migrations/20260724_fn_cli_cidade_v5.sql` (supersede v4 inline e v3)

## Padroes
- Server-side aggregation via RPC (nao agrega no browser)
- fn_cli_cidade centraliza resolucao de cidade (DRY — nao mais LATERAL LIMIT 1 duplicado)
- Dedup negocios via CTE negocios_dedup (elimina fan-out de ngo_numero duplicado)
- Paginacao server-side em AcoesDetailTable (p_limit/p_offset/p_search)
- Filtros via NegociosFilterContext (vendedor, periodo, tipo de acao)
- Heatmap matrix: linhas=consultores, colunas=cidades (fn_cli_cidade do CLIENTE)
- porMes: ANO ATUAL fixo, NAO respeita filtro de datas
- KPIs: valorAberto/negociosAberto, valorGanho/negociosGanho, valorPerdido/negociosPerdido, negociosTocados, negociosOutrosStatus
- StatusDesconhecidoAlert: alerta visual quando negociosOutrosStatus > 0

## Como Alterar com Seguranca
1. fn_cli_cidade e usada por AMBAS as RPCs — alterar a funcao impacta heatmap + detalhe
2. CTE negocios_dedup garante dedup por ngo_numero — remover causa fan-out (1472 vs 664 rows)
3. 3 cards de valor filtram por funis comerciais hardcoded — novos funis exigem alterar RPC
4. BiTopbarPortal depende do portal DOM node no layout
5. Alterar tipos exige editar modulos em src/types/bi/ (barrel em biRpc.ts)

## Smoke
- `npm run build` → sucesso (sem erros TS)
- `npx vitest run` → 135/135 (inclui 9 testes de AcoesDetailTable)
- Abrir /bi/acoes → 3 cards de valor visiveis (Em Aberto ~R$16,8M, Ganho ~R$754k, Perdido ~R$135k)
- Tabela "Acoes do Periodo" mostra TODAS as acoes (664 no mes, paginada), com coluna observacao
- Heatmap usa cidade do CLIENTE (fn_cli_cidade), nao emp_cidade
- StatusDesconhecidoAlert aparece se negociosOutrosStatus > 0
- `SELECT mirror.fn_cli_cidade('8342077')` → retorna cidade (validacao DB)

## Riscos / Acoplamentos
- crm_negocios tem erro pendente (text DISTINCT) — CTE negocios_dedup pode retornar vazio se view nao sincroniza
- crm_carteira_clientes tem PK dup pendente — fn_cli_cidade usa LIMIT 1, mitigado
- NegociosFilterContext e compartilhado com outras telas BI — mudanca no shape afeta esta pagina
- fn_cli_cidade depende de crm_carteira_clientes populada — cliente sem registro = cidade NULL
