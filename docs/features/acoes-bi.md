---
feature: acoes-bi
updated_at: 2026-07-23T00:00:00Z
updated_by: scribe (haiku)
status: active
---

# BI Acoes — Tela de Produtividade Comercial

**Proposito:** Pagina /bi/acoes com 8 KPIs, ranking consultor x cidade e graficos para analise de produtividade da equipe comercial (acoes CRM).

## Entry Points
- `src/pages/bi/BiAcoes.tsx` — pagina principal (rota /bi/acoes)
- `src/components/bi/sections/AcoesSection.tsx` — secao de KPIs + ranking + graficos

## Dependencias Internas
- `src/hooks/bi/useAcoesBIRpc.ts` — hook de fetch para RPC acoes
- `src/services/biRpcService.ts` — fetchAcoesBI (chamada Supabase)
- `src/types/biRpc.ts` — interfaces de tipagem da resposta
- `src/components/bi/AcoesRankingTable.tsx` — tabela ranking consultor x cidade
- `src/components/bi/BiTopbarPortal.tsx` — dropdown "Tipo de Acao" na topbar
- `NegociosFilterContext` — contexto de filtros compartilhado

## Database
- RPC: `rpc_acoes_bi` (v2 — server-side aggregation com LEFT JOIN dedup em crm_negocios)
- Tabelas: `mirror.crm_acoes`, `mirror.crm_negocios` (LEFT JOIN para valor negociado)
- Migration: `supabase/migrations/20260723_rpc_acoes_bi_v2.sql`

## Padroes
- Server-side aggregation via RPC (nao agrega no browser)
- Filtros via NegociosFilterContext (vendedor, periodo, tipo de acao)
- Lazy loading via React Suspense
- Dropdown de tipo de acao injetado na topbar via portal

## Como Alterar com Seguranca
1. RPC v2 faz LEFT JOIN com crm_negocios para valor negociado — nao remover sem ajustar KPIs
2. BiTopbarPortal depende do portal DOM node no layout — alterar layout pode quebrar dropdown
3. AcoesRankingTable espera shape da RPC v2 — alterar RPC exige alterar tipagem em biRpc.ts

## Smoke
- `npm run build` → sucesso (sem erros TS)
- Abrir https://ceresbi.vouxconsultoria.com.br/bi/acoes → 8 KPIs visiveis (Total Acoes, Cidades, Consultores, Visitas, Clientes, Tipos, Valor Negociado, Tempo Medio)
- Tabela ranking consultor x cidade renderiza com dados
- Dropdown "Tipo de Acao" na topbar filtra corretamente

## Riscos / Acoplamentos
- crm_negocios tem erro pendente (text DISTINCT) — LEFT JOIN pode falhar se view nao sincroniza
- NegociosFilterContext e compartilhado com outras telas BI — mudanca no shape afeta esta pagina
