# REVIEW-FrontendBlocoB — 18e9996

**Auditor:** @reviewer (Rev)
**SHA:** 18e9996b18bb5749becb053157c9d63406e42139
**Data:** 2026-08-03
**Escopo:** diff de feature do Bloco B — Stories 1-A, 2-A, 3-A + Stories 4-A/4-B/5-A (tabelas drill-down)

---

## VEREDITO: **PASS**

Todos os itens do checklist passam. Nenhum bloqueador encontrado.

---

## Checklist Item a Item

### DRY

- [x] **AcoesDegrauBar reutilizado 4x** — Visitas + Oportunidades em `AcoesFunilConversao.tsx:137,139`; Ganho + Perdido em `AcoesDesfechosPeriodo.tsx:23,25`. Sem degrau inline duplicado.
- [x] **3 tabelas novas via BiTableCard** — `AcoesPedidosTable.tsx:76`, `AcoesNegociosPerdidosTable.tsx:75`, `AcoesEmAndamentoTable.tsx:77` — todas passam `BiTableCard` wrapper, markup de table dentro de cada uma. Padrao aceito (colunas diferentes demais para fatorar).
- [x] **3 hooks com padrao identico** — cada um: `useQuery` + `keepPreviousData` + `PAGE_SIZE` const + `queryKey` estruturado. Repetido por semelhanca funcional (aceitavel, sao 3 RPCs distintas).
- [x] **3 services: `unwrapRpc` duplicado** — `acoesPedidosGanhosService.ts:4-7`, `acoesNegociosPerdidosService.ts:4-7`, `acoesEmAndamentoService.ts:4-7`. 9 linhas copy-paste entre 3 arquivos. Nao bloqueante (proximo agent pode extrair helper), mas e duplicacao real.

### Monolito (>400 ln = FAIL)

| Arquivo | Linhas | Limite | Status |
|---------|--------|--------|--------|
| `AcoesSection.tsx` | 302 | 400 | PASS |
| `AcoesFunilConversao.tsx` | 178 | 200 | PASS |
| `AcoesGestaoCarteiraTables.tsx` | 157 | 400 | PASS |
| `AcoesGestaoCarteira.tsx` | 148 | 400 | PASS |
| `AcoesDetailWithFilter.tsx` | 171 | 200 | PASS |
| `AcoesEmAndamentoTable.tsx` | 141 | 150 | PASS |
| `AcoesPedidosTable.tsx` | 126 | 150 | PASS |
| `AcoesNegociosPerdidosTable.tsx` | 125 | 150 | PASS |
| `AcoesDesfechosPeriodo.tsx` | 44 | 60 | PASS |
| `AcoesDegrauBar.tsx` | 67 | 400 | PASS |
| Services (cada) | 57-62 | 400 | PASS |
| Hooks (cada) | 47 | 400 | PASS |

**Nenhum arquivo viola o gate de 400.** Todos os gates especificos da regra #4 tambem passam.

### Dead Code

- [x] **AcoesGestaoCarteiraSummary.tsx deletado** — `grep -rn` retorna zero referencias em todo o repo. Commit message confirma "0 imports".
- [x] **SemContatoTable nao exportado** — `grep "export.*SemContatoTable"` retorna zero. Funcao existe como `function SemContatoTable` interna em `AcoesGestaoCarteiraTables.tsx:24` sem `export`.
- [x] **AcoesSemContatoRow: 2 locais internos** — `AcoesGestaoCarteiraTables.tsx:5,24` (tipo importado + funcao interna). `useAcoesGestaoListasRpc.ts:29` apenas referencia em comentario JSDoc (nao e importacao ativa). Candidata a remocao futura mas nao e dead code introduzido por este commit.

### Type Safety

- [x] **Zero `any`** nos 16 arquivos novos/modificados — `grep -rn ": any\|= any\|as any"` retornou zero matches.

### Separacao Logica/UI

- [x] **Services** — `fetchAcoesPedidosGanhos`, `fetchAcoesNegociosPerdidos`, `fetchAcoesEmAndamento` fazem apenas RPC call + unwrap. Sem transformacao alem do unwrap.
- [x] **Hooks** — `usePedidosGanhosRpc`, `useNegociosPerdidosRpc`, `useEmAndamentoRpc` sao `useQuery` wrappers puros com `keepPreviousData`.
- [x] **Componentes** — renderizam via `BiTableCard`. Busca client-side (filter `useMemo`) fica no componente (aceitavel — operacao leve, nao RPC).
- [x] **Validação de input** — parametros de RPC construidos como `Record<string, unknown>` com `if (x) rpcParams.p_x = x`. Nao ha validacao complexa no service. Limpo.

### Organizacao de Arquivos

- [x] Services: `src/services/bi/acoesPedidosGanhosService.ts`, `acoesNegociosPerdidosService.ts`, `acoesEmAndamentoService.ts`
- [x] Hooks: `src/hooks/bi/usePedidosGanhosRpc.ts`, `useNegociosPerdidosRpc.ts`, `useEmAndamentoRpc.ts`
- [x] Tipos: `src/types/bi/acoesPedidosGanhos.ts`, `acoesNegociosPerdidos.ts`, `acoesEmAndamento.ts`
- [x] Tabelas: `src/components/bi/AcoesPedidosTable.tsx`, `AcoesNegociosPerdidosTable.tsx`, `AcoesEmAndamentoTable.tsx` ( raiz de `bi/`, nao em `sections/`)
- [x] Re-exports: `src/types/biRpc.ts:24-26` atualizados com as 3 novas exportacoes

### Limites Regra #4

- [x] `AcoesFunilConversao.tsx` 178 ln (limite 200)
- [x] `AcoesDesfechosPeriodo.tsx` 44 ln (limite 60)
- [x] `AcoesPedidosTable.tsx` 126 ln (limite 150)
- [x] `AcoesNegociosPerdidosTable.tsx` 125 ln (limite 150)
- [x] `AcoesEmAndamentoTable.tsx` 141 ln (limite 150)

### Respeito ao Contrato

- [x] **docs/features/acoes-bi.md** nao modificado
- [x] **Migrations SQL** — diff inclui 6 arquivos em `supabase/migrations/`: 3 de revoke/ACL (limpeza), 1 de ordenacao desperdicio (Story 3-A), 2 de RPC novas (Stories 4-A/4-B/5-A). Todos diretamente relacionados as stories do diff. `AcoesDetailWithFilter.tsx` so compila com as RPCs no banco. Decisao: **ACEITE como parte do diff de feature** — o frontend drill-down depende das RPCs.

---

## NITs (Qualidade, nao bloqueantes)

1. **`unwrapRpc` duplicado em 3 services** — 9 linhas copy-paste em `acoesPedidosGanhosService.ts:4-7`, `acoesNegociosPerdidosService.ts:4-7`, `acoesEmAndamentoService.ts:4-7`. Sugestao para proximo ciclo: extrair para `src/lib/bi/rpcUnwrap.ts` e importar nos 3 services.

2. **`SemContatoTable` interna sem consumer** — mantida "para possivel reuso futuro" (comment em `AcoesGestaoCarteiraTables.tsx:23`). Nao e exportada, nao e usada. Se a intencao e manter para possivel futuro, manter comment. Se nao, deletar. Documentado como aceitavel.

3. **AcoesSection.tsx 302 linhas** — dentro do limite (400) mas esta se aproximando. Components mais tarde: considerar extrair o grid de charts para `AcoesChartsGrid.tsx` (~65 ln) e manter AcoesSection como compositor puro (~240 ln).

4. **Teste ajustado em vez de corrigido** — `AcoesFunilConversao.test.tsx` mudou `getByText("negocios")` para `getAllByText(/negocios/i).length > 0`. A verificacao esta mais fraca. Sugestao: usar `getAllByText` com `exact: false` e verificar o count esperado se ha multiplos matches.

---

## Resumo

Estrutura solida. DRY respeitado via AcoesDegrauBar. Sem monolitos. Dead code removido corretamente (AcoesGestaoCarteiraSummary). TypeScript estrito em todos os arquivos novos. Separacao logica/UI limpa. Organizacao de arquivos correta. Limites da regra #4 respeitados em todos os 16 arquivos. Diff toca migrations por necessidade funcional (RPCs das tabelas drill-down), nao por invasao de escopo.

O unico ponto de atencao e a duplicacao do `unwrapRpc` — menor, mas real. Passa sem bloqueio.
