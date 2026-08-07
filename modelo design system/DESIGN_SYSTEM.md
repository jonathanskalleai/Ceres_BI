# 🎨 Design System — ChatFlow AI

> Documento de referência do design system do projeto. Atualizado em 2026-04-09.

---

## 1. Filosofia Visual

**Glassmorphism Dark-First** — O sistema adota uma estética moderna baseada em:

- Efeitos de desfoque (`backdrop-filter: blur`)
- Gradientes sutis em superfícies
- Bordas translúcidas com glow sutil
- Micro-animações de elevação e entrada
- Sidebar sempre escura (mesmo no modo claro)

---

## 2. Tipografia

| Propriedade | Valor |
|---|---|
| **Font Family** | `Inter`, `system-ui`, `-apple-system`, `sans-serif` |
| **Antialiasing** | `antialiased` |
| **Escala** | Tailwind padrão (`text-xs` a `text-4xl`) |

---

## 3. Paleta de Cores (Tokens Semânticos HSL)

Todas as cores são definidas como variáveis CSS em formato HSL (sem `hsl()` wrapper) e consumidas via `hsl(var(--token))`.

### 3.1 Modo Escuro (Padrão `:root`)

| Token | HSL | Hex Aprox. | Uso |
|---|---|---|---|
| `--background` | `230 35% 7%` | `#0C0E19` | Fundo principal da aplicação |
| `--foreground` | `210 40% 98%` | `#F8FAFC` | Texto principal |
| `--card` | `234 32% 13%` | `#16182B` | Superfícies elevadas (cards) |
| `--card-foreground` | `210 40% 98%` | `#F8FAFC` | Texto em cards |
| `--popover` | `230 30% 10%` | `#121525` | Fundo de popovers/dropdowns |
| `--primary` | `180 70% 50%` | `#26D9D9` | Cor principal (botões, links, destaques) |
| `--primary-foreground` | `230 35% 7%` | `#0C0E19` | Texto sobre primary |
| `--secondary` | `215 25% 35%` | `#43536E` | Elementos secundários |
| `--muted` | `230 25% 18%` | `#222839` | Fundos suaves/secundários |
| `--muted-foreground` | `215 20% 65%` | `#8D99AE` | Texto secundário/placeholder |
| `--accent` | `180 70% 50%` | `#26D9D9` | Acentos (= primary no tema padrão) |
| `--destructive` | `0 72% 51%` | `#DC2626` | Erros, ações destrutivas |
| `--success` | `142 76% 36%` | `#16A34A` | Sucesso, positivo |
| `--warning` | `38 92% 50%` | `#F59E0B` | Alertas, atenção |
| `--info` | `180 70% 50%` | `#26D9D9` | Informativo |
| `--border` | `230 25% 25%` | `#303650` | Bordas e divisores |
| `--input` | `230 25% 20%` | `#262C40` | Fundo de inputs |
| `--ring` | `180 70% 50%` | `#26D9D9` | Foco (ring) |

### 3.2 Modo Claro (`.light`)

| Token | HSL | Hex Aprox. | Notas |
|---|---|---|---|
| `--background` | `220 15% 88%` | `#D9DCE3` | Cinza claro para contraste com cards brancos |
| `--foreground` | `222 47% 11%` | `#0F172A` | Texto escuro |
| `--card` | `0 0% 100%` | `#FFFFFF` | Cards brancos sólidos |
| `--primary` | `180 65% 35%` | `#1F9393` | Primary mais escura para contraste |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | Texto branco sobre primary |
| `--muted` | `220 14% 85%` | `#D1D5DB` | — |
| `--muted-foreground` | `220 10% 40%` | `#5C6370` | — |
| `--border` | `220 13% 82%` | `#C9CDD5` | — |

> **Nota:** A sidebar permanece escura (`--sidebar-background: 230 35% 12%`) em ambos os modos.

### 3.3 Sidebar (Ambos os modos)

| Token | HSL |
|---|---|
| `--sidebar-background` | `230 35% 8%` (dark) / `230 35% 12%` (light) |
| `--sidebar-foreground` | `210 40% 98%` |
| `--sidebar-primary` | `180 70% 50%` |
| `--sidebar-accent` | `230 25% 15%` |
| `--sidebar-border` | `230 25% 20%` |
| `--sidebar-muted-foreground` | `215 20% 70%` |

### 3.4 Glass Effects

| Token | HSL (Dark) | HSL (Light) |
|---|---|---|
| `--glass-bg` | `230 30% 15%` | `0 0% 100%` |
| `--glass-border` | `180 70% 50%` | `220 13% 85%` |
| `--glass-glow` | `180 70% 50%` | `180 65% 35%` |

---

## 4. Border Radius

| Token Tailwind | Valor |
|---|---|
| `rounded-sm` | `calc(var(--radius) - 4px)` = `12px` |
| `rounded-md` | `calc(var(--radius) - 2px)` = `14px` |
| `rounded-lg` | `var(--radius)` = `16px` |
| `rounded-xl` | `calc(var(--radius) + 4px)` = `20px` |
| `rounded-2xl` | `calc(var(--radius) + 8px)` = `24px` |

`--radius: 1rem` (16px)

---

## 5. Componentes Glass (Classes Utilitárias)

### `.glass-card`
```css
background: linear-gradient(135deg, hsl(var(--glass-bg) / 0.6), hsl(var(--glass-bg) / 0.3));
backdrop-filter: blur(20px);
border: 1px solid hsl(var(--glass-border) / 0.15);
border-radius: 1rem; /* rounded-2xl */
```

### `.glass-card-hover`
Extends `.glass-card` + hover com glow:
```css
:hover {
  border-color: hsl(var(--glass-border) / 0.3);
  box-shadow: 0 0 20px -4px hsl(var(--glass-glow) / 0.15);
}
```

### `.glass-sidebar`
```css
background: linear-gradient(180deg, hsl(var(--sidebar-background) / 0.95), hsl(var(--sidebar-background) / 0.85));
backdrop-filter: blur(40px);
```

### `.glass-topbar`
```css
background: linear-gradient(90deg, hsl(var(--glass-bg) / 0.7), hsl(var(--glass-bg) / 0.5));
backdrop-filter: blur(20px);
```

### `.glass-input`
```css
background: hsl(var(--input) / 0.5);
border: 1px solid hsl(var(--border) / 0.3);
backdrop-filter: blur(10px);
:focus → border-color: hsl(var(--primary) / 0.5) + ring glow
```

### `.glass-button`
```css
background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.8));
box-shadow: 0 4px 16px -2px hsl(var(--primary) / 0.4);
:hover → translateY(-1px) + shadow mais forte
```

> **Modo claro:** Todas as classes glass recebem override para `backdrop-filter: none` e backgrounds sólidos.

---

## 6. Badges de Status

| Classe | Cor de fundo | Borda | Texto |
|---|---|---|---|
| `.badge-default` | `--muted / 0.5` | `--border` | `--muted-foreground` |
| `.badge-success` | `--success / 0.15` | `--success / 0.3` | `--success` |
| `.badge-warning` | `--warning / 0.15` | `--warning / 0.3` | `--warning` |
| `.badge-destructive` | `--destructive / 0.15` | `--destructive / 0.3` | `--destructive` |
| `.badge-info` / `.badge-primary` | `--primary / 0.15` | `--primary / 0.3` | `--primary` |

---

## 7. Chat Bubbles

| Classe | Background | Borda |
|---|---|---|
| `.chat-bubble-in` | `--muted / 0.6` | `--border / 0.3` |
| `.chat-bubble-out` | `--primary / 0.2` | `--primary / 0.3` |
| `.chat-bubble-system` | `--muted / 0.3` | `--border / 0.2` |

---

## 8. Animações

| Nome | Duração | Efeito |
|---|---|---|
| `fade-in` | 0.3s | opacity 0→1 + translateY(10px→0) |
| `slide-in-left` | 0.3s | opacity + translateX(-20px→0) |
| `slide-in-right` | 0.3s | opacity + translateX(20px→0) |
| `slide-in-up` | 0.3s | opacity + translateY(16px→0) |
| `scale-in` | 0.2s | opacity + scale(0.95→1) |
| `glow-pulse` | 2s infinite | box-shadow pulsante com `--glass-glow` |

Classes Tailwind: `animate-fade-in`, `animate-slide-in-left`, `animate-slide-in-right`, `animate-slide-in-up`, `animate-scale-in`, `animate-glow-pulse`.

---

## 9. Presets de Tema

O sistema suporta temas customizáveis por preset + edição manual de cores.

### Dark Mode Presets

| ID | Nome | Primary Hue |
|---|---|---|
| `default` | Ciano (Padrão) | 180° |
| `blue` | Azul | 220° |
| `red` | Vermelho | 0° |
| `orange` | Laranja | 25° |
| `green` | Verde | 142° |
| `purple` | Roxo | 270° |

### Light Mode Presets
Mesmos IDs, com saturação/luminosidade ajustadas para contraste em fundo claro.

### Cores editáveis pelo usuário
- `primary` — Cor principal
- `background` — Fundo
- `card` — Cards/superfícies
- `foreground` — Texto principal
- `muted` — Elementos suaves
- `border` — Bordas

---

## 10. Scrollbar Customizada

```css
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: hsl(var(--muted) / 0.3); }
::-webkit-scrollbar-thumb { background: hsl(var(--muted-foreground) / 0.3); }
scrollbar-width: thin; /* Firefox */
```

---

## 11. Body Background

### Dark Mode
```css
background: linear-gradient(135deg, 
  hsl(230, 35%, 7%) 0%, 
  hsl(250, 40%, 12%) 50%, 
  hsl(270, 35%, 10%) 100%
);
background-attachment: fixed;
```

### Light Mode
```css
background: hsl(220, 15%, 88%);
```

---

## 12. Componentes shadcn/ui

Biblioteca base: **shadcn-ui** (estilo `default`, base color `slate`).

Componentes instalados: Accordion, Alert, AlertDialog, AspectRatio, Avatar, Badge, Breadcrumb, Button, Calendar, Card, Carousel, Chart, Checkbox, Collapsible, Command, ContextMenu, Dialog, Drawer, DropdownMenu, Form, HoverCard, InputOTP, Label, Menubar, NavigationMenu, Pagination, Popover, Progress, RadioGroup, Resizable, ScrollArea, Select, Separator, Sheet, Sidebar, Skeleton, Slider, Sonner, Switch, Table, Tabs, Textarea, Toast, Toggle, ToggleGroup, Tooltip.

### Button Variants
| Variant | Estilo |
|---|---|
| `default` | `bg-primary text-primary-foreground` |
| `destructive` | `bg-destructive text-destructive-foreground` |
| `outline` | `border border-input bg-background` |
| `secondary` | `bg-secondary text-secondary-foreground` |
| `ghost` | hover: `bg-accent text-accent-foreground` |
| `link` | `text-primary underline` |

### Badge Variants
| Variant | Estilo |
|---|---|
| `default` | `bg-primary text-primary-foreground` |
| `secondary` | `bg-secondary text-secondary-foreground` |
| `destructive` | `bg-destructive text-destructive-foreground` |
| `outline` | `text-foreground` com borda |

---

## 13. Acessibilidade & Motion

```css
.motion-reduce * {
  animation-duration: 0.01ms !important;
  transition-duration: 0.01ms !important;
}
```

Inputs e botões possuem `aria-label` fallback automático baseado em `placeholder` ou `title`.

---

## 14. Regras de Uso

1. **Nunca usar cores hardcoded** — Sempre `hsl(var(--token))`
2. **Nunca usar `text-white`, `bg-black`** — Usar tokens semânticos
3. **Testar ambos os modos** — Dark e Light
4. **Sidebar sempre escura** — Não muda entre modos
5. **Glass effects** — Desabilitados no modo claro (sólidos)
6. **Novas cores** — Adicionar em `index.css` + `tailwind.config.ts`
