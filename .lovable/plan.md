## Objetivo

Refinar a parte visual de TODAS as telas (BI + CRM) com foco em **modo light**, **organização de componentes** e **responsividade**, mantendo o design system editorial (champagne + serif Instrument + mono) já estabelecido na Fase 1.

Sem mexer em lógica, hooks, queries ou estrutura de dados — só camada visual/presentation.

---

## Diagnóstico atual (com base no código + relatos)

**Modo light — problemas estruturais:**
1. Muitos componentes ainda usam `var(--voux-card-from/to)` com gradiente escuro hardcoded → no light fica "lavado" e sem contraste.
2. KPICard, ChartCard e cards de seção usam `boxShadow: var(--voux-card-shadow)` muito sutil → no light somem visualmente.
3. Tooltips, badges de status e bordas com `rgba` fixos pensados para fundo escuro → no light viram fantasmas.
4. Topbar usa `var(--voux-tooltip-bg)` translúcido → no light fica esbranquiçada sem hierarquia.
5. Cards de dashboard administrativo, consultores e críticos usam `shadow-sm` shadcn padrão (que no light é quase invisível) e `border-0`.
6. Gráficos (ECharts) recebem cores via `useChartTheme` — precisa validar paleta light.

**Organização de componentes:**
1. `DashboardBIReal` empilha header + filtros + tabs com paddings inconsistentes (`p-8` aqui, `p-6` no admin, `p-4` em outros).
2. KPIs em grid fixo `grid-cols-4` (quebra <1280px).
3. Cards "por usuário" no Admin têm densidade desigual entre seções.
4. Topbar do AppShell + Topbar interno de páginas (BiTopbarPortal/CrmTopbarPortal) competem por espaço.
5. Filtros (DateRange, Selects, Badge sync) ficam apertados no header em larguras médias.

**Responsividade:**
1. Sidebar 252px fixo sem mobile drawer.
2. Sem breakpoints `sm/md/lg` em grids de KPI e charts.
3. Tabs do BI (`flex flex-wrap`) funciona mas overflow visual feio.
4. Topbar `px-10 py-5` sem reduzir em telas pequenas.

---

## Plano de execução

### Fase 2 — Refino do modo light + tokens de superfície (PRIMEIRO)
**Por que primeiro:** sem isso, qualquer ajuste por tela vai parecer ruim no light.

1. **Repensar tokens de card no light** em `src/index.css`:
   - `--voux-card-from` → branco puro `#ffffff`
   - `--voux-card-to` → branco quente `#fdfbf6` (delta sutil, não gradiente óbvio)
   - `--voux-card-border` → `hsl(36 18% 88%)` (mais visível que hoje)
   - `--voux-card-shadow` → 2 camadas: `0 1px 2px rgba(40,30,15,.04), 0 8px 24px -8px rgba(40,30,15,.08)` (depth real no light)
   - `--voux-grid-line` no light → `rgba(82,74,62,0.08)` (gráficos legíveis)
   - Tooltips no light → fundo `#1a1714` claro-invertido (alto contraste), texto champagne-200

2. **Hierarquia de superfícies (3 níveis):**
   - `--surface-base` (background da página)
   - `--surface-raised` (card)
   - `--surface-overlay` (popover/modal)
   Hoje só temos `card` — adiciona `--surface-base` e `--surface-overlay`.

3. **Refinar topbar AppShell:**
   - Light: `background: rgba(255,253,247,0.85)` + `border-bottom` mais sólido
   - Dark: mantém o blur atual
   - Reduzir padding em `<lg` (`px-4 sm:px-6 lg:px-10`)

4. **KPICard:**
   - Trocar gradiente por `bg-[var(--surface-raised)]` puro
   - Sombra/borda derivadas dos tokens novos
   - Ícone com background pill sutil (acento champagne em ambos os modos)
   - Tamanho de valor responsivo: `text-2xl md:text-3xl`

5. **ChartCard:**
   - Mesmo tratamento de superfície
   - Garantir título com `text-voux-text-heading` e subtítulo `text-voux-text-muted`
   - Grid lines e eixos usam `--voux-grid-line` (já existe, só validar no useChartTheme)

### Fase 3 — Responsividade do shell
1. Sidebar: `Sheet` mobile (`<lg`), mini-collapse (56px) em `lg-xl`, full em `xl+`.
2. Topbar responsivo (paddings + título que encurta).
3. `AppShell` usa `min-h-dvh` e `min-w-0` nos containers internos.
4. Grids de KPI globais: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`.
5. Filtros do header viram drawer/sheet em mobile.

### Fase 4 — Refino por tela (uma a uma, com checklist)
Para cada tela aplico o mesmo checklist e valido em light + dark + mobile:

**Ordem proposta (das mais visíveis para as menos):**
1. `/bi/painel` — vitrine
2. `/bi/comercial` — mais usada
3. `/crm/overview`
4. `/crm/consultores` (+ detail)
5. `/crm/registros`
6. `/crm/administrativo`
7. `/crm/criticos`
8. `/crm/insights` / `/crm/negocios` / `/crm/mapa` / `/crm/regioes`
9. `/bi/pedidos`, `/bi/produtos`, `/bi/servicos`, `/bi/operacional`, `/bi/admin`, `/bi/acoes`
10. `/tools/*` e `/admin/*`

**Checklist por tela:**
- [ ] Remove cores hardcoded (`text-white`, `bg-[#...]`, `border-0 shadow-sm`)
- [ ] Aplica tokens semânticos novos
- [ ] Espaçamentos padronizados (page padding `p-4 md:p-6 lg:p-8`)
- [ ] Hierarquia tipográfica (eyebrow mono / título serif / corpo sans)
- [ ] Grids responsivos
- [ ] Estados loading/empty/error consistentes
- [ ] Validação visual light + dark + 375px/768px/1280px/1440px

---

## Fora de escopo
- Lógica de negócio, queries, hooks de dados
- Troca de fontes
- Mudança de rotas ou estrutura de páginas
- Refactor de componentes para outros padrões além do necessário p/ visual

---

## Decisões que preciso de você

1. **Posso começar pela Fase 2 (tokens light + cards) e validar com você o `/bi/painel` antes de seguir?** (recomendo — é o mais barato pra alinhar visual)
2. **Sidebar em mobile:** drawer (Sheet) tradicional, ou esconde por padrão e mostra com botão flutuante?
3. **Densidade preferida:** confortável (mais respiro, fonte 14px) ou compacta (mais info por tela, fonte 13px)? Hoje está num meio termo inconsistente.
