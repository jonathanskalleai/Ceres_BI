---
feature: acoes-bi
updated_at: 2026-07-23T00:00:00Z
updated_by: scribe (haiku)
status: active
---

# BI Acoes — Tela de Produtividade Comercial

**Proposito:** Pagina /bi/acoes com 8 KPIs, heatmap matrix consultor x cidade, tabelas de clientes/detalhamento e graficos para analise de produtividade da equipe comercial (acoes CRM).

## Entry Points
- `src/pages/bi/BiAcoes.tsx` — pagina principal (rota /bi/acoes)
- `src/components/bi/sections/AcoesSection.tsx` — secao de KPIs + ranking + graficos + tabelas (148 linhas)

## Dependencias Internas
- `src/hooks/bi/useAcoesBIRpc.ts` — hook de fetch para RPC acoes
- `src/services/biRpcService.ts` — fetchAcoesBI (chamada Supabase)
- `src/types/biRpc.ts` — interfaces de tipagem da resposta (v3 types)
- `src/components/bi/AcoesRankingTable.tsx` — heatmap matrix consultor x cidade (usa cli_cidade do CLIENTE)
- `src/components/bi/AcoesClientesTable.tsx` — top 15 clientes mais atendidos no ANO ATUAL (ignora filtro mes)
- `src/components/bi/AcoesDetailTable.tsx` — top 50 acoes detalhadas do PERIODO DO FILTRO
- `src/components/bi/BiTopbarPortal.tsx` — dropdown "Tipo de Acao" na topbar
- `NegociosFilterContext` — contexto de filtros compartilhado

## Database
- RPC: `rpc_acoes_bi` (v3 — server-side aggregation, LEFT JOIN dedup crm_negocios, JOIN crm_carteira_clientes para cli_cidade)
- Tabelas: `mirror.crm_acoes`, `mirror.crm_negocios`, `mirror.crm_carteira_clientes` (cli_cidade)
- Migration: `supabase/migrations/20260723_rpc_acoes_bi_v3.sql` (supersede v2)

## Padroes
- Server-side aggregation via RPC (nao agrega no browser)
- Filtros via NegociosFilterContext (vendedor, periodo, tipo de acao)
- Lazy loading via React Suspense
- Dropdown de tipo de acao injetado na topbar via portal
- Heatmap matrix (AcoesRankingTable): linhas=consultores, colunas=cidades (cli_cidade do CLIENTE, nao emp_cidade da filial); pivot via useMemo; legenda de intensidade inclusa
- porMes: ANO ATUAL fixo (jan-dez corrente), NAO respeita filtro de datas
- AcoesClientesTable: top 15 do ANO ATUAL (ignora filtro mes)
- AcoesDetailTable: top 50 do PERIODO DO FILTRO

## Como Alterar com Seguranca
1. RPC v3 faz LEFT JOIN com crm_negocios + crm_carteira_clientes — nao remover sem ajustar KPIs e heatmap
2. BiTopbarPortal depende do portal DOM node no layout — alterar layout pode quebrar dropdown
3. AcoesRankingTable e graficos porCidade usam cli_cidade (cidade do CLIENTE) — alterar JOIN exige revisar heatmap + graficos
4. porMes e AcoesClientesTable usam ano fixo (CURRENT_DATE) — nao depende do filtro de periodo
5. Alterar RPC exige alterar tipagem em src/types/biRpc.ts

## Smoke
- `npm run build` → sucesso (sem erros TS)
- Abrir https://ceresbi.vouxconsultoria.com.br/bi/acoes → 8 KPIs visiveis (Total Acoes, Cidades, Consultores, Visitas, Clientes, Tipos, Valor Negociado, Tempo Medio)
- Heatmap matrix consultor x cidade renderiza com dados (cidades = cli_cidade do cliente)
- Tabela "Clientes Mais Atendidos" mostra top 15 do ano corrente
- Tabela "Acoes do Periodo" mostra top 50 do periodo filtrado
- Dropdown "Tipo de Acao" na topbar filtra corretamente

## Riscos / Acoplamentos
- crm_negocios tem erro pendente (text DISTINCT) — LEFT JOIN pode falhar se view nao sincroniza
- crm_carteira_clientes tem PK dup pendente — pode afetar cli_cidade se JOIN multiplicar linhas
- NegociosFilterContext e compartilhado com outras telas BI — mudanca no shape afeta esta pagina
