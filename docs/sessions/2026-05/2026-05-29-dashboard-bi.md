# Sessão 2026-05-29 — Dashboard BI Completo

## Contexto do Projeto

**Projeto:** Ceres BI — Dashboard comercial para Ceres Equipamentos  
**Stack:** React + TypeScript + Vite + Tailwind + shadcn/ui + Recharts + TanStack Query  
**Banco:** SQL Server (29 views) acessado via Supabase edge function `query-sqlserver`  
**Padrão de acesso:** `querySqlServer({ view, columns, limit })` via `@/services/sqlServerApi.ts`

---

## O que foi feito nesta sessão

### 1. Fix de imports quebrados (BUG_FIX)

Build estava falhando com erro de named vs default export.

**Arquivos corrigidos:**
- `src/pages/Dashboard.tsx` — mudado `import { DashboardBI }` → `import DashboardBI` (default)
- `src/pages/DashboardBI.tsx` — removidos imports inexistentes (`DashboardInsights`, `DashboardBIComponent`) e não usados (`Filter`, `Search`, `Eye`)
- `src/components/dashboard/DashboardBI.tsx` — adicionados `useState` e `Database` que faltavam; removido `useToast` morto

### 2. Dashboard BI Completo (FEATURE COMPLEX)

Implementado sistema BI completo com dados reais do SQL Server. A aba **BI > Dashboard BI** no menu lateral agora carrega `DashboardBIReal.tsx`.

**Arquitetura:**  
`service (fetchAllPages + map)` → `hook (useQuery + aggregateX em useMemo)` → `component (Recharts)`  
Cada section usa `React.lazy` + `enabled: activeTab === 'x'` para não buscar dados em tabs inativas.

---

## Arquivos criados (23 novos)

### Infraestrutura compartilhada
| Arquivo | Descrição |
|---------|-----------|
| `src/lib/chartColors.ts` | Paleta única `CHART_COLORS[6]` — resolve DRY de 5 arquivos |
| `src/lib/dateUtils.ts` | `yearMonth(dt)` e `formatBRL(v)` compartilhados |
| `src/components/bi/KPICard.tsx` | Card KPI genérico (title, value, icon, hint, loading) |
| `src/components/bi/ChartCard.tsx` | Wrapper Card + ResponsiveContainer para Recharts |
| `src/components/bi/biUtils.ts` | `findCol()` + `groupByCol()` — heurísticas para views com colunas desconhecidas |

### Container principal
| Arquivo | Descrição |
|---------|-----------|
| `src/pages/DashboardBIReal.tsx` | 7 tabs com lazy: Comercial, Pedidos, Produtos, Serviços, Operacional, Admin, Explorer |

### Sections (6 domínios)
| Arquivo | Views consumidas | Charts |
|---------|-----------------|--------|
| `src/components/bi/sections/ComercialSection.tsx` | VW_Ceres_CRM_Acoes, VW_Ceres_CRM_Negocios | Funil de vendas, Pie ações por tipo, Line evolução mensal, Bar pipeline por consultor, Bar negócios por UF |
| `src/components/bi/sections/PedidosSection.tsx` | VW_Ceres_CRM_Pedidos | Pie por situação, Bar por vendedor, Bar top cidades |
| `src/components/bi/sections/ProdutosSection.tsx` | VW_Ceres_Produtos, ProdutosGrupo, ProdutosMarca, ProdutosModelo | Bar por grupo/marca + tabela amostra |
| `src/components/bi/sections/ServicosSection.tsx` | VW_Ceres_OrdemServico, VW_Ceres_Ocorrencias | Pie por status, Bar por técnico, Line evolução |
| `src/components/bi/sections/OperacionalSection.tsx` | VW_Ceres_Agenda, VW_Ceres_TecnicoTempo, VW_Ceres_CRM_ClienteParqueMaquinas | Bar agenda por tipo, Bar horas por técnico, Bar parque máquinas |
| `src/components/bi/sections/AdminSection.tsx` | VW_Ceres_Empresas, VW_Ceres_Usuario, VW_Ceres_UsuarioXEmpresa | KPIs count, Bar empresas por UF |

### Services e Hooks BI
```
src/services/bi/
  pedidosBIService.ts    — colunas conhecidas: NGO_Numero, PDO_SituacaoPedido, PDO_VlrPedido, PDO_CidadeUFEntrega, PDO_Vendedor, PDO_VlrRecursoProprio
  produtosBIService.ts   — discovery limit:1 (colunas descobertas em runtime)
  servicosBIService.ts   — discovery limit:1
  operacionalBIService.ts — discovery limit:1
  adminBIService.ts      — discovery limit:1

src/hooks/bi/
  usePedidosData.ts       — aggregatePedidos() + useQuery enabled
  useProdutosData.ts
  useServicosData.ts
  useOperacionalData.ts
  useAdminData.ts
  usePedidosData.test.ts  — 3 testes unitarios (vitest)
```

### Arquivo modificado
- `src/pages/Dashboard.tsx` — render `<DashboardBIReal />` para `currentView === "dashboard-bi"`

---

## Colunas SQL Server conhecidas (verificadas em código)

| View | Colunas reais |
|------|--------------|
| VW_Ceres_CRM_Acoes | `EMP_Cidade, CLI_Nome, ACO_TipoContato, ACO_TipoAcao, ACO_Vendedor, ACO_AtividadeExecutada, ACO_DthConclusao, ACO_Lat, ACO_Lon` |
| VW_Ceres_CRM_Negocios | `EMP_Cidade, EMP_UF, NGO_Numero, NGO_VlrTotalNegociado, NGO_Etapa, NGO_Conclusao, NGO_MotivoGanho, NGO_DataCadastro, CLI_Nome, CLI_Cidade, NGO_Vendedores, PRD_CondicaoProduto, USA_Valor, NGO_ObsNegocio` |
| VW_Ceres_CRM_Pedidos | `NGO_Numero, PDO_SituacaoPedido, PDO_VlrPedido, PDO_ObsPedido, PDO_CidadeUFEntrega, PDO_Vendedor, PDO_VlrRecursoProprio` |
| VW_Ceres_Usuario | `USR_CodUsuario, USR_nomeUsuario, USR_idUsuario` |

**Colunas descobertas em runtime (via `limit:1`):** Produtos, Serviços, Operacional, Admin — as sections usam `findCol()` heurístico para localizar colunas por padrão de nome.

---

## Estado atual do build

```
✓ npm run build — 3.16s, 0 erros, code-splitting OK
✓ npm test      — 3/3 testes passando (vitest)
✓ TypeScript    — 0 erros (tsc --noEmit)
✓ Lint          — 0 erros nos 23 arquivos BI novos
```

Aviso existente (não bloqueante): chunk `index.js` com 1.84MB — preexistente, candidato a code splitting adicional.

---

## Pendências e próximos passos sugeridos

### Imediato
- [ ] **Push/PR** — `@devops` ainda não fez push (não é repositório git ainda, apenas local)
- [ ] **Testar em runtime** — validar que as sections com discovery (`limit:1`) exibem dados reais corretamente. A Tab "Explorer" pode ser usada para verificar colunas de cada view antes de codificar.

### Melhorias de curto prazo
- [ ] **Seção Comercial: enabled** — `useComercialData` e `useNegociosData` não suportam `enabled`, então buscam dados no mount independente da tab ativa. Tradeoff documentado em código — se quiser otimizar, adicionar `enabled` a esses dois hooks.
- [ ] **Views ainda sem charts ricos:** VW_Ceres_CRM_CarteiraClientes, VW_Ceres_CRM_ClienteContatos, VW_Ceres_CRM_FunilEtapa, VW_Ceres_CRM_PedidosItem, VW_Ceres_CRM_PedidosUsado, VW_Ceres_CRM_EstoqueVirtual, tags (TAGXACAO etc.) — colunas ainda não verificadas em runtime.
- [ ] **Joins entre views** — Arquitetura definiu os principais joins possíveis: `Pedidos.NGO_Numero ↔ Negocios.NGO_Numero`, `NGO_Vendedores ↔ Usuario.USR_CodUsuario`. Implementar análise cruzada.
- [ ] **`insightsService.ts` (`/api/insights/*`)** — chama endpoints que não estão proxiados no Vite. O sistema de insights por agentes (aba legada `DashboardBI.tsx`) pode retornar 404 em dev. Avaliar se é necessário configurar proxy ou desativar.

### Longo prazo
- [ ] **Tags (VW_Ceres_CRM_TAGX*)** — análise "Top Tags por Negócio/Ação" após discovery de colunas
- [ ] **Code splitting do chunk principal** — 1.84MB pode ser dividido com `manualChunks` no vite.config.ts
- [ ] **Testes E2E** — Playwright já configurado (`playwright.config.ts`), adicionar cenários BI

---

## Convenções estabelecidas nesta sessão

- **Padrão de acesso SQL Server:** sempre `fetchAllPages(view, COLUMNS)` para dados completos; `querySqlServer({ view, limit: 1 })` para discovery de colunas
- **Views com schema desconhecido:** usar `biUtils.findCol()` para localizar coluna por sufixo de nome (ex: `findCol(keys, 'Status', 'Situacao')`)
- **Formatação monetária:** `formatBRL(v)` de `@/lib/dateUtils.ts`
- **Paleta de charts:** sempre `CHART_COLORS` de `@/lib/chartColors.ts`
- **Nunca tocar `DashboardBI.tsx` legado** — é o sistema de insights por agentes IA, separado do novo `DashboardBIReal.tsx`

---

## Arquivos chave para contexto rápido

Para entender o projeto rapidamente numa nova sessão, ler nesta ordem:
1. `src/services/sqlServerApi.ts` — como acessar o SQL Server
2. `src/pages/DashboardBIReal.tsx` — entry point do BI novo
3. `src/components/bi/sections/ComercialSection.tsx` — section mais completa como referência
4. `src/hooks/bi/usePedidosData.ts` — padrão de hook + aggregate
5. `src/services/bi/pedidosBIService.ts` — padrão de service com colunas tipadas
