# Handoff — Próxima Sessão: Dedup RPCs + Dead Code Cleanup

**Data:** 2026-06-24
**Branch:** `perf/bi-quick-wins`
**Status:** PENDENTE (próxima sessão)
**PR:** https://github.com/jonathanskalleai/Ceres_BI/pull/2

---

## Contexto

A migração BI para RPCs server-side está completa:
- 6 RPCs no banco (negocios, pedidos, servicos, admin, acoes, produtos)
- Sections BI migradas para hooks RPC
- SQL Server eliminado dos services BI (operacional, servicos, admin)
- ETL Python unificado em `/opt/etl/` com 5 blocos (A-E), cron a cada 15min

Restam 3 itens de limpeza/otimização:

---

## Item 4 — Deduplicar RPCs no BiPainel

### Problema

`BiPainel.tsx` usa `usePainelKPIsRpc` que chama internamente:
- `useNegociosBIRpc` × 2 (período atual + anterior)
- `useAcoesBIRpc` × 2 (período atual + anterior)
- `useOperacionalData` × 1

Enquanto isso, as sections (`ComercialSection`, `AcoesSection`) chamam os
**mesmos hooks** (`useNegociosBIRpc`, `useAcoesBIRpc`) com potencialmente os
mesmos params — gerando chamadas duplicadas ao banco se os queryKeys diferem
por formatação/ordem dos params.

### Investigação necessária

1. Comparar queryKeys do `usePainelKPIsRpc` vs `ComercialSection`/`AcoesSection`:
   - Se `from/to/funis` são idênticos → React Query já deduplica (staleTime 5min)
   - Se diferem por formato (ex: `undefined` vs `null`) → chamadas duplicadas reais
2. Verificar no Network tab do browser quantas chamadas `rpc/rpc_negocios_bi` e
   `rpc/rpc_acoes_bi` disparam ao carregar a página BI

### Opções de solução

1. **Unificar params** — garantir que BiPainel e sections passam exatamente os mesmos
   `from/to/funis` → React Query deduplica naturalmente (menor esforço)
2. **BiPainel consome dados das sections via context** — sections passam dados para
   cima via context/zustand, BiPainel não chama RPC direto (mais invasivo)
3. **Prefetch no BiLayout** — fazer 1 prefetch no container pai com staleTime,
   todos os filhos usam o cache (elegante mas precisa de refactor no layout)

### Arquivos envolvidos

- `src/hooks/bi/usePainelKPIsRpc.ts` (177 linhas) — hook composto
- `src/hooks/bi/useNegociosBIRpc.ts` — queryKey check
- `src/hooks/bi/useAcoesBIRpc.ts` — queryKey check
- `src/components/bi/sections/ComercialSection.tsx` — params passados
- `src/components/bi/sections/AcoesSection.tsx` — params passados
- `src/pages/bi/BiPainel.tsx` — orquestra tudo

---

## Item 5 — Push + PR (JÁ FEITO)

✅ Branch pushed, PR #2 aberto e atualizado.

---

## Item 6 — Remover dead code (sqlServerApi + hooks antigos)

### O que pode ser removido APÓS smoke test no browser

**sqlServerApi.ts** — único consumidor restante é `DashboardViewExplorer.tsx` (tool de debug admin).
Decisão: manter `sqlServerApi.ts` mas remover do path crítico BI? Ou matar tudo?

**Hooks antigos (client-side aggregation):**

| Arquivo | Consumidores restantes | Pode remover? |
|---------|----------------------|---------------|
| `src/hooks/bi/useNegociosBI.ts` | `usePainelKPIs.ts` (old), `useCrossKPIs.ts`, test file | ⚠ useCrossKPIs ainda usa |
| `src/hooks/bi/useAcoesBI.ts` | `usePainelKPIs.ts` (old) | ⚠ vide usePainelKPIs old |
| `src/hooks/bi/usePedidosData.ts` | `usePedidosKPIs.ts`, `useCrossKPIs.ts`, test file | ⚠ useCrossKPIs ainda usa |
| `src/hooks/bi/useServicosData.ts` | ? (verificar) | Provavelmente sim |
| `src/hooks/bi/useAdminData.ts` | ? (verificar) | Provavelmente sim |
| `src/hooks/bi/usePainelKPIs.ts` (old) | Type import em `PainelAcoesSection`, `PainelNegociosSection`, `PainelValoresSection` | ⚠ types usados |
| `src/hooks/useComercialData.ts` | `ComercialDataContext`, `BiTopbarPortal`, `useClientesKPIs`, `useInteligenciaBI`, `useAcoesBI` (old), `Dashboard.tsx`, `PerformanceComercial.tsx` | ❌ NÃO pode remover ainda |
| `src/lib/aggregateComercial.ts` | via `useComercialData` | ❌ NÃO pode remover ainda |

### Ordem de remoção segura

1. Confirmar no browser que sections BI renderizam com dados reais (smoke test)
2. Remover `usePainelKPIs.ts` (old) — mover types para `usePainelKPIsRpc.ts`
3. Se `useCrossKPIs` (BiInteligencia) for migrado para RPC → remover `useNegociosBI`, `usePedidosData`, `useAcoesBI`
4. Somente quando CRM pages (Dashboard, PerformanceComercial) migrarem → remover `useComercialData` + `aggregateComercial`
5. `sqlServerApi.ts` — remover quando `DashboardViewExplorer` for descontinuado ou migrado

### Remoção imediata segura (sem dependentes)

- `src/hooks/bi/useServicosData.ts` — se nenhum consumidor ativo
- `src/hooks/bi/useAdminData.ts` — se nenhum consumidor ativo
- Console.logs de debug, imports não usados

---

## Infra (referência rápida)

- **VPS:** `178.238.235.203`
- **Supabase URL:** `https://ceressupabasebi.vouxconsultoria.com.br`
- **ETL:** `/opt/etl/` — 5 blocos (A-E), 15 tabelas, cron `*/15`
- **Repo:** `git@github.com:jonathanskalleai/Ceres_BI.git`
- **Branch:** `perf/bi-quick-wins`
- **PR:** #2

---

## Na próxima sessão, comece por:

1. Ler este handoff
2. Abrir app no browser → aba BI → confirmar charts com dados
3. Atacar item 4 (dedup RPCs) — começar verificando queryKeys no Network tab
4. Item 6 (dead code) — remover hooks mortos que não têm consumidores
5. Verificar se `useCrossKPIs` / BiInteligencia precisa de migração RPC
