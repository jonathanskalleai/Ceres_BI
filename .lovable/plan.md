# Plano — Performance do BI (filtro de data server-side)

## Diagnóstico confirmado

Os dados vêm do **Postgres mirror** (Supabase self-hosted, schema `mirror`). A lentidão não é do banco — é do frontend que **baixa a tabela inteira e filtra no navegador**:

- `fetchNegociosMensais` → `crm_negocios.select("*")` + `crm_pedidos.select("*")` sem `where`.
- `fetchRegistrosComerciais` → `crm_acoes` inteira (~28k+ linhas).
- O filtro de data (mês atual, definido em `ComercialDataContext` via `currentMonthFilterRange()`) é aplicado **só depois** do download, em memória.

Resultado: toda visita ao `/bi/painel` baixa megabytes pra mostrar algumas centenas de linhas.

## Mudança principal

Empurrar o `dateRange` (e os outros filtros já existentes) pro PostgREST. O range já está disponível no contexto — basta passar adiante até a query.

### 1. Services aceitam filtros e aplicam no servidor

```ts
// negociosService.ts
fetchNegociosMensais({ from, to, funis? })
// → .gte("ngo_data_fechamento", from).lte("ngo_data_fechamento", to)
//   .in("ngo_funil", funis) quando houver
```

```ts
// registrosService.ts
fetchRegistrosComerciais({ from, to, vendedor?, cidade? })
// → .gte("aco_dth_conclusao", from).lte("aco_dth_conclusao", to)
```

`pipelineByVendedorService` recebe o mesmo `{ from, to, funis }`.

### 2. Selecionar só as colunas usadas

Trocar `select("*")` em `crm_negocios` e `crm_pedidos` pela lista explícita já tipada em `MirrorNegocio` / `MirrorPedido`. Payload cai ~3-5x.

### 3. Hooks repassam filtros e entram no queryKey

- `useComercialData(filters)` passa `filters.dateRange` ao service. `queryKey: ["registros-comerciais", from, to, …]`.
- `useNegociosBI` / `useAcoesBI` recebem `dateRange` e passam pro fetcher. Param interna de filtro client-side vira apenas refinamento (vendedor/cidade UI).
- `usePainelKPIs`: a chamada do período anterior também usa filtro server-side (mesma economia 2x).

### 4. Cache + loading não-bloqueante

- `staleTime: 5 * 60_000` padronizado nos hooks BI.
- `placeholderData: keepPreviousData` em todas as queries com filtro — ao trocar de mês/aba, a tela **não some**, só mostra "atualizando" discreto no topbar.
- `ComercialDataProvider` e `BiLayout`: skeleton fullscreen apenas no primeiro load (sem dados em cache). Refetch não apaga a tela.

### 5. Índices no mirror (rápido e seguro)

Migration `CREATE INDEX IF NOT EXISTS`:
- `mirror.crm_acoes (aco_dth_conclusao)`, `(aco_vendedor)`
- `mirror.crm_negocios (ngo_data_fechamento)`, `(ngo_funil)`
- `mirror.crm_pedidos (ngo_numero)`

## Arquivos afetados

```text
src/services/negociosService.ts
src/services/registrosService.ts
src/services/pipelineByVendedorService.ts
src/hooks/useComercialData.ts
src/hooks/bi/useNegociosBI.ts
src/hooks/bi/useAcoesBI.ts
src/hooks/bi/usePainelKPIs.ts
src/contexts/ComercialDataContext.tsx       (loading não-bloqueante)
src/components/bi/BiLayout.tsx              (idem)
supabase/migrations/<ts>_mirror_indexes.sql (índices)
```

## Fora do escopo

- Mudanças visuais nos cards (já em outro fluxo).
- Refatorar a edge function `query-sqlserver` (vira fallback raro).
- Sync incremental do mirror (já existe).

## Validação

1. Network: payload de `crm_negocios` no `/bi/painel` cai de MBs → < 200 KB no mês atual.
2. Tempo até KPIs aparecerem (cache frio): meta **< 3 s** (hoje 15-25 s).
3. Navegar entre abas mantém conteúdo visível.
