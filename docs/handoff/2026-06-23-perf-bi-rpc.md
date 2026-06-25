# Handoff: Performance BI — Migração para RPCs Server-Side

**Data:** 2026-06-23  
**Branch:** `perf/bi-quick-wins`  
**Último commit:** `52ac077 feat(bi): add RPC hooks + refactor CrmOverview to server-side aggregation`  
**Status:** EM ANDAMENTO — regressão nos charts da Visão Geral + /bi/painel não migrado

---

## Contexto do Problema

O dashboard BI estava **lento** porque `src/lib/aggregateComercial.ts` (208 linhas) baixa TODOS os registros crus do Supabase e agrega no browser (loops, dedup, sort). Solução: mover a agregação para RPCs PostgreSQL no banco.

---

## O que foi feito ✅

### 1. Banco de dados (aplicado em produção via SSH)

**Arquivo:** `supabase/migrations/20260623_create_comercial_rpcs.sql` (369 linhas)

- **6 índices** criados em `mirror.crm_acoes` e `mirror.crm_negocios`
- **5 RPCs** criadas no schema `public`:
  - `rpc_kpis_comercial(p_from, p_to, p_vendedor?)` → JSON com totais
  - `rpc_ranking_vendedores(p_from, p_to, p_limit?)` → SETOF ranking
  - `rpc_evolucao_mensal(p_from, p_to, p_vendedor?)` → SETOF serie temporal
  - `rpc_ranking_regioes(p_from, p_to, p_limit?)` → SETOF cidades
  - `rpc_clientes_por_vendedor(p_vendedor, p_from, p_to)` → SETOF clientes
- `NOTIFY pgrst, 'reload schema'` executado
- **Testado via curl** com anon key real — todas RPCs retornam 200 com dados reais (0.75-1.2s)

### 2. Frontend — camada de serviço + hooks

| Arquivo | Linhas | Função |
|---------|--------|--------|
| `src/types/comercialRpc.ts` | 58 | Interfaces TypeScript |
| `src/services/comercialRpcService.ts` | 93 | Funções que chamam `supabase.rpc()` |
| `src/hooks/useComercialRpc.ts` | 112 | Hooks TanStack Query (staleTime 5min, keepPreviousData) |

### 3. Frontend — página CRM Visão Geral migrada

| Arquivo | Linhas | Função |
|---------|--------|--------|
| `src/pages/crm/CrmOverviewRpc.tsx` | 193 | Nova página usando hooks RPC |
| `src/pages/crm/CrmOverview.tsx` | 10 | Delegação para CrmOverviewRpc |

### 4. Quality gates passaram

- `npm run lint` ✅
- `npm run typecheck` ✅  
- `npm run build` ✅

---

## O que está QUEBRADO / PENDENTE ⚠️

### Bug 1: Charts vazios na Visão Geral CRM

**Sintoma:** KPI cards carregam (521 registros, 337 clientes, R$16.4M, etc.) mas os 4 gráficos (Evolução Mensal, Top 10 Consultores, Tipos de Contato, Tipos de Ação) ficam **vazios/em branco**.

**Hipótese provável:** Os hooks RPC retornam dados mas os componentes de chart (`LineChart`, `BarChart`, `PieChart`) podem não estar renderizando porque:
1. A prop `data` está chegando como array vazio (enabled=false por hasDateRange=false? filters.dateRange.from/to vazios?)
2. Os chart components esperam formato diferente (ex: `Number` vs `bigint` do Postgres)
3. O contexto `ComercialDataContext` pode não estar propagando `filters.dateRange` corretamente para o CrmOverviewRpc

**Diagnóstico sugerido:** Adicionar `console.log` nos dados que os hooks retornam (`evolucao`, `rankingVendedores`, `kpisRaw.tiposContato`, `kpisRaw.tiposAcao`) para ver se estão populados ou vazios. Se populados, o problema é no componente de chart; se vazios, é no hook/RPC.

### Bug 2: /bi/painel ainda lento

**Causa:** Esta página (`src/components/dashboard/DashboardBI.tsx` ou similar) **NÃO foi migrada**. Ainda usa o caminho antigo: `fetchRegistrosComerciais` → `aggregateComercial.ts` no browser.

**Solução:** Migrar para usar os mesmos hooks `useComercialRpc` ou criar RPCs adicionais se o /bi/painel tem indicadores diferentes.

---

## Infraestrutura

- **Repo:** origin = repositório canônico (confirmar com `git remote -v`)
- **Banco:** Supabase self-hosted, VPS 178.238.235.203
- **Container DB:** `supabase_supabase_db.1.m8y6f3d5q3r31f060kq74ncfm`
- **Supabase URL:** `https://ceressupabasebi.vouxconsultoria.com.br`
- **Anon key:** no `.env` (VITE_SUPABASE_PUBLISHABLE_KEY)
- **Colunas do banco:** SEM underscore separando prefixo (ex: `aco_dthconclusao`, NÃO `aco_dth_conclusao`)

---

## Arquivos não commitados relevantes

```
?? supabase/migrations/20260623_create_comercial_rpcs.sql
 M src/components/dashboard/DashboardBI.tsx
 M src/lib/aggregateComercial.ts
```

(O commit `52ac077` inclui types, service, hooks e CrmOverviewRpc, mas a migration SQL e alguns outros files podem não estar incluídos.)

---

## Próximos passos (em ordem)

1. **Debugar charts vazios** — diagnosticar se filters.dateRange chega ao CrmOverviewRpc e se os hooks retornam dados
2. **Corrigir a regressão** — fazer os 4 charts renderizarem com dados das RPCs
3. **Migrar /bi/painel** — identificar quais indicadores essa página usa e conectar às RPCs existentes (ou criar novas)
4. **Migrar tabs restantes** (Comercial, Inteligência, Ações) incrementalmente
5. **Remover código morto** — `aggregateComercial.ts` e hooks antigos após migração completa
6. **Commit final + push** (via @devops)

---

## Decisões técnicas tomadas

- RPCs como `SECURITY DEFINER` + `STABLE` (read-only, cacheable)
- TanStack Query com staleTime 5min (evita re-fetch excessivo)
- `placeholderData: keepPreviousData` (UX sem flash de loading)
- Dedup de `ngo_nronegocio` via `DISTINCT` dentro das RPCs (corrige pipeline inflado)
- Migração incremental tab-a-tab (não big-bang)
