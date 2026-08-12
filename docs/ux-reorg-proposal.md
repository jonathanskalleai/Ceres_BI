# UX Research + Proposta de Arquitetura de Informacao

**Projeto:** Ceres BI / CRM — Reorganizacao
**Data:** 2026-06-19
**Autora:** Uma, UX/UI Designer — AIVOUX

---

## 1. Mapa do Territorio Atual

### 1.1 Rotas e Componentes

```
/crm/overview        → CrmOverview     → DashboardOverview     [useComercialData]
  /crm/consultores   → CrmConsultores  → DashboardConsultores [useComercialData]
  /crm/consultores/:vendedor → CrmConsultorDetail → DashboardConsultorDetail
  /crm/registros    → CrmRegistros    → DashboardRegistros   [useComercialData]
  /crm/criticos     → CrmCriticos     → DashboardClientesCriticos [useComercialData]
  /crm/mapa         → CrmMapa         → DashboardMapa         [useComercialData]
  /crm/insights     → CrmInsights     → DashboardInsights     [useComercialData]
  /crm/negocios     → CrmNegocios     → DashboardNegociosMensais [useComercialData]
  /crm/administrativo → CrmAdministrativo → DashboardAdministrativo [useComercialData]

/bi/painel           → BiPainel        → KPI cards             [usePainelKPIs × 6 hooks]
  /bi/comercial      → BiComercial     → ComercialSection      [useNegociosBI]
  /bi/acoes          → BiAcoes         → AcoesSection          [useAcoesBI]
  /bi/pedidos        → BiPedidos       → PedidosSection        [usePedidosData]
  /bi/produtos       → BiProdutos      → ProdutosSection       [useProdutosData]
  /bi/servicos       → BiServicos      → ServicosSection       [useServicosData]
  /bi/operacional    → BiOperacional   → OperacionalSection    [useOperacionalData]
  /bi/admin          → BiAdmin         → —                     [useAdminData]
  /bi/inteligencia  → BiInteligencia  → —                     [useInteligenciaBI]

/tools/explorer      → ToolsExplorer    → DashboardViewExplorer
  /tools/performance → ToolsPerformance → PerformanceComercial
```

---

## 2. Analise de Sobreposicoes

### 2.1 Mapa de Convergencia: O que cada tela mostra

| Metrica             | DashboardOverview (CRM)  | BiPainel (BI)           | Divergencia? | Origem do gap |
|---------------------|--------------------------|-------------------------|--------------|---------------|
| Total Registros/Acoes | COUNT registros           | COUNT acoes (useAcoesBI) | **SIM**     | DateRange padrao diferente (mes atual vs ano atual) |
| Visitas              | filtro `tipoContato` includes "visita" | `useAcoesBI.visitas` | **SIM**     | Idem acima |
| Pipeline Total       | SUM negocioValor (registros) | `useNegociosBI.pipelineAberto` | **SIM** | Fontes diferentes: mirror.crm_negocios vs registros_comerciais |
| Total Consultores    | Set de vendedores nos registros | `useAcoesBI.consultores` | MENOR | Mesmo gap de data |
| Evolucao Mensal      | `data.evolucaoGlobal` (tipos: acoes/visitas) | Nao tem | — | BI Painel nao tem evolucao |
| Tipos de Acao        | `data.tiposAcao` (registros) | `useAcoesBI.porTipoAcao` | MENOR | Mesmo gap de data |
| Top Consultores       | `data.vendedores` ordenado por acoes | Ranking `useNegociosBI` por valor ganho | DIFERENTE | Duas dimensoes: volume vs receita |

### 2.2 Causa Raiz da Divergencia 230 vs 128

```
CRM Overview  (DashboardOverview)
  source:  fetchRegistrosComerciais()  [mirror.registros_comerciais]
  filtro:  ComercialDataContext.filters.dateRange
  default: MÊS ATUAL (startOfMonth ~ endOfMonth)

BI Painel  (BiPainel)
  source:  useAcoesBI() → useComercialData()  [mesma tabela! mirror.registros_comerciais]
  filtro:  useNegociosFilter().dateRange
  default: ANO ATUAL (ou livre se NaoFilterContext.provider inicia vazio)
```

**Conclusao:** BI Painel provavelmente filtra por ANO ATUAL por padrao, enquantro CRM Overview filtra por MES ATUAL. Logo, "230 acoes no mes" do BI Painel sao na verdade acoes no ANO, e "128 visitas" no CRM Overview sao visitas no MES.

**Nao e um bug de contagem** — sao duas janelas temporais diferentes para o mesmo dado.

### 2.3 Duplicacao de Hooks para o Mesmo Dado

```
useAcoesBI  →  chamado por:
  ├── BiPainel (via usePainelKPIs)
  ├── AcoesSection (BiAcoes)
  └── (ambos consomem useComercialData → fetchRegistrosComerciais)
```

`DashboardOverview` e `DashboardInsights` tambem consomem `useComercialData` — mas **sem passar pelo mesmo dateRange**. O `ComercialDataContext` tem seu proprio estado de filtros (`filters.dateRange`), completamente desconectado do `NegociosFilterContext` do BI.

---

## 3. Arquitetura de Informacao Proposta

### 3.1 Posicionamento Estrategico

Mantem-se **UM unico sistema de BI** (rotas `/bi/*`), com `bi/painel` como pagina inicial (redirect do `/`).

A separacao conceitual interna e por **area de responsabilidade**, nao por "CRM vs BI":

```
/bi/painel           ← Dashboard Executivo (pagina inicial)
/bi/comercial        ← Analitico de Vendas (pipeline, conversao, funil)
/bi/acoes            ← Registro de Acoes (atividades, visitas, consultores)
/bi/pedidos          ← Pedidos e Faturamento
/bi/produtos         ← Analitico de Produtos
/bi/servicos         ← Gestao de Servicos / Pos-Venda
/bi/operacional      ← Operacional (agenda, eventos, OS)
/bi/insights        ← Inteligencia (analise de sentimiento, texto)
/bi/admin            ← Administracao

/tools/explorer       ← Explorador de Dados (usuarios avancados)
/tools/performance   ← Metas e Planejamento
```

**CRM Overview, CRM Insights, CRM Consultores, etc. sao removidos** — suas funcionalidades migram para as secoes acima.

### 3.2 Renomeacoes Propostas

| Rota Atual   | Rota Proposta   | Motivo                                           |
|-------------|----------------|--------------------------------------------------|
| `/crm/overview` | removido → `/bi/painel` | Funcionalidade mesclada no painel executivo |
| `/crm/insights`  | `/bi/insights`   | Mantem insight, desloca para secao BI |
| `/crm/consultores` | `/bi/acoes` + `/bi/comercial` | Divide em metricas por vendedor |
| `/crm/registros` | `/bi/acoes` (expandido) | Tabela de registros e acoes no mesmo lugar |
| `/crm/negocios`  | `/bi/comercial`  | Funcionalidade ja existe em BiComercial |
| `/crm/criticos`  | `/bi/comercial` (aba ou sub-rota) | Alerta de clientes criticos integra em comercial |
| `/bi/painel`     | `/bi/painel` (mantem) | Painel executivo — pagina inicial |

### 3.3 Nova Hierarquia de Navegacao

```
Sidebar/Topbar do sistema BI:

[Logo Ceres]
─────────────────
DASHBOARD
  Painel Executivo   → /bi/painel              (pagina inicial)
─────────────────
ANALITICOS
  Vendas            → /bi/comercial
  Pedidos           → /bi/pedidos
  Produtos          → /bi/produtos
  Servicos          → /bi/servicos
  Operacional       → /bi/operacional
─────────────────
ATIVIDADES
  Acoes e Visitas   → /bi/acoes
  Inteligencia      → /bi/insights
─────────────────
ADMINISTRACAO
  Admin             → /bi/admin
─────────────────
FERRAMENTAS
  Explorer          → /tools/explorer
  Performance       → /tools/performance
```

---

## 4. Divergencias de Dados: Plano de Unificacao

### 4.1 Fontes de Dados — Estado Atual vs Objetivo

```
ATUAL (CONFUSO):
  ┌──────────────────────────────────────────────┐
  │  ComercialDataContext (CRM)                  │
  │  → useComercialData → fetchRegistrosComerciais │
  │  → dateRange: filters.dateRange (MES padrao)  │
  └──────────────────────────────────────────────┘
                        vs.
  ┌──────────────────────────────────────────────┐
  │  NegociosFilterContext (BI)                   │
  │  → useNegociosBI → fetchNegociosBI            │
  │  → useAcoesBI → useComercialData              │
  │  → dateRange: dateRange (ANO padrao?)          │
  └──────────────────────────────────────────────┘

OBJETIVO (UNIFICADO):
  ┌──────────────────────────────────────────────┐
  │  TODAS as telas consomem                      │
  │  NegociosFilterContext (unico)                 │
  │  → filtro global: Categoria + Funil + DateRange │
  │  → fornecido pelo BiLayout em todas as rotas   │
  └──────────────────────────────────────────────┘
```

### 4.2 Metricas: De onde vem cada uma

| Metrica no Painel | Query / Fonte | Tabela SQL Server | Nota de Calculo |
|-------------------|---------------|-------------------|-----------------|
| Total Acoes (Painel) | `useAcoesBI.kpis.totalAcoes` | `mirror.registros_comerciais` | COUNT registros no periodo |
| Visitas | `useAcoesBI.kpis.visitas` | `mirror.registros_comerciais` | COUNT WHERE tipoContato ILIKE '%visita%' |
| Total Negocios | `useNegociosBI.kpis.totalNegocios` | `mirror.crm_negocios` | COUNT DISTINCT NGO_Numero |
| Ganhos / Perdidos / Andamento | `useNegociosBI.kpis` | `mirror.crm_negocios` | FILTER BY NGO_Conclusao |
| Valor Ganho | `useNegociosBI.kpis.valorGanho` | `mirror.crm_negocios` | SUM NGO_VlrTotalNegociado WHERE conclu = 'ganho' |
| Pipeline Aberto | `useNegociosBI.kpis.pipelineAberto` | `mirror.crm_negocios` | SUM NGO_VlrTotalNegociado WHERE conclu = 'andamento' |
| Faturamento | `usePedidosKPIs` | `mirror.pedidos` | SUM valor WHERE status = 'aprovado' |
| Clientes Ativos | `useClientesKPIs` | `mirror.carteira` | COUNT WHERE prospect = 'N' |
| OS Abertas | `useServicosKPIs` | `mirror.os` | COUNT WHERE status = 'aberta' |

### 4.3 Padronizacao de DateRange

O maior gerador de confusao numerica e o DateRange padrao diferente entre contextos.

**Proposta:** O `NegociosFilterProvider` (em `BiLayout`) deve inicializar com um DateRange padrao consistente:

```
Opcao A — Padrao mes atual (mais util para operacao diaria):
  from: primeiro dia do mes atual
  to:   ultimo dia do mes atual

Opcao B — Padrao Ano ATUAL (mais util para gestao estrategica):
  from: 1 januario do ano atual
  to:   31 dezembro do ano atual
```

**Recomendacao:** Opcao B (ANO ATUAL) — mais compativel com o uso atual do BI Painel e da visao executiva. Comunicar ao usuario que o painel mostra "ano corrente" por padrao, e o filtro permite drill down.

### 4.4 KPI "Evolucao Mensal" no Painel

O painel atual (BiPainel.tsx) nao tem grafico de evolucao mensal — apenas cards numericos. O `DashboardOverview` tem `LineChart` de evolucao acoes/visitas por mes.

**Proposta:** Adicionar ao `bi/painel` uma secao de graficos de tendencia:
- LineChart: Evolucao de acoes e visitas (12 meses) — fonte: `useAcoesBI.porMes`
- LineChart: Evolucao de valor ganho / pipeline aberto (12 meses) — fonte: `useNegociosBI.evolucaoMensal`

---

## 5. Wireframe da Navegacao Proposta

```
┌─────────────────────────────────────────────────────────────┐
│  [≡ Ceres BI]     Categoria [All ▾]  Funil [All ▾]  [📅 Jan–Jun 2026]  [👤 User]  │
├────────────┬────────────────────────────────────────────────┤
│            │                                                 │
│ PAINEL     │  ┌──────────────────────────────────────────┐  │
│ EXECUTIVO  │  │  KPIs do Periodo                        │  │
│  ● painél  │  │  [230 Acões] [45 Visitas] [R$ 12M] ... │  │
│            │  └──────────────────────────────────────────┘  │
│ ANALITICOS │  ┌──────────────────────────────────────────┐  │
│ ○ comercial│  │  Evolucao Mensal (12 meses)             │  │
│ ○ pedidos  │  │  [Line Chart acoes + visitas]            │  │
│ ○ produtos │  └──────────────────────────────────────────┘  │
│ ○ servicos │  ┌──────────────────┐ ┌──────────────────┐  │
│ ○ operac.  │  │ Top Consultores  │ │ Distribuicao      │  │
│            │  │ [Bar Chart]      │ │ [Pie Chart]       │  │
│ ATIVIDADES │  └──────────────────┘ └──────────────────┘  │
│ ○ acoes    │                                                 │
│ ○ insights │                                                 │
│            │                                                 │
│ ADMIN      │                                                 │
│ ○ admin    │                                                 │
│            │                                                 │
│ FERRAMENTAS│                                                 │
│ ○ explorer │                                                 │
│ ○ performa.│                                                 │
└────────────┴────────────────────────────────────────────────┘
```

---

## 6. Plano de Implementacao

### Fase 1 — Unificar Contexto de Filtros
- Fazer `DashboardOverview` e `DashboardInsights` consumirem `useNegociosFilter()` (NegociosFilterContext) em vez de `ComercialDataContext`
- Garantir que o DateRange padrao do sistema seja o MES ATUAL (nao o ANO)
- Documentar em comentarios de codigo a janela temporal de cada metrica

### Fase 2 — Redirecionar Rotas CRM → BI
- `/crm/*` redireciona para `/bi/*` equivalente (redirect 301)
- Manter os componentes shared (`DashboardOverview`, `DashboardInsights`, etc.) migrados
- `ComercialDataProvider` pode ser removido ou mantido apenas para contextos que ainda precisem de `allData` (sem filtro admin)

### Fase 3 — Painel Executivo (bi/painel)
- Expandir KPIs do painel com graficos de tendencia (evolucao mensal)
- Incluir os 4 graficos principais que hoje estao em DashboardOverview
- Unificar a definicao de "Total de Acoes" e "Visitas" em uma unica secao

### Fase 4 — Navegacao
- Unificar sidebar/topbar em um unico layout (`BiLayout` como padrao)
- Renomear secoes do menu conforme hierarquia proposta
- Remover `ComercialDataProvider` da pilha de providers

### Fase 5 — Limpeza
- Remover paginas wrapper `Crm*.tsx` (thin shells sem logica)
- Migrar funcionalidade restante para secoes em `/bi/*`
- Remover `CrmTopbarPortal` e consolidar em `BiTopbarPortal`

---

## 7. Resumo: O Que Mudar e Por Que

| Decisao | Razao |
|---------|-------|
| `/bi/painel` como home | Painel executivo da visao mais completa — ano todo + todos os modulos |
| Remover `/crm/*` | Duplicacao funcional — mesmo dado, contexto de filtro diferente |
| Unificar `NegociosFilterContext` | Elimina a divergencia 230 vs 128 — uma unica fonte de verdade |
| CRM Overview vira secao dentro do painel | Graficos de evolucao e top consultores migram para `bi/painel` |
| CRM Insights vira `/bi/insights` | Deslocamento lateral, nao remoca — funcionalidade mantida |
| DateRange padrao = ANO ATUAL | Compativel com BI atual; filtro permite drill down para mes/semana |

---

*Proposta UX elaborada por Uma (AIVOUX) — 2026-06-19*
