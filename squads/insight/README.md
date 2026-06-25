# AIVOUX Squad — Insight
## Ceres Business Intelligence

**Versão:** 0.1.0
**Domínio:** Ceres BI (Agro — Máquinas, Peças, Visitas, Ações)
**Modelo:** Opus (todos os agentes)

---

## Overview

Squad especializada em Business Intelligence para o Ceres BI.
Foco em métricas de agro, visualização de dados e validação de KPIs.

## Arquitetura

```
@bi-strategist (Nora)     → Define QUE métricas mostrar
@bi-visualizer (Iris)     → Define COMO visualizar
@bi-validator (Quinn)      → Valida dados e queries
```

## Comandos

```bash
*define-kpis        # Definir KPIs do domínio
*analyze-funnel     # Analisar funil de vendas
*design-chart       # Escolher tipo de chart
*validate-query     # Validar SQL/hook de KPI
*smoke-dashboard    # Teste básico do dashboard
```

## Estrutura

```
squads/insight/
├── agents/
│   ├── bi-strategist.yaml
│   ├── bi-visualizer.yaml
│   └── bi-validator.yaml
├── tasks/
│   ├── define-kpis.yaml
│   ├── design-dashboard.yaml
│   └── validate-metrics.yaml
└── docs/
    ├── kpis-agro.md
    └── dashboard-spec.md
```

## KPIs do Domínio Ceres Agro

| Categoria | KPI | Tipo |
|-----------|-----|------|
| Máquinas | Receita Máquinas | Monetary |
| | Margem Média | Percentage |
| | Ticket Médio | Monetary |
| Peças | Receita Peças | Monetary |
| | Giro de Estoque | Ratio |
| | Peças Críticas | Count |
| Visitas | Total Visitas | Count |
| | Taxa Conversão | Percentage |
| | Visitantes Únicos | Count |
| Ações | Ações Realizadas | Count |
| | ROI Ações | Percentage |
| | Ações por Vendedor | Count |

## Pages BI Atuais

- BiPainel (dashboard principal)
- BiInteligencia
- BiAcoes
- BiComercial
- BiOperacional
- BiPedidos
- BiProdutos
- BiServicos
- BiAdmin

## Tech Stack

- React + TypeScript
- Shadcn/UI
- Charts: BarChart, LineChart, PieChart, ComboChart, BrazilHeatmap
- Hooks: usePainelKPIs, usePedidosKPIs, useClientesKPIs, useServicosKPIs, useCrossKPIs
