
# Plano: Reestruturação Visual do Ceres BI

## Diagnóstico (o que está acontecendo hoje)

O projeto tem **dois sistemas de cor convivendo e brigando**:

1. **Tokens shadcn** (`--background`, `--foreground`, `--sidebar-*`, etc.) — definidos corretamente em `src/index.css` para light e dark, inclusive com `--sidebar-background: 40 17% 3%` (preto-tinta) no modo light.
2. **Tokens VOUX** (`--voux-card-from`, `--voux-card-to`, `--voux-text-primary`, `--voux-accent`, etc.) — definidos em `:root` como **cores claras** e sobrescritos em `.dark` para cores escuras.

**O problema central:** o `AppSidebar.tsx`, o `AppShellTopbar` e a maioria dos componentes BI usam **apenas os tokens VOUX**, ignorando os tokens shadcn `--sidebar-*`. Resultado:

- No modo dark tudo funciona (foi onde o design foi pensado).
- No modo light o sidebar fica **bege/creme** (`--voux-card-to: #faf6ef`) em vez de preto, como deveria pelo token shadcn que já existe.
- Botões ativos, hover e ícones herdam variáveis que flipam junto, perdendo contraste.
- Há `!important` em `[role="tablist"]` e cards forçando aparência dark mesmo em light.

**Responsividade:** `AppShell` é `flex h-screen` com sidebar fixo de 252px e topbar `px-10 py-5`. Não há breakpoint, drawer mobile nem ajuste de paddings. Em telas <1024px o sidebar consome a largura útil e os charts BI quebram.

**Outros achados menores:**
- Cores hardcoded inline (`#927142`, `rgba(...)`) em componentes — devem virar tokens.
- Tooltips e badges com `.dark` override mas sem variante light equivalente.
- `BiLayout` não tem nenhum container responsivo — herda só o `<Outlet/>`.

---

## Estratégia de Correção (3 fases)

### Fase 1 — Reestruturar o token system (fundação)
Sem mexer em layout. Só limpar a base de cores.

1. **Separar tokens em 3 camadas claras** no `src/index.css`:
   - **Camada 1 — Primitivos VOUX** (champanhe, ink) ficam fixos em `:root` (cores absolutas, não flipam).
   - **Camada 2 — Tokens semânticos shadcn** (`--background`, `--card`, `--foreground`, `--sidebar-*`, `--border`...) — corrigir paleta light e dark.
   - **Camada 3 — Tokens VOUX semânticos** (`--voux-card-from`, `--voux-text-primary`...) — passar a derivar dos tokens shadcn (ou ser alias), de forma que o modo light tenha valores coerentes.

2. **Travar o sidebar como sempre escuro** (decisão sua):
   - `--sidebar-background` continua escuro em ambos os modos.
   - Criar tokens dedicados (`--sidebar-text`, `--sidebar-text-muted`, `--sidebar-hover`, `--sidebar-active`) com valores fixos para que o sidebar não dependa do tema.
   - Refatorar `AppSidebar.tsx` para usar `bg-sidebar text-sidebar-foreground` e os novos tokens — fim das classes `bg-[var(--voux-card-to)]` no sidebar.

3. **Refinar paleta light** com base no champanhe/ink:
   - Fundo: off-white quente (`#faf7f0`), não bege saturado.
   - Cards: branco com borda sutil e sombra mínima.
   - Texto: ink-900 / ink-500 / ink-400 para hierarquia.
   - Accent: champagne-600 (`#927142`) — bom contraste em branco.
   - Charts: revisar as 6 cores para terem contraste em fundo claro (as atuais foram pensadas para fundo escuro).

4. **Remover `!important` desnecessários** em `[role="tablist"]`, badges e shadows; transformar em variantes shadcn.

### Fase 2 — Responsividade do shell
1. **Sidebar mobile**: virar drawer (`<Sheet/>` shadcn) abaixo de `lg` (1024px). Acima, comportamento atual de collapse para 56px.
2. **Topbar**: paddings responsivos (`px-4 sm:px-6 lg:px-10`), título reduz em telas estreitas, ações vão para overflow `…` em mobile.
3. **AppShell**: trocar `h-screen` rígido por `min-h-dvh` (corrige iOS), garantir `min-w-0` nos containers para charts não estourarem.
4. **Cards BI** (`KPICard`, `ChartCard`): grids responsivos `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`; charts com `ResponsiveContainer` revisado.

### Fase 3 — Passada componente a componente
Auditar e corrigir, página por página, usando os novos tokens:
- `BiPainel`, `BiComercial`, `BiPedidos`, `BiProdutos`, `BiServicos`, `BiOperacional`, `BiAdmin`, `BiAcoes`, `BiInteligencia`.
- Páginas CRM (`CrmOverview`, `CrmConsultores`, etc.).
- Tabelas, filtros (`CrmFiltersBar`), tooltips, modais.

Cada página: validar light + dark + breakpoints sm/md/lg/xl. Sem mexer em lógica de dados / hooks / queries.

---

## Antes de começar — 3 decisões que você precisa tomar

1. **Sidebar sempre dark, em ambos os modos?** Você falou que sim — confirmar. (Alternativa: sidebar acompanha tema mas com uma paleta light decente.)
2. **Direção visual do modo light**: prefere
   - (a) **warm editorial** — off-white quente + champanhe, mantém alma VOUX, ou
   - (b) **clean BI** — branco neutro + cinza-azulado + accent champanhe, mais "ferramenta de trabalho", ou
   - (c) eu gero 2-3 propostas visuais (mood boards renderizados) para você escolher?
3. **Ordem de ataque na Fase 3**: começa por qual tela? Sugiro `/bi/painel` (entrada) ou `/bi/comercial` (a que você está olhando agora).

---

## O que NÃO entra neste plano
- Lógica de dados, hooks, queries Supabase, edge functions — intocados.
- Mudanças de funcionalidade ou navegação.
- Substituição de fontes (Instrument Serif + Inter + JetBrains Mono ficam).
- Logo / marca.

## Entregáveis ao fim de cada fase
- Fase 1: `src/index.css` reescrito + `AppSidebar` refatorado. Modo light já fica "respirável", sidebar fica dark fixo.
- Fase 2: shell responsivo de verdade, testado em 375/768/1280/1920.
- Fase 3: telas BI/CRM polidas uma a uma — entrego em PRs pequenas para você validar cada uma.
