# Planejamento: Migrar CRM Pages para RPCs + Eliminar useComercialData

**Data:** 2026-06-25
**Branch:** perf/bi-quick-wins (ou criar nova branch `refactor/crm-rpc-migration`)
**Pré-requisito:** Merge PR #2 em main (smoke test visual pendente)
**Estimativa total:** 3-4 sessões

---

## Contexto

`useComercialData` é o último grande hook de agregação client-side. Ele:
- Faz 2 fetches (registros + pipeline) + agregação pesada em `aggregateComercial.ts`
- Alimenta 20+ consumidores via `ComercialDataContext`
- Retorna `DadosComerciais` com 9 campos (kpis, vendedores, regioes, evolucao, tipos, registros, listas)

RPCs comerciais já existem (`rpc_kpis_comercial`, `rpc_ranking_vendedores`, `rpc_evolucao_mensal`, `rpc_ranking_regioes`, `rpc_clientes_por_vendedor`) mas cobrem apenas ~40% da shape.

**Objetivo:** Migrar todos os consumidores para RPCs server-side e eliminar useComercialData + aggregateComercial.

---

## Gaps de RPC (o que precisa ser criado)

| RPC Nova | Para quem | O que retorna |
|----------|-----------|---------------|
| `rpc_registros_comerciais(p_from, p_to, p_vendedor?, p_cidade?, p_tipo_acao?)` | CrmRegistros, CrmInsights, CrmConsultorDetail, useClientesKPIs | Rows individuais (registros filtrados, paginados) |
| `rpc_vendedor_detail(p_vendedor, p_from, p_to)` | CrmConsultorDetail | evolucao[], topClientes[], regioes[], tiposAcao{}, negocios, conversao, crmQuality |
| `rpc_listas_filtros(p_from, p_to)` | BiTopbarPortal, CrmFiltersBar | listaVendedores[], listaCidades[] |
| Expandir `rpc_ranking_vendedores` | CrmConsultores | +negocios, +conversao, +crmQuality por vendedor |

---

## Estratégia de Migração (por ondas)

### Onda 1 — Pages que já estão quase prontas (esforço baixo)

| Page | Status atual | Ação |
|------|-------------|------|
| `CrmOverviewRpc.tsx` | ✅ Já migrada | Nenhuma — apenas usa context para filtros |
| `CrmFiltersBar.tsx` | Usa apenas filtros/actions do context | Nenhuma (permanece no context, que vira "FiltersContext" puro) |
| `CrmTopbarPortal.tsx` | Usa apenas filtros/actions | Idem |

### Onda 2 — Pages com cobertura parcial (esforço médio)

| Page | O que precisa | RPC usada |
|------|--------------|-----------|
| `PerformanceComercial.tsx` | Migrar para `rpc_kpis_comercial` + `rpc_ranking_vendedores` + `rpc_evolucao_mensal` | Existentes |
| `CrmConsultores.tsx` | Expandir `rpc_ranking_vendedores` (+negocios, +conversao, +crmQuality) | Expandir existente |
| `CrmMapa.tsx` | Já tem `rpc_ranking_regioes` — migrar direto | Existente |
| `BiTopbarPortal.tsx` | Criar `rpc_listas_filtros` para popular dropdowns | Nova (simples) |

### Onda 3 — Pages que precisam RPC nova (esforço alto)

| Page | O que precisa | RPC usada |
|------|--------------|-----------|
| `CrmRegistros.tsx` | `rpc_registros_comerciais` (retorna rows paginadas) | Nova |
| `CrmConsultorDetail.tsx` | `rpc_vendedor_detail` (tudo do vendedor) | Nova |
| `CrmCriticos.tsx` | `rpc_vendedor_detail` ou RPC específica para clientes sem contato | Nova |
| `CrmInsights.tsx` | Precisa de DadosComerciais completo — reescrever insights para consumir RPCs individuais | Composição de existentes |
| `CrmNegocios.tsx` | Já usa `rpc_negocios_bi` parcialmente? Verificar | Existente/expandir |
| `CrmAdministrativo.tsx` | Precisa de DadosComerciais completo | Composição |
| `Dashboard.tsx` | Precisa de DadosComerciais completo | Composição |

### Onda 4 — Cleanup final

| Item | Ação |
|------|------|
| `useComercialData.ts` | Deletar |
| `aggregateComercial.ts` | Deletar |
| `ComercialDataContext.tsx` | Transformar em "FiltersContext" puro (só filtros + actions, sem dados) OU deletar se todos os consumidores migraram |
| `src/services/registrosService.ts` | Deletar (substituído por RPC) |
| `src/services/pipelineByVendedorService.ts` | Deletar (substituído por RPC) |
| `sqlServerApi.ts` | Deletar quando DashboardViewExplorer for descontinuado |
| `resolveFunis` local em `ComercialSection.tsx` | Migrar para import de `@/lib/categoriaFunil.ts` |
| `biRpc.ts` split | Dividir por domínio se ultrapassar 300 linhas |

---

## Ordem de Execução por Sessão

### Sessão A — RPCs novas + Onda 2 (estimativa: 1 sessão)

1. Criar migration com RPCs: `rpc_listas_filtros`, expandir `rpc_ranking_vendedores`
2. Migrar: PerformanceComercial, CrmConsultores, CrmMapa, BiTopbarPortal
3. Aplicar migration na VPS + smoke test
4. Push

### Sessão B — RPCs pesadas + Onda 3 parte 1 (estimativa: 1 sessão)

1. Criar migration: `rpc_registros_comerciais` (com paginação), `rpc_vendedor_detail`
2. Migrar: CrmRegistros, CrmConsultorDetail, CrmCriticos
3. Aplicar + smoke test
4. Push

### Sessão C — Onda 3 parte 2 + Onda 4 (estimativa: 1-2 sessões)

1. Migrar: CrmInsights, CrmNegocios, CrmAdministrativo, Dashboard
2. Transformar ComercialDataContext em FiltersContext puro
3. Migrar useClientesKPIs para RPC
4. Deletar: useComercialData, aggregateComercial, registrosService, pipelineByVendedorService
5. Cleanup cosmético (resolveFunis, biRpc.ts split, sqlServerApi)
6. Push final

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| CrmInsights/Dashboard consomem DadosComerciais inteiro — difícil migrar incrementalmente | Criar hooks compostos que chamam múltiplas RPCs e reconstroem a shape esperada |
| `registrosRecentes` é row-level (milhares de rows) — RPC pesada | Implementar paginação server-side (LIMIT/OFFSET ou cursor) |
| ComercialDataContext usado em 20+ arquivos — blast radius do refactor | Migrar page-a-page, manter context funcional até onda 4 |
| Coluna mismatch (como aconteceu com inteligenciaBI) | Sempre verificar via execute_sql ANTES de escrever SQL |

---

## Métricas de Sucesso

- Zero chamadas a `fetchRegistrosComerciais` / `fetchPipelineByVendedor` após onda 4
- `useComercialData.ts` e `aggregateComercial.ts` deletados
- Todas as CRM pages funcionando com dados reais (smoke test por page)
- Payload de rede reduzido (RPCs retornam agregados, não rows brutas)
- Nenhum componente >300 linhas após refactor

---

## Referência rápida

- **VPS:** 178.238.235.203
- **Supabase:** https://ceressupabasebi.vouxconsultoria.com.br
- **Repo:** git@github.com:jonathanskalleai/Ceres_BI.git
- **RPCs existentes:** rpc_kpis_comercial, rpc_ranking_vendedores, rpc_evolucao_mensal, rpc_ranking_regioes, rpc_clientes_por_vendedor
- **Pattern:** migration SQL → types biRpc.ts → service biRpcService.ts → hook useXxxRpc.ts → swap na page
