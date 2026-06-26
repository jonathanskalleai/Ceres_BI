# Handoff — Ceres BI "Sistema Pronto" → Fase 3

**Data:** 2026-06-25
**Branch:** `perf/bi-quick-wins`
**Último commit:** `fa39863` — feat(bi): phase 1+2

---

## Contexto

O objetivo é tornar o Ceres BI um sistema pronto para uso. O trabalho foi dividido em 3 fases. Fases 1 e 2 estão completas e commitadas.

## O que foi feito (Fases 1 + 2)

### Fase 1 — Fixes Críticos
- **Tooltip light mode:** Corrigido em BarChart, LineChart, PieChart, ComboChart. Agora usa `var(--voux-tooltip-text)` e `var(--voux-tooltip-muted)` em vez de `VOUX_COLORS.ink`.
- **Cores hardcoded:** 6 arquivos do dashboard migrados para tokens VOUX (`--voux-success/warning/danger/info`).
- **Mobile sidebar:** Sheet drawer com hamburger no topbar (< 768px). AppSidebar recebe `onNavClick` para fechar o sheet.
- **Filtros responsivos:** BiTopbarPortal agora usa `w-full sm:w-[Xpx]`.
- **MapKpis responsivo:** `grid-cols-1 sm:grid-cols-3`.
- **RPCs server-side:** `rpc_operacional_bi()` e `rpc_produtos_bi()` criados (migration `20260625_rpc_operacional_produtos_bi.sql`). Hooks `useOperacionalBIRpc` e `useProdutosBIRpc` substituem fetch de 100K+ rows.

### Fase 2 — Clareza de Dados
- **Comparação período anterior:** Implementada em `usePedidosKPIsRpc`, `useServicosKPIsRpc`, `useCrossKPIsRpc` (usa `getPreviousPeriod` + dupla chamada RPC).
- **Clientes KPI:** `parqueMaquinas` agora vem de `rpc_produtos_bi`.
- **BiErrorState:** Componente reutilizável com retry, integrado em Operacional e Produtos.
- **Dead code removido:** `src/components/ui/chart.tsx` (Recharts wrapper não usado), `src/lib/chartColors.ts` (divergente, não importado).

---

## O que falta — Fase 3

### 3.1 Export PDF/Excel (ALTA prioridade)
- Exportar tabelas/charts como CSV/XLSX (dados) e/ou PDF (visual).
- Sugestão: usar `xlsx` (SheetJS) para dados tabulares, `html2canvas` + `jspdf` para PDF visual (html2canvas já está no bundle: `dist/assets/html2canvas.esm-*.js`).
- Pontos de integração: adicionar botão de export no `ChartCard` header ou no topbar de cada seção.

### 3.2 Limpar services legacy
- `src/services/bi/operacionalBIService.ts` — agora redundante (substituído por RPC).
- `src/services/bi/produtosBIService.ts` — agora redundante.
- `src/hooks/bi/useOperacionalData.ts` — não mais importado por nenhum componente.
- `src/hooks/bi/useProdutosData.ts` — não mais importado por nenhum componente.
- `src/services/bi/negociosBIService.ts` — fetch legacy de 50K rows, parcialmente substituído por RPCs mas ainda usado pelo CRM (verificar antes de deletar).
- Remover `recharts` do `package.json` (Recharts wrapper já deletado).

### 3.3 Acessibilidade
- `aria-label` descritivo nos containers de chart (`role="img" aria-label="Gráfico de..."`)
- Labels visíveis nos filtros do BiTopbarPortal (atualmente só placeholder)
- Verificar contraste dos textos `--voux-text-faint` em modo claro (pode estar no limite)

### 3.4 Itens menores (nice-to-have)
- Classificação de status de negócios: trocar `LIKE '%perd%'` por enum/lookup (RPCs SQL)
- Remover dependência `recharts` do package.json
- Considerar code-splitting para reduzir o chunk principal (2.1MB → meta < 1MB)

---

## Arquivos-chave para Fase 3

| Arquivo | Relevância |
|---------|-----------|
| `src/components/bi/ChartCard.tsx` | Adicionar botão export aqui |
| `src/services/bi/operacionalBIService.ts` | Deletar (redundante) |
| `src/services/bi/produtosBIService.ts` | Deletar (redundante) |
| `src/hooks/bi/useOperacionalData.ts` | Deletar (redundante) |
| `src/hooks/bi/useProdutosData.ts` | Deletar (redundante) |
| `src/components/bi/BiTopbarPortal.tsx` | Adicionar labels a11y |
| `package.json` | Remover `recharts` |
| `supabase/migrations/20260623_create_bi_rpcs.sql` | LIKE '%perd%' → fix |

---

## Como continuar

```bash
git checkout perf/bi-quick-wins
# Fase 3.1: Export
# Fase 3.2: Cleanup (verificar grep antes de deletar)
# Fase 3.3: A11y
```

**Migration pendente:** `20260625_rpc_operacional_produtos_bi.sql` precisa ser aplicada no Supabase remoto para que as seções Operacional/Produtos funcionem com os novos RPCs. Sem ela, vai dar erro de "function not found".
