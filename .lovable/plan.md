
# Corrigir modo dark quebrado + truncamentos

## O problema (causa raiz)

Na última iteração eu introduzi tokens de superfície (`--surface-base`, `--surface-raised`, `--surface-overlay`, `--surface-topbar`) **só dentro de `:root` (light mode)** e não os redefini dentro de `.dark`. Resultado: em dark mode, KPICard, ChartCard e a topbar herdam os valores claros (`#ffffff`, `rgba(236,229,212,.82)`) — por isso os cards estão brancos e a topbar bege no seu print.

Além disso, o `truncate` que coloquei no label do KPI e no título da topbar é cedo demais — `TOTAL RECEITA` vira `TOTAL RE…`, `Visão Geral` vira `Visao Ge…`.

> Os HTMLs (`atendimento.html`, `inadimplencia.html`, etc.) **continuam só como referência** de tipografia e padrão visual — nada vai ser copiado pro projeto.

## O que vou mudar (escopo cirúrgico)

### 1. `src/index.css` — definir tokens de superfície no `.dark`
Adicionar dentro do bloco `.dark { … }`:
```css
--surface-base:    #0a0907;   /* mesmo do background */
--surface-raised:  #18160f;   /* card elevado, igual --voux-card-from */
--surface-overlay: #1f1c14;   /* popover / dropdown */
--surface-topbar:  rgba(10, 9, 7, 0.85);  /* topbar translúcida escura */
```

Também conferir/ajustar:
- `--voux-card-border` em dark já é `rgba(214,207,193,0.08)` — ok, mas vou subir um pouco pra `0.10` para a borda aparecer no fundo `#18160f`.
- `--voux-card-shadow` em dark já existe — ok.

### 2. `src/components/bi/KPICard.tsx` — soltar o truncate
- Remover `truncate` do label/eyebrow; deixar quebrar em 2 linhas com `line-clamp-2` (ou simplesmente sem truncate).
- Manter `truncate` **apenas no valor numérico** (com `title` no hover), que era o problema original do `R$ 225.370.219` estourando.
- Reduzir `letter-spacing` do eyebrow de `0.22em` pra `0.14em` — labels longos como `CONSULTORES`/`CLIENTES` ficam menos comprimidos.

### 3. `src/components/layout/AppShell.tsx` — soltar o truncate da topbar
- Tirar `truncate` do título (`Visão Geral` não pode virar `Visao Ge…`).
- Manter `min-w-0` no flex, mas usar `whitespace-nowrap` só quando couber; em telas estreitas o título pode quebrar pra 2 linhas.
- Conferir contraste do eyebrow (`CERES BI…`) em dark — provavelmente também está com truncate aplicado erroneamente.

### 4. Verificação visual (Playwright)
Depois das edições, rodar Playwright em `/bi/painel`:
- screenshot light @ 1440 e @ 1024
- screenshot dark @ 1440 e @ 1024
- confirmar: cards escuros no dark, labels inteiros (`TOTAL RECEITA`, `CONSULTORES`), título `Visão Geral` completo, topbar translúcida escura.

## O que **NÃO** vou fazer
- Não vou criar `SectionHead`, `Toolbar`, `FilterPanel` novos.
- Não vou refatorar páginas BI.
- Não vou copiar layouts dos HTMLs.
- Não vou adicionar fonte Geist nem mexer em outras telas (CRM, Admin, etc.).

Só o fix do dark mode + truncamentos. Depois disso, se quiser, retomamos a conversa sobre refinar tipografia/padrões dos HTMLs como inspiração — mas separado.
