# Dashboard Spec — Ceres BI

> Gerado por: @bi-visualizer (Iris)
> Squad: Insight
> Data: 2026-06-22

---

## 1. BiPainel (Dashboard Principal)

### 1.1 Visão Geral

| Campo | Valor |
|-------|-------|
| **Nome** | BiPainel |
| **Propósito** | Visão geral executiva do negócio |
| **Público** | Gerentes, Diretores |
| **Atualização** | Real-time (reactive) |
| **Filtros Globais** | DateRange, Categoria, Funil, Vendedor, Cidade |

### 1.2 Layout Desktop (1440px+)

```
┌─────────────────────────────────────────────────────────────────────┐
│  FILTROS (DateRange, Categoria, Funil, Vendedor, Cidade)          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │ Total       │ │ Ganhos      │ │ Perdidos    │ │ Conversão   │  │
│  │ Negócios    │ │ R$ 1.2M     │ │ 23          │ │ 45%         │  │
│  │ 156         │ │ ↑ 12%       │ │ ↓ 5%        │ │ ↑ 3%        │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
│                                                                     │
│  ┌──────────────────────────────┐ ┌────────────────────────────┐   │
│  │                              │ │                            │   │
│  │    LINE CHART                │ │    DONUT CHART            │   │
│  │    Receita Mensal            │ │    Mix Máq. vs Peças      │   │
│  │    (12 meses)                │ │    65% / 35%              │   │
│  │                              │ │                            │   │
│  └──────────────────────────────┘ └────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                                                              │  │
│  │    BAR CHART                                                  │  │
│  │    Top 10 Produtos por Receita                               │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │ Visitados   │ │ Ações       │ │ Peças       │ │ Margem      │  │
│  │             │ │             │ │ Críticas    │ │ Média       │  │
│  │ 89          │ │ 34          │ │ 5           │ │ 23,5%       │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 Breakpoints

| Breakpoint | Largura | Layout |
|------------|---------|--------|
| Mobile | < 640px | 1 coluna, cards empilhados |
| Tablet | 640-1024px | 2 colunas |
| Desktop | 1024-1440px | Grid adaptativo |
| Wide | > 1440px | Grid completo |

### 1.4 Componentes

| Posição | Componente | Props |
|---------|------------|-------|
| Row 1 | KPICard[] | 4 cards: TotalNegocios, Ganhos, Perdidos, TaxaConversao |
| Row 2 Col 1 | LineChart | data=receitaMensal, xAxis=meses, yAxis=valor |
| Row 2 Col 2 | DonutChart | data=mixReceita, labels=[Máquinas, Peças] |
| Row 3 | BarHChart | data=top10Produtos, horizontal=true |
| Row 4 | KPICard[] | 4 cards: Visitados, Ações, PeçasCríticas, Margem |

### 1.5 Especificações Visuais

#### Cores por Tipo
```css
--bi-maquina: #3b82f6;      /* Azul */
--bi-peca: #f59e0b;         /* Amarelo */
--bi-visita: #10b981;       /* Verde */
--bi-acao: #8b5cf6;        /* Roxo */
--bi-danger: #ef4444;       /* Vermelho */
--bi-success: #22c55e;      /* Verde sucesso */
```

#### Tipografia
```css
--bi-font-kpi: var(--voux-font-heading);
--bi-font-label: var(--voux-font-label);
--bi-font-value: tabular-nums;
```

#### Espaçamento
```css
--bi-gap: 16px;
--bi-card-padding: 16px;
--bi-section-gap: 24px;
```

---

## 2. BiInteligencia (Dashboards Analíticos)

### 2.1 Seções

| Seção | Propósito | Charts |
|-------|-----------|--------|
| InteligenciaSection | Análise profunda | ComboChart, Heatmap |

### 2.2 Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                                                              │  │
│  │    COMBO CHART                                                │  │
│  │    Visitas vs Conversão (bar) + Taxa (line)                   │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                                                              │  │
│  │    BRAZIL HEATMAP                                             │  │
│  │    Distribuição geográfica de vendas                          │  │
│  │                                                              │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. BiAcoes (Gestão de Ações)

### 3.1 Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  KPI Cards: Total Ações | ROI Médio | Ações/Vendedor              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────┐ ┌────────────────────────────┐   │
│  │                              │ │                            │   │
│  │    BAR CHART                 │ │    PIE CHART               │   │
│  │    Ações por Status          │ │    Ações por Tipo          │   │
│  │                              │ │                            │   │
│  └──────────────────────────────┘ └────────────────────────────┘   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │    TABLE: Ações Recentes                                     │  │
│  │    Data | Cliente | Tipo | Vendedor | ROI                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. BiComercial

### 4.1 Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  KPI Cards: Receita Total | Ticket Médio | Conversão | Margem     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │    LINE CHART: Evolução Receita x Meta                        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────┐ ┌────────────────────────────┐   │
│  │    BAR CHART: Por Vendedor    │ │    DONUT: Mix Receita       │   │
│  └──────────────────────────────┘ └────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 5. Interações e Estados

### 5.1 Tooltips

| Componente | Tooltip Content |
|------------|-----------------|
| KPICard | Título, Valor, Fórmula, Período Anterior |
| LineChart | Mês, Valor, Variação % |
| BarChart | Label, Valor, % do Total |
| DonutChart | Label, Valor, % |
| Heatmap | Estado, Valor, Qtd |

### 5.2 Estados

| Estado | Comportamento |
|--------|---------------|
| Loading | Skeleton animado (shimmer) |
| Empty | "Sem dados para o período" + ilustração |
| Error | "Erro ao carregar dados" + botão retry |
| Partial | Filtro sem resultado + sugestões |

### 5.3 Drill-down

| Dashboard | Click | Ação |
|-----------|-------|------|
| BiPainel | Top 10 Produto | Abre BiProdutos filtrado |
| BiComercial | Vendedor | Abre detalhes do vendedor |
| BiAcoes | Linha | Abre modal com detalhes |

---

## 6. Acessibilidade

### 6.1 Checklist

- [x] Labels ARIA para todos os charts
- [x] Contraste mínimo 4.5:1
- [x] Navegação por Tab entre cards
- [x] Screen reader announces values
- [x] Skip links para main content

### 6.2 Announcements

```tsx
// KPICard
<span role="status" aria-live="polite">
  {title}: {value}, variação {trend}
</span>

// Chart
<figure role="img" aria-label={`Gráfico de ${title}: ${description}`}>
```

---

## 7. Performance

### 7.1 Lazy Loading

```tsx
<Suspense fallback={<ChartSkeleton />}>
  <LineChart data={receitaData} />
</Suspense>
```

### 7.2 Memoização

```tsx
const memoizedChart = useMemo(() => (
  <LineChart data={data} />
), [data]);
```

---

## Histórico

| Versão | Data | Alteração |
|--------|------|-----------|
| 0.1.0 | 2026-06-22 | Spec inicial |
