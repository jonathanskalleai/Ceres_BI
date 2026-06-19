## Mudanças solicitadas

### 1. Botão "Atualizar" (topbar CRM)
Está conectado sim — chama `queryClient.invalidateQueries(['registros-comerciais', 'pipeline-by-vendedor'])` em `ComercialDataContext.handleSync`, o que força o React Query a refazer fetch no Supabase via `useComercialData`. Não é código antigo, está funcional. Vou apenas confirmar isso na resposta (sem mudança de código).

### 2. Excluir tela "Regiões" do Comercial CRM
- Remover rota `regioes` em `src/App.tsx` e o import de `CrmRegioes`.
- Remover item `crm.regioes` do menu em `src/components/layout/AppSidebar.tsx`.
- Apagar `src/pages/crm/CrmRegioes.tsx`.
- (Mantém `DashboardRegioes` por enquanto, caso reaproveitemos — ou apago também se preferir.)

### 3. Delay nos cards do Painel (BI)
Investigar `src/pages/bi/BiPainel.tsx` e remover `lazy()` / `Suspense` em cascata que faz os cards aparecerem em ondas. Provavelmente cada seção é `lazy` separado — vou consolidar para renderizarem juntos (ou ao menos os KPIs do topo virem síncronos).

### 4. Nomes cortados nos gráficos de barras horizontais
Em "Motivos de Perda" e "Velocidade do Funil" (e similares) o label do eixo Y é truncado. Ajustar `labelW` / margin esquerda dos componentes ECharts em `src/components/bi/charts/` para acomodar labels mais longos (ex.: 180–200px) e/ou habilitar `axisLabel.width` com quebra.

### 5. Cores de barras mais fortes no modo light
Em `src/lib/chartColors.ts` / `chartTheme.ts` aumentar saturação/escurecer a paleta usada no tema light (as barras champagne/coral atuais ficam apagadas em fundo claro).

### 6. Filtros duplicados na tela "Ações" (BI)
Na tela `/bi/acoes` aparecem duas linhas de filtros: a do topbar global (`BiTopbarPortal`) e uma interna da `AcoesSection`. Remover a barra de filtros interna da `AcoesSection`, deixando apenas a do topbar (que já tem Data, Categoria, Funil, Vendedor, Cidade).

### 7. Filtro de data padrão = mês atual (todas as telas)
- Em `src/contexts/NegociosFilterContext.tsx`: inicializar `dateRange` com `{ from: startOfMonth(now), to: endOfMonth(now) }` em vez de `undefined`.
- Em `src/contexts/ComercialDataContext.tsx` (`emptyFilters`): inicializar `dateRange` com o mês atual.
- Ajustar `DateRangePicker` para mostrar "Mês atual" quando o range corresponde ao mês corrente (label amigável), mantendo opção "Todas as datas".

### Arquivos a alterar
- `src/App.tsx`
- `src/components/layout/AppSidebar.tsx`
- `src/pages/crm/CrmRegioes.tsx` (delete)
- `src/pages/bi/BiPainel.tsx`
- `src/components/bi/sections/AcoesSection.tsx`
- `src/components/bi/charts/*` (margens/labelW)
- `src/lib/chartColors.ts` ou `chartTheme.ts` (cores light)
- `src/contexts/NegociosFilterContext.tsx`
- `src/contexts/ComercialDataContext.tsx`
- `src/components/ui/date-range-picker.tsx` (label "Mês atual")

### Pergunta antes de implementar
Confirmar: **manter** o botão "Atualizar" como está (só esclareço que funciona) ou querer redesign/feedback visual diferente?
