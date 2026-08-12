# BI — Migração de gráficos (Nivo → ECharts) + Glassmorphism + Performance

**Autor:** @architect (Aria) · **Data:** 2026-05-30 · **Status:** Aprovado para @dev

## Contexto / Problema

1. As 6 seções do BI (`src/components/bi/sections/*`) usam **Nivo** (`@nivo/bar|line|pie`)
   via wrappers em `src/components/bi/nivo/*` + tema `src/lib/nivoTheme.ts`. Resultado
   visual "quadradão", só barras, sem identidade moderna.
2. O dashboard legado (`src/components/dashboard/*`) usa **recharts** → duas libs de
   gráfico coexistem.
3. **Tela branca ~1 min:** `QueryClient` criado sem config (`src/App.tsx:15`) →
   `staleTime: 0`, refetch a cada remount/troca de aba. Cada seção puxa a view inteira
   do SQL Server via Edge Function `query-sqlserver`, paginando 3000 linhas
   (`fetchAllPages`) e agregando no browser.
4. Logo cortado em algum ponto do layout (a localizar).

## Decisão de Tecnologia

**Apache ECharts** (`echarts` + `echarts-for-react`), registro modular via
`echarts/core` para tree-shaking. Substitui Nivo **somente no BI**. Recharts no
dashboard legado fica intocado nesta entrega (anti-scope-creep); migração do legado
fica como observação futura.

Rationale: ECharts entrega nativamente gradientes, área com fade, glow (shadowBlur),
linhas suaves, donut arredondado e animação — exatamente a estética pedida
(minimalista, transparência, blur, moderno). Lib única e madura.

## Arquitetura dos Componentes (#4, #7, #10)

```
src/lib/echartsCore.ts        # registra Bar/Line/Pie + components (tree-shake)
src/lib/chartTheme.ts         # paleta, gradientes, tooltip glass, baseOption  (substitui nivoTheme.ts)
src/components/bi/charts/
  BarChart.tsx                # ECharts bar — API compatível com NivoBarChart
  LineChart.tsx               # ECharts line/area
  PieChart.tsx                # ECharts donut
  index.ts                    # barrel: HorizontalBarChart, VerticalBarChart, StackedBarChart, LineChart, PieChart
```

**API pública mantida** (drop-in) para minimizar mudança nas seções:
- `HorizontalBarChart` / `VerticalBarChart` / `StackedBarChart`:
  props `{ data, keys, colors?, title?, height?, loading?, tooltipFormatter?, groupMode? }`
- `LineChart`: `{ data: {x,y}[], color?, title?, height?, loading?, tooltipFormatter? }`
- `PieChart`: `{ data, colors?, height?, loading?, valueFormatter? }`

Cada wrapper < 200 linhas. Lógica de montar `option` em funções puras no `chartTheme.ts`/
helpers (separação lógica/UI #7). Wrappers só recebem props e renderizam `<ReactECharts>`.

## Estética Glass (transparência + blur)

**Container (`ChartCard.tsx`):** vira o "vidro" —
`bg-white/5 dark:bg-white/[0.04]`, `backdrop-blur-xl`, `border border-white/10`,
`rounded-2xl`, sombra suave. Para o blur ter o que refratar, adicionar **ambiente**
no `DashboardBIReal`: gradiente/radiais suaves de fundo (blobs champagne/azul baixa
opacidade) atrás das tabs.

**ECharts (em `chartTheme.ts`):**
- Barras: `itemStyle.borderRadius` (cantos arredondados), preenchimento com
  `LinearGradient` (topo opaco → base translúcida), sem `axisLine`, `splitLine` dashed
  bem sutil, `barWidth` enxuto.
- Linha: `smooth: true`, `areaStyle` com gradiente vertical até transparente,
  `showSymbol: false`, glow via `lineStyle.shadowBlur/shadowColor`.
- Donut: `radius: ['58%','82%']`, `itemStyle.borderRadius`, `padAngle`/gap entre fatias.
- Tooltip: glass escuro (`rgba(15,23,42,.92)` + `backdrop-filter: blur`) — reaproveitar
  o estilo que já existe no nivoTheme.
- Paleta refinada (suavizar os tons puros atuais), mantendo `POSITIVE`/`NEGATIVE`
  semânticos (verde/vermelho).
- `grid` com margens automáticas para **não cortar labels** (rótulos longos de
  consultor/etapa). `containLabel: true`.

## Performance (#9)

1. **`QueryClient` com cache** (`src/App.tsx`): `staleTime: 5*60_000`,
   `gcTime: 30*60_000`, `refetchOnWindowFocus: false`, `retry: 1`. Mata o refetch a
   cada troca de aba/remount — principal causa do "branco" recorrente.
2. Manter o gating `active` por aba (lazy fetch já existe — bom). Não puxar todas as
   views de uma vez.
3. **Investigar o "branco do sistema todo"** (não só BI): @dev deve **diagnosticar
   primeiro** (timing/log) — provável await bloqueante no boot (App/auth/rota inicial)
   antes de renderizar. Não aplicar fix especulativo: medir → achar root cause → corrigir.
4. Agregação server-side da view (Edge Function) fica como melhoria futura (fora do
   escopo desta entrega; é mudança de backend/DB).

## Tasks para @dev (ordenadas)

1. `npm install echarts echarts-for-react`.
2. Criar `src/lib/echartsCore.ts` (registro modular) e `src/lib/chartTheme.ts`
   (paleta + gradientes + tooltip glass + builders de option).
3. Criar `src/components/bi/charts/{BarChart,LineChart,PieChart}.tsx` + `index.ts`
   com a API compatível acima.
4. Trocar imports nas 6 seções (`bi/sections/*`) de `nivo/*` → `charts/index`.
   Manter as chamadas (mesma API) — ajustar só onde necessário.
5. Aplicar glass no `ChartCard.tsx` + fundo ambiente no `DashboardBIReal.tsx`.
   Garantir `containLabel`/margens para não cortar labels.
6. Performance: configurar `QueryClient` em `src/App.tsx`.
7. Diagnosticar e corrigir o boot lento do app (medir antes).
8. Localizar e corrigir o **logo cortado** (grep `logo`/`img` em layout/header/sidebar;
   provável `object-fit`/overflow/altura fixa).
9. Remover Nivo: deletar `src/components/bi/nivo/`, `src/lib/nivoTheme.ts`,
   `npm uninstall @nivo/bar @nivo/core @nivo/line @nivo/pie`. Sem dead code (#2).
10. `npm run lint && npm run typecheck && npm run build` verdes antes de entregar.

## Riscos / Mitigações

- **`ResponsiveContainer` do recharts no `ChartCard`** (`src/components/bi/ChartCard.tsx:4,33`)
  espera filho recharts. ECharts não usa isso → **remover o `ResponsiveContainer`** do
  ChartCard; os wrappers ECharts já são responsivos (`<ReactECharts style={{height}}/>` +
  `resize`). Atenção a esse acoplamento ao migrar.
- Bundle do ECharts: usar registro modular (`echarts/core`) para tree-shake.
- Não tocar no dashboard legado (recharts) — escopo limitado ao BI.
