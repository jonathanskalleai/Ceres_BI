# Handoff — Próxima Sessão

## Bug: CRM retornando 0 dados após refactor

### Sintoma
- Tela CRM (Overview) mostra todos os KPIs zerados
- "Sem dados para este período" em todos os gráficos
- Screenshot: todos os cards com valor 0

### Causa provável
O refactor adicionou filtro server-side `from/to` no `ComercialDataContext.tsx` (linha 83):
```ts
{ from: filters.dateRange?.from, to: filters.dateRange?.to }
```

Isso envia `from` e `to` para `registrosService.ts` que aplica:
```ts
q = q.gte("aco_dth_conclusao", options.from);
q = q.lte("aco_dth_conclusao", `${options.to}T23:59:59.999`);
```

**Hipóteses a investigar:**
1. A coluna `aco_dth_conclusao` no mirror pode estar NULL para muitos registros (o filtro exclui NULLs)
2. O formato da data na coluna pode ser timestamp com timezone diferente (BRT vs UTC)
3. O `currentMonthFilterRange()` gera range do mês corrente — se não há registros neste mês, fica vazio
4. A coluna pode ter nome diferente no schema mirror (verificar se é `aco_dth_conclusao` mesmo)

### Como investigar
```sql
-- No Supabase SQL Editor, verificar dados do mês corrente:
SELECT COUNT(*) FROM mirror.crm_acoes 
WHERE aco_dth_conclusao >= '2025-01-01' 
  AND aco_dth_conclusao <= '2025-01-31T23:59:59.999';

-- Verificar se há dados sem data:
SELECT COUNT(*) FROM mirror.crm_acoes WHERE aco_dth_conclusao IS NULL;

-- Verificar range real dos dados:
SELECT MIN(aco_dth_conclusao), MAX(aco_dth_conclusao) FROM mirror.crm_acoes;
```

### Fix rápido (se necessário antes de investigar)
Remover o filtro server-side temporariamente em `ComercialDataContext.tsx` linha 80-84:
```ts
// Voltar para sem filtro de data (como era antes do refactor):
const { data, allData, error, lastUpdated } = useComercialData(
  filters.categoria || undefined,
  filters.funil || undefined,
  // { from: filters.dateRange?.from, to: filters.dateRange?.to },  // TEMPORARIAMENTE REMOVIDO
);
```

### Contexto do refactor (commit 841733d)
- **O que foi feito:** Performance + split monoliths + remove legacy fallbacks
- **O que quebrou:** Filtro from/to server-side no CRM (provavelmente incompatibilidade de dados)
- **O que NÃO quebrou:** BI section (usa hooks separados com seus próprios filtros)

### Arquivos relevantes
- `src/contexts/ComercialDataContext.tsx` — onde o filtro é aplicado
- `src/services/registrosService.ts` — onde o `.gte`/`.lte` é montado
- `src/hooks/useComercialData.ts` — hook que recebe options

### Tech debt pendente (não relacionado ao bug)
- sqlServerApi.ts mantido — views sem mirror (TecnicoTempo, Agenda, etc.)
- 3 monolitos pré-existentes: Apresentacao2026 (610), DashboardMapa (572), DashboardNegociosMensais (531)
- Chunk 2.1MB no build — code-splitting futuro
- 135 lint errors pré-existentes
