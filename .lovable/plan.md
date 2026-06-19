## Objetivo

Reduzir a altura vertical dos cards de KPI e aumentar a hierarquia do número, ganhando densidade na tela. Como `KPICard.tsx` é compartilhado por **todas** as abas (Painel, Comercial, Operacional, Pedidos, Produtos, Serviços, Inteligência, Ações, Admin), uma única alteração propaga pra tudo.

## Alterações

**1. `src/components/bi/KPICard.tsx`** — único arquivo tocado:

- **Padding**: de `p-5 md:p-6` (20–24px) → `px-4 py-3 md:px-5 md:py-3.5` (~12–14px vertical). Redução de ~40% na altura.
- **Espaçamento interno**: `mb-3 md:mb-4` no header → `mb-2`. `mt-1.5` e `mt-2` reduzidos pra `mt-1`.
- **Número (valor)**: de `text-xl sm:text-2xl md:text-[26px]` → `text-2xl sm:text-[28px] md:text-[32px]`. Mais peso visual.
- **Rótulo**: mantém tamanho (`text-[11px]`) — já está bom depois da última iteração.
- **Ícone**: `h-7 w-7` → `h-6 w-6` (menos peso, libera espaço lateral).
- **Hint / delta**: mantém tamanho, só reduz margens.
- **Truncate**: para números muito grandes (ex.: `R$ 2.767.000`), adiciona `tabular-nums` e mantém `truncate` já existente — se faltar espaço, o `truncate` corta com ellipsis ao invés de quebrar layout.

**2. Grid (opcional, NÃO mexer agora)**: o grid de cards (definido em `BiPainel.tsx` e nas outras páginas BI) já é responsivo. Não vamos alterar o número de colunas — só a altura individual já reduz bastante a área ocupada.

## Não incluso (fora de escopo)

- Mudar grid/colunas das páginas BI.
- Alterar `ChartCard` ou cards de outras telas (Dashboard CRM, Performance, etc.) — escopo é o KPICard do BI, que é o que aparece nas suas screenshots.
- Refatorar tipografia (já feito na última iteração).

## Validação

Após aplicar: comparar `/bi/painel` antes/depois — esperado ganhar ~30–40% de espaço vertical, número mais legível, fonte do rótulo permanece preta no light / clara no dark.