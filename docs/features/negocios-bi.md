---
feature: negocios-bi
updated_at: 2026-07-27T00:00:00Z
updated_by: scribe (haiku)
status: active
---

# Negocios BI (RPC server-side)

**Proposito:** Tela /bi/negocios — metricas agregadas de negocios CRM (KPIs ganhos/perdidos/andamento, funil, origens, motivos de perda, evolucao mensal 12m, velocidade de funil, ranking consultores). Toda agregacao roda em RPC Postgres, frontend so renderiza.

## Entry Points
- `src/hooks/bi/useNegociosBIRpc.ts` — React Query hook (stale 5min)
- `src/services/bi/negociosBIService.ts` — fetch para a RPC
- `src/types/bi/negocios.ts` + `src/types/biRpc.ts` — interfaces

## Dependencias Internas
- `src/contexts/NegociosFilterContext.tsx` — filtros (periodo, funis, vendedor, cidade)
- `src/components/dashboard/negocios/` — KPIs, Charts, ConsultorTable, FinancialAlerts
- `src/pages/crm/CrmNegocios.tsx` — pagina container

## Database
- RPC: `rpc_negocios_bi(p_from date, p_to date, p_funis text[], p_cidade text, p_vendedor text)` → JSON
- Tabela: `mirror.crm_negocios` (dedup por ngo_numero via DISTINCT ON)
- Filtro temporal: **ngo_datafechamento** (data de fechamento, NAO ngo_datacadastro)
- CTE evolucao: janela propria 12m rolling, desacoplada do filtro principal
- CTE velocidade: ordena por dias_medio DESC (nao existe fun_ordem no schema)
- Migration: `supabase/migrations/20260727_fix_rpc_negocios_bi_datafechamento.sql`

## Padroes
- Toda agregacao server-side (zero calculo no browser)
- ngo_datacadastro permanece no SELECT (campo retornado), mas NUNCA como filtro de periodo
- Dedup por ngo_numero com DISTINCT ON (evita fan-out por duplicata de etapa)

## Como Alterar com Seguranca
1. Filtro de periodo = ngo_datafechamento — NUNCA trocar de volta para ngo_datacadastro
2. CTE deduped usa DISTINCT ON (ngo_numero) — alterar ORDER BY com cuidado (afeta qual registro sobrevive)
3. Evolucao 12m e CTE separada (v_evo_from/v_evo_to) — nao acoplar ao p_from/p_to do filtro principal
4. Testar com filtro de funis + vendedor (combinacoes nulas devem retornar JSON valido, nunca null)

## Smoke
- `ssh -i ~/.ssh/id_ed25519 root@178.238.235.203 "docker exec \$(docker ps -q -f name=supabase_db) psql -U postgres -d postgres -c \"SELECT (r->>'kpis')::json->>'ganhos' as ganhos FROM rpc_negocios_bi('2026-07-01'::date, '2026-07-31'::date, ARRAY['VENDAS','ADM','BANCOS','OFICINA','MARKETING']) r;\""` → ganhos >= 20
- `curl -s https://ceresbi.vouxconsultoria.com.br` → HTTP 200

## Riscos / Acoplamentos
- crm_negocios depende do ETL bloco A (crm_acoes/crm_negocios) — se ETL falhar, dados congelam
- Qualquer mudanca em colunas da mirror.crm_negocios quebra a RPC (CAST implicitos em ngo_ciclovendas, ngo_qtdacoes)
