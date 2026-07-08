---
feature: crm-overview-charts
updated_at: 2026-07-07T00:00:00Z
updated_by: scribe (haiku)
status: active
---

# CRM Overview — Aba Graficos

**Proposito:** Toggle Cards|Graficos na pagina CRM Overview. A aba "Graficos" exibe 5 LineCharts de evolucao 12 meses rolling (acoes, visitas, negocios ganhos/perdidos, valor pipeline, tipos de acao top 8).

## Entry Points
- `src/pages/crm/CrmOverviewRpc.tsx` — pagina principal com Radix Tabs (Cards | Graficos)
- `src/components/crm/CrmEvolucaoCharts.tsx` — componente dos 5 graficos (143 linhas)

## Dependencias Internas
- `src/hooks/useComercialRpc.ts` — hooks useEvolucaoNegocios12m, useEvolucaoTiposAcao12m
- `src/services/comercialRpcService.ts` — fetch functions para as 2 RPCs novas
- `src/types/comercialRpc.ts` — interfaces EvolucaoNegocios12m, EvolucaoTiposAcao12m
- Reutiliza `rpc_evolucao_mensal` existente para acoes/visitas/valor pipeline

## Database
- RPCs: `rpc_evolucao_negocios_12m(p_vendedor text)`, `rpc_evolucao_tipos_acao_12m(p_vendedor text, p_limit int)`
- Tabelas lidas: `mirror.crm_negocios`, `mirror.crm_acoes`
- Migration: `supabase/migrations/20260707_rpc_evolucao_charts.sql`

## Padroes
- Toggle via Radix Tabs (sem nova rota)
- Lazy fetch: dados carregam apenas ao ativar a aba Graficos (TabsContent unmount)
- Formato flat para tipos_acao com pivot no frontend
- p_limit=8 para tipos de acao (evitar poluicao visual)

## Como Alterar com Seguranca
1. Nao alterar rpc_evolucao_mensal (compartilhada com outros consumers)
2. Manter p_limit default=8 para tipos_acao (UI otimizada para esse limite)
3. CrmEvolucaoCharts.tsx depende das interfaces em comercialRpc.ts — alterar em conjunto

## Smoke
- `npm run build` → sucesso (sem erros TS)
- Abrir https://ceresbi.vouxconsultoria.com.br/crm/overview → toggle "Graficos" visivel
- Clicar em "Graficos" → 5 cards com LineChart renderizam (podem estar empty se RPCs nao aplicadas)

## Riscos / Acoplamentos
- rpc_evolucao_mensal e compartilhada — mudanca nela afeta esta aba + outros consumers
- crm_negocios tem erro pendente (text DISTINCT) — grafico de negocios pode falhar ate resolver
