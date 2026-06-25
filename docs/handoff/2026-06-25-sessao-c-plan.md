# Handoff: Plano Sessão C — Matar ComercialDataContext

**Data:** 2026-06-25  
**Branch:** `perf/bi-quick-wins`  
**Último commit:** `8f12104` (push feito, PR #2 open)  
**Status:** PLANEJADO — não iniciado

---

## Problema Estrutural

`ComercialDataContext` chama `useComercialData` internamente. TODAS as páginas CRM — inclusive as já migradas (CrmMapa, CrmConsultores, CrmOverview) — esperam o download de todos os registros crus antes de renderizar. As RPCs que criamos nas Sessões A+B estão sendo anuladas porque o context boot é o bottleneck real.

---

## Estado Atual (pós Sessões A+B)

### BI (100% migrado ✅)
Todas as pages em `src/pages/bi/` usam RPCs. Rápido. Pronto.

### CRM — Status por página

| Página | Status | Dados | Bloqueio |
|--------|--------|-------|----------|
| CrmOverview | MIXED | RPCs para dados, mas context para filtros | Context boot |
| CrmConsultores | MIXED | RPCs para dados, mas context para filtros | Context boot |
| CrmMapa | MIXED | RPCs para dados, mas context para filtros | Context boot |
| CrmCriticos | SLOW | `useComercialDataContext()` → DashboardClientesCriticos | Precisa RPC |
| CrmInsights | SLOW | `useComercialDataContext()` → DashboardInsights | Precisa RPC |
| CrmNegocios | SLOW | `useComercialDataContext()` + `useNegociosData()` → DashboardNegociosMensais | Precisa RPC |
| CrmRegistros | SLOW | `useComercialDataContext()` → DashboardRegistros | Precisa RPC |
| CrmAdministrativo | SLOW | `useComercialDataContext()` → DashboardAdministrativo | Precisa RPC |
| CrmConsultorDetail | SLOW | `useComercialDataContext()` → DashboardConsultorDetail | Precisa RPC |
| PerformanceComercial | SLOW | `useComercialData()` + `useNegociosData()` direto | Precisa RPC |
| Dashboard.tsx (legado) | SLOW | `useComercialData()` direto (shell monolítico 240 linhas) | Avaliar se usado |

---

## Plano Sessão C: Separar Filtros do Fetch

### Step 1 — Criar NegociosFilterContext "puro" (sem fetch)

O `useNegociosFilter` (em `src/contexts/NegociosFilterContext.tsx`) JÁ EXISTE e é leve — só estado de filtros (dateRange, vendedor, cidade, categoria, funil). As páginas RPC já o usam.

Problema: `ComercialDataContext` TAMBÉM fornece filtros + dados. Páginas que usam `useComercialDataContext()` pegam `{ data, allData, filters }`.

Ação: Fazer as páginas MIXED (CrmOverviewRpc, CrmConsultoresRpc, CrmMapaRpc) pegarem filtros SOMENTE de `useNegociosFilter`, eliminando dependency em `ComercialDataContext`.

### Step 2 — Migrar páginas SLOW restantes

Para cada página que ainda usa `useComercialDataContext()`:

| Página | Dashboard component | Dados que precisa | RPC existente? |
|--------|--------------------:|-------------------|----------------|
| CrmCriticos | DashboardClientesCriticos (282 linhas) | registrosRecentes filtrados + vendedores + pipeline | rpc_registros_recentes + rpc_ranking_vendedores_v2 ✅ |
| CrmRegistros | DashboardRegistros (144 linhas) | registrosRecentes com paginação/filtro | rpc_registros_recentes ✅ |
| CrmAdministrativo | DashboardAdministrativo (136 linhas) | vendedores + totais por filial | rpc_ranking_vendedores_v2 + rpc_admin_bi ✅ |
| CrmInsights | DashboardInsights (328 linhas) | registrosRecentes + vendedores + regioes (analytics) | rpc_registros_recentes + rpc_ranking_vendedores_v2 + rpc_ranking_regioes ✅ |
| CrmConsultorDetail | DashboardConsultorDetail (320 linhas) | clientes_por_vendedor + registros | rpc_clientes_por_vendedor + rpc_registros_recentes ✅ |
| CrmNegocios | DashboardNegociosMensais (531 linhas!) | NegociosSummary completa | rpc_negocios_bi (existe mas formato diferente) ⚠️ |

### Step 3 — Lidar com DashboardNegociosMensais (531 linhas)

Este é o mais pesado. Usa `useNegociosData()` que agrega negocios com evolução mensal, por consultor, por região, por tipo. O `rpc_negocios_bi` existe mas retorna formato BI (diferente).

Opções:
- A) Criar `rpc_negocios_crm` com formato que DashboardNegociosMensais espera
- B) Refatorar DashboardNegociosMensais para usar `rpc_negocios_bi` + adaptar dados

### Step 4 — PerformanceComercial

Depende de NegociosSummary + DadosComerciais. Após Step 3, se rpc_negocios_crm existir, migrar PerformanceComercial usando os mesmos dados + rpc_registros_recentes para clientesPotencial.

### Step 5 — Matar ComercialDataContext e useComercialData

Quando NENHUMA página importar `useComercialDataContext()`:
- Deletar `src/contexts/ComercialDataContext.tsx`
- Deletar `src/hooks/useComercialData.ts`
- Deletar `src/lib/aggregateComercial.ts` (208 linhas de dead code)
- Deletar `src/services/pipelineByVendedorService.ts`
- Deletar `src/services/registrosService.ts` (se não usado por mais ninguém)
- Deletar `src/hooks/useNegociosData.ts` (marcado @deprecated)

---

## RPCs disponíveis no banco

| RPC | Cobertura |
|-----|-----------|
| rpc_kpis_comercial | KPIs gerais ✅ |
| rpc_ranking_vendedores | ranking básico ✅ |
| rpc_ranking_vendedores_v2 | +conversao +crm_quality +negocios ✅ |
| rpc_evolucao_mensal | série temporal ✅ |
| rpc_ranking_regioes | cidades + lat/lng ✅ |
| rpc_clientes_por_vendedor | detalhe por vendedor ✅ |
| rpc_registros_recentes | registros individuais com GPS ✅ |
| rpc_listas_filtros | dropdowns vendedores/cidades ✅ |
| rpc_negocios_bi | negócios para BI dashboard ⚠️ formato diferente |
| rpc_acoes_bi | ações para BI ✅ |
| rpc_admin_bi | admin ✅ |
| rpc_pedidos_bi | pedidos ✅ |
| rpc_servicos_bi | serviços ✅ |
| rpc_inteligencia_esforco_bi | esforço ✅ |

---

## Decisões para a próxima sessão

1. CrmNegocios: criar rpc_negocios_crm ou adaptar rpc_negocios_bi?
2. Dashboard.tsx (legado 240 linhas): ainda é acessado? Se não, deletar.
3. DashboardMapa (572 linhas!), DashboardInsights (328), DashboardConsultorDetail (320), DashboardNegociosMensais (531): todos violam o gate de 300 linhas. Refatorar durante a migração ou deixar para depois?

---

## Infraestrutura

- **Repo:** `git@github.com:jonathanskalleai/Ceres_BI.git`
- **Branch:** `perf/bi-quick-wins`
- **PR:** #2 (open) — https://github.com/jonathanskalleai/Ceres_BI/pull/2
- **VPS:** 178.238.235.203 (root, senha em sessão anterior)
- **Container DB:** supabase_supabase_db.1.m8y6f3d5q3r31f060kq74ncfm
- **PostgREST containers:** supabase_supabase_rest.1.kuvg41zpen5rewr3arjlbr62b, supabase_supabase_rest.1.0909dxxfjhu8jh1m4irowptxv
- **Schema reload:** `docker kill --signal=SIGUSR1 <container>`
- **Colunas:** SEM underscore separando prefixo
