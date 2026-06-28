# Handoff — Brownfield Discovery Ceres BI

**Data:** 2026-06-26
**Branch:** `perf/bi-quick-wins`
**Sessão:** Audit completo de tech debt
**Próxima sessão:** Execução dos fixes priorizados

---

## Contexto do Projeto

- **Stack:** React 18 + TypeScript + Vite + Supabase + TanStack Query + ECharts + Tailwind
- **Design System:** VOUX (tokens em `src/index.css`, classes em `voux.css`)
- **Banco:** Supabase self-hosted (NÃO Cloud). ETL Python carrega SQL Server → Supabase mirror tables
- **Routing:** React Router v6 — CRM (eager) + BI (lazy) + Tools (lazy) + Admin (lazy)
- **Query strategy:** QueryClient com staleTime 5min, gcTime 30min, refetchOnWindowFocus false
- **Total:** ~23.400 linhas em ~120 arquivos

---

## Resultado do Brownfield Discovery

### CRITICAL (fix obrigatório)

#### 1. ZERO COBERTURA DE TESTES
- Único arquivo: `src/test/example.test.ts` → `expect(true).toBe(true)`
- Playwright em devDeps mas 0 test files
- Vitest configurado (`src/test/setup.ts` existe) mas sem testes reais
- **Lógica crítica sem testes:** `src/lib/formatters.ts`, `src/lib/comercialMappers.ts`, `src/lib/filterUtils.ts`, `src/lib/categoriaFunil.ts`, `src/lib/dateUtils.ts`, `src/hooks/usePerformanceData.ts`

#### 2. MONOLITOS (>300 linhas — HARD gate violation)

| Linhas | Arquivo | Problema |
|--------|---------|----------|
| 637 | `src/components/ui/sidebar.tsx` | shadcn vendor (exempto) |
| 610 | `src/components/performance/Apresentacao2026.tsx` | Data transform + state + slides + render tudo junto |
| 376 | `src/integrations/supabase/types.ts` | Auto-gerado (exempto) |
| 364 | `src/components/bi/charts/BarChart.tsx` | Config/theme inline demais |
| 348 | `src/types/biRpc.ts` | Type-only (exempto) |
| 323 | `src/hooks/useInsights.ts` | Fetch + transform + state misturados |
| 316 | `src/components/dashboard/DashboardAdminDetail.tsx` | Container + presenter |
| 310 | `src/pages/admin/AdminUsers.tsx` | Page com lógica de container |
| 308 | `src/lib/generateConsultoresReport.ts` | PDF layout + data transforms |

**Reais que precisam split (excluindo vendor/auto-gen):** 6 arquivos

#### 3. ZERO ERROR BOUNDARIES
- Nenhum `ErrorBoundary` no projeto inteiro
- Crash em qualquer componente derruba o app

---

### HIGH

#### 4. DEAD CODE — Páginas órfãs (NÃO estão no router)
| Arquivo | Status |
|---------|--------|
| `src/pages/DashboardBIReal.tsx` (201 lines) | Não importado em lugar nenhum |
| `src/pages/ProdutosModule.tsx` (15 lines) | Placeholder "Em construção" |
| `src/pages/PosVendaModule.tsx` (15 lines) | Placeholder |
| `src/pages/Cliente360Module.tsx` (15 lines) | Placeholder |
| `src/pages/PipelineModule.tsx` (15 lines) | Placeholder |
| `src/pages/Index.tsx` (16 lines) | Tem imports MAS não está no router (root redireciona para /crm/overview) |
| `src/App.css` (42 lines) | Não importado em nenhum lugar |

**ATENÇÃO:** `DashboardBI.tsx` e `PerformanceComercial.tsx` NÃO são órfãos:
- `DashboardBI` → importado por `src/components/dashboard-bi/DashboardSpecificView.tsx`
- `PerformanceComercial` → importado por `src/pages/tools/ToolsPerformance.tsx`

#### 5. SERVICES SEM ERROR HANDLING (0 try/catch)
| Service | try/catch |
|---------|-----------|
| `src/services/comercialRpcService.ts` | 0 |
| `src/services/insightsService.ts` | 0 |
| `src/services/listasFiltrosRpcService.ts` | 0 |
| `src/services/metasService.ts` | 0 |
| `src/services/negociosCrmRpcService.ts` | 0 |
| `src/services/negociosService.ts` | 0 |
| `src/services/sqlServerApi.ts` | 0 |
| `src/services/bi/biRpcService.ts` | 0 |

**Nota:** React Query faz catch implícito, mas estes services propagam erros sem contexto útil. Mínimo: wrap com try/catch que adiciona contexto ao erro.

#### 6. HARDCODED HEX (~30 ocorrências fora do VOUX)

Locais principais:
- `src/components/bi/debug/BiDebugOverlay.tsx` — 6 inline hex (debug overlay, menor prioridade)
- `src/components/bi/charts/BrazilHeatmap.tsx` — 4 hex arrays (cores de escala)
- `src/components/bi/painel/Painel*Section.tsx` — fallbacks com cor ERRADA (`#4ade80` deveria ser VOUX success `#7a9b6f`)
- `src/components/bi/KPICard.tsx` — fallbacks com cor errada
- `src/components/dashboard/DashboardClientesCriticos.tsx` — `#dc2626`, `#c97565`
- `src/components/dashboard/DashboardSidebar.tsx` — gradient `#927142`
- `src/components/dashboard/mapa/MapView.tsx` — `#c8b99a`
- `src/components/bi/charts/LineChart.tsx` — `#c8b99a`

#### 7. PROP DRILLING
- `crmData: DadosComerciais` drill: `usePerformanceData` → `PerformanceComercial` → `Apresentacao2026` → sub-computations
- `filters` passado como prop para múltiplos componentes do dashboard (candidato a context)

---

### MEDIUM

#### 8. DRY — Hooks BI RPC boilerplate
Os hooks em `src/hooks/bi/` (23-35 linhas cada) repetem o mesmo padrão:
```typescript
export function useXxxBIRpc(filters) {
  return useQuery({
    queryKey: ['xxx-bi', filters],
    queryFn: () => supabase.rpc('rpc_xxx_bi', params),
    enabled: !!filters,
  })
}
```
**Solução:** factory `useBIRpc<T>(rpcName, filters)` — elimina ~200 linhas de boilerplate em 9+ hooks.

#### 9. TypeScript `any` (8 ocorrências)
- `src/types/insights.ts:45-47,73,108,188,202` — 7× `Record<string, any>` ou `any[]`
- `src/lib/generateConsultoresReport.ts:26` — `report: any`

#### 10. DEPENDÊNCIA MORTA
- `xlsx` (0.18.5) no package.json — ZERO imports em src/. Pode deletar.
- `lovable-tagger` em devDeps — scaffolding remnant

#### 11. PERFORMANCE
- **Leaflet** (~40KB gz) importado eagerly em `MapView.tsx` (rota CRM/mapa)
  - CRM pages são eager no App.tsx → Leaflet entra no bundle principal
  - Solução: lazy import do CrmMapa ou dynamic import do leaflet
- **jspdf** importado staticamente em `generateConsultoresReport.ts`
  - Usado em 1 função. Candidato a `import()` dinâmico

#### 12. ESTRUTURA CONFUSA
- Dual dirs: `src/components/dashboard/` + `src/components/dashboard-bi/`
  - `-bi` importa de `dashboard/` → acoplamento
- Services flat vs nested: `negociosService.ts` (flat) vs `bi/biRpcService.ts` (nested)

---

### LOW (nice to have)

- `embla-carousel-react` — usado no `carousel.tsx` (shadcn UI), legítimo
- ~52% funções sem return type explícito (OK para components, ruim para utils)
- `Apresentacao2026` com 5 useState — candidato a useReducer

---

## Plano de Execução (próxima sessão)

### Fase 1 — Quick Wins (< 1 sessão, impacto alto)

| # | Task | Esforço | Arquivos |
|---|------|---------|----------|
| A | Delete 5 páginas órfãs + App.css | XS (15min) | `src/pages/{DashboardBIReal,ProdutosModule,PosVendaModule,Cliente360Module,PipelineModule}.tsx`, `src/App.css` |
| B | Remove `xlsx` do package.json | XS (5min) | `package.json` |
| C | Add Error Boundary em BiLayout + CrmLayout + AppShell | S (30min) | Criar `src/components/ui/ErrorBoundary.tsx`, editar 3 layouts |
| D | Fix fallback hex errados (success/danger) | S (30min) | `KPICard.tsx`, `Painel*Section.tsx` — trocar `#4ade80`→`var(--voux-success)` sem fallback |

### Fase 2 — Splits de Monolitos (1-2 sessões)

| # | Task | Esforço | Estratégia |
|---|------|---------|------------|
| E | Split `Apresentacao2026.tsx` (610→~4 arquivos) | M (2h) | Extrair: `useApresentacaoData.ts` (hook), `SlideRenderer.tsx` (UI), `ApresentacaoControls.tsx` (navigation), manter `Apresentacao2026.tsx` como orchestrator <200 linhas |
| F | Split `BarChart.tsx` (364→2 arquivos) | M (1h) | Extrair `barChartConfig.ts` (theme/options factory), manter `BarChart.tsx` como componente <200 |
| G | Split `useInsights.ts` (323→3 hooks) | M (1h) | `useInsightsFetch.ts`, `useInsightsTransform.ts`, `useInsightsState.ts` |
| H | Split `DashboardAdminDetail.tsx` (316) | S (45min) | Extrair hook `useAdminDetail`, UI para sub-components |
| I | Split `AdminUsers.tsx` (310) | S (45min) | Hook + table sub-component |

### Fase 3 — Testes Unitários (1-2 sessões)

| # | Task | Escopo |
|---|------|--------|
| J | Tests para `src/lib/formatters.ts` | Funções puras de formatação |
| K | Tests para `src/lib/comercialMappers.ts` | Transforms de dados |
| L | Tests para `src/lib/filterUtils.ts` | Lógica de filtros |
| M | Tests para `src/lib/categoriaFunil.ts` | Classificação de funil |
| N | Tests para `src/lib/dateUtils.ts` | Manipulação de datas |
| O | Tests para `usePerformanceData` (aggregation logic) | Hook de agregação |

### Fase 4 — Cleanup & Polish (paralelo)

| # | Task | Esforço |
|---|------|---------|
| P | Error handling nos 8 services sem try/catch | S-M |
| Q | Substituir ~30 hex hardcoded por tokens VOUX | M |
| R | Factory `useBIRpc<T>()` | S |
| S | Tipar os 8 `any` em insights.ts + generateConsultoresReport | S |
| T | Lazy import para CrmMapa (Leaflet) | S |

---

## Decisões Tomadas

1. `sidebar.tsx` (637 linhas) — exempto, é vendor shadcn/ui
2. `supabase/types.ts` (376 linhas) — exempto, auto-gerado
3. `biRpc.ts` (348 linhas) — exempto, type-only (mas poderia ser split por domínio no futuro)
4. `DashboardBI.tsx` e `PerformanceComercial.tsx` NÃO são dead code (são importados)
5. Services sem try/catch: aceitável porque React Query faz catch, mas DEVEM adicionar contexto ao erro
6. `BiDebugOverlay.tsx` hex inline: menor prioridade (é debug overlay, não UI de produção)

---

## Estado do Projeto (snapshot)

```
Branch: perf/bi-quick-wins (ahead of main by ~20 commits)
Uncommitted changes:
  M src/components/layout/AppSidebar.tsx
  M src/index.css
  ?? public/LogoCeresbranca.png

Build: passa (verificado em sessões anteriores)
Lint: passa
TypeCheck: passa
Tests: trivial (1 placeholder test)
```

---

## Referências de Memória

- [[ceres-bi-tech-debt-sessao-e]] — debt anterior (Apresentacao2026, negociosService, tipo duplicado)
- [[ceres-bi-schema-truth]] — banco real usa colunas SEM underscore
- [[ceres-bi-infra]] — origin canônico, banco self-hosted
- [[ceres-bi-dashboard-rebuild]] — indicadores reais por tab

---

## Comando para Próxima Sessão

```
/aivoux/router Executar o plano de tech debt do brownfield discovery.
Começar pela Fase 1 (quick wins): deletar páginas órfãs, remover xlsx,
adicionar Error Boundaries, fix fallback hex. Depois Fase 2 (splits).
Referência: docs/sessions/2026-06/handoff-brownfield-discovery-2026-06-26.md
```

