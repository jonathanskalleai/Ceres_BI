# QA Report - Bloco B Fase 2 (Commit 18e9996 + Migrations fdc143d + 3cdc373)

**Agent:** @qa (Quinn) | **Data:** 2026-08-03 | **Escopo:** Runtime validation (Bloco B)
**SHA validado:** `18e9996b18bb5749becb053157c9d63406e42139`

---

## 1. Build & Tests (local)

| Item | Resultado |
|------|-----------|
| `npm run build` | **PASS** — exit code 0, 3716 modules, 4.83s |
| `npx vitest run` | **PASS** — 12 files, 169 tests passing |
| `AcoesGestaoCarteiraSummary` refs | **0** — arquivo deletado, nenhum import orfao |

---

## 2. PR Checklist (@dev)

| # | Item | Status |
|---|------|--------|
| 1 | `AcoesDegrauBar.tsx` criado e referenciado 4x (Visitas/Oport/Ganho/Perdido) | ✅ — 67 ln, 3 refs em AcoesFunilConversao.tsx |
| 2 | `AcoesDesfechosPeriodo.tsx` ≤ 60 ln | ✅ — 44 ln |
| 3 | `AcoesFunilConversao.tsx` ≤ 200 ln | ✅ — 178 ln |
| 4 | TABS em `AcoesGestaoCarteira.tsx` = `desperdicio` + `negativas` | ✅ — comentario Story 2-A + TABS verificado |
| 5 | `AcoesGestaoCarteiraSummary.tsx` DELETADO | ✅ — arquivo removido, 0 refs no codebase |
| 6 | `DesperdicioTable` redesenhado com InlineBar + badge NULL + bg danger | ✅ — grep verificado (ln 83-96: isAlert, bg-destructive, badge SEM OPORTUNIDADE) |
| 7 | 3 tabelas novas ≤ 150 ln cada | ✅ — AcoesPedidosTable (126), AcoesNegociosPerdidosTable (125), AcoesEmAndamentoTable (141) |
| 8 | 3 RPCs novas integradas (service + hook + tabela) | ✅ — 6 arquivos verificados (3 services + 3 hooks) |
| 9 | `AcoesDetailWithFilter.tsx` roteia pelos 4 status | ✅ — Story 5-A: Ganho/Perdido/Em Andamento verificado |
| 10 | Chip "Em Aberto" → "Em Andamento" renomeado | ✅ — verificado em AcoesDetailWithFilter.tsx ln 12, 15, 22, 43, 48 |
| 11 | `npm run build` passa | ✅ — EXIT_CODE=0 |
| 12 | `npx vitest run` passa | ✅ — 169 passing |
| 13 | Dead code (`AcoesSemContatoRow` orfa) | ⚠️ — mantido: 4 consumidores ativos (types, hooks, tables) |

---

## 3. AC5 Ampliado (banco vivo — SSH root@178.238.235.203)

### 3.1. Invariantes Validadas

| Invariante | Esperado | Obtido | Passa? |
|-----------|---------|--------|--------|
| **Inv1:** Total funil.oportunidades = em_andamento.total | `112=112` | `112=112` | ✅ |
| **Inv2:** Unicidade por pagina (rows = distinct negocio_numero) | `10=10` | `10=10` | ✅ |
| **Inv3:** Total consistente entre offsets (0/10/20) | `112=112=112` | `112=112=112` | ✅ |
| **Inv4:** Fan-out cliente em pedidos_ganhos | `N=N` | **ERRO de SQL** | ❌ |
| **Inv5:** Fan-out cliente em negocios_perdidos | `N=N` | **ERRO de SQL** | ❌ |

### 3.2. Falhas Criticas

#### FALHA 1 — `rpc_acoes_pedidos_ganhos` (Inv4)

```
ERROR: column pd.pdo_situacaopedido does not exist
LINE 52: AND pd.pdo_situacaopedido = 'Aprovado'
```

**Causa-raiz:** O CTE `pedidos_dedup` nao inclui `pdo_situacaopedido` nos SELECTs, mas `pedidos_periodo` referencia `pd.pdo_situacaopedido` no WHERE. A coluna existe na tabela `mirror.crm_pedidos` (confirmado: 49 linhas com `Aprovado` em julho/2026) — o bug esta no SQL da funcao.

**Fix:** Adicionar `p.pdo_situacaopedido` ao SELECT de `pedidos_dedup`.

```sql
-- Em pedidos_dedup, adicionar:
pedidos_dedup AS (
  SELECT DISTINCT ON (p.pdo_codigointerno)
    p.pdo_codigointerno,
    p.pdo_vlrpedido,
    p.pdo_dthaprovacao,
    p.pdo_situacaopedido,  -- ESTA COLUNA FALTA
    p.ngo_numero
  FROM mirror.crm_pedidos p
  ...
)
```

#### FALHA 2 — `rpc_acoes_negocios_perdidos` (Inv5)

```
ERROR: column sub.data_fechamento does not exist
HINT: Perhaps you meant to reference the column "dataFechamento".
LINE 3: ORDER BY sub.data_fechamento DESC, sub.negocio_numero ASC
```

**Causa-raiz:** `json_agg(row_to_json(sub) ORDER BY sub.data_fechamento ...)` — o ORDER BY dentro de `json_agg` referencia `data_fechamento` (snake_case sem aspas) mas o JSON key gerado por `row_to_json` usa camelCase (`dataFechamento`) por causa da aspas dupla no alias `AS "dataFechamento"`.

**Fix:** Remover aspas duplas do alias interno ou usar o nome correto no ORDER BY:

```sql
-- Opcao A: ORDER BY sub."dataFechamento" DESC
-- Opcao B: usar alias sem aspas: AS data_fechamento
```

---

## 4. ACL HTTP (8 RPCs sem JWT)

| RPC | HTTP Code | Esperado | Passa? |
|-----|-----------|---------|--------|
| `rpc_acoes_pedidos_ganhos` | 401 | 401/403 | ✅ |
| `rpc_acoes_negocios_perdidos` | 401 | 401/403 | ✅ |
| `rpc_acoes_em_andamento` | 401 | 401/403 | ✅ |
| `rpc_acoes_gestao_listas` | 401 | 401/403 | ✅ |
| `rpc_acoes_bi` | 401 | 401/403 | ✅ |
| `rpc_acoes_funil_gestao` | 401 | 401/403 | ✅ |
| `rpc_acoes_detalhe` | 401 | 401/403 | ✅ |
| `rpc_acoes_mapa_oportunidades` | 401 | 401/403 | ✅ |

**Nota:** Todas as 8 RPCs estao corretamente protegidas. REVOKEs de SEC-FIX-1 aplicados.

---

## 5. Regressao Funil (julho/2026)

| Campo | Esperado | Obtido | Delta |
|-------|---------|--------|-------|
| visitas | ~550 | **550** | 0 (pos-correcoes data-engineer) |
| oportunidades | 112 | **112** | 0 |
| ganhos | 26 | **26** | 0 |
| perdidos | 7 | **7** | 0 |
| valorGanho | 2753425.30 | **2753425.30** (via rpc_acoes_bi) | 0 |
| valorPerdido | 1060000.00 | **1060000.00** | 0 |

**Nota:** O funil NAO retorna `valorGanho` diretamente — esse campo vem de `rpc_acoes_bi`. O campo no funil e `valorPerdido`. Valores consistentes com o estado pos-correcoes.

---

## 6. Veredito

### **FAIL — Bloquear Merge/Deploy**

| Check | Status | Detalhe |
|-------|--------|---------|
| Build + Tests | ✅ PASS | EXIT_CODE=0, 169/169 |
| PR Checklist | ✅ PASS | 13/13 items verificados |
| AC5 Inv1-InV3 | ✅ PASS | 112=112, 10=10, 112=112=112 |
| AC5 Inv4 | ❌ **FAIL** | `rpc_acoes_pedidos_ganhos` quebrada |
| AC5 Inv5 | ❌ **FAIL** | `rpc_acoes_negocios_perdidos` quebrada |
| ACL HTTP | ✅ PASS | 8/8 = 401 sem JWT |
| Regressao | ✅ PASS | valores consistentes |

### Acoes Obrigatorias ANTES de Aprovar (@data-engineer)

1. **Fix `rpc_acoes_pedidos_ganhos`:** Adicionar `p.pdo_situacaopedido` ao SELECT do CTE `pedidos_dedup` (ln ~20 da funcao). Tambem necessario no bloco `total`.
2. **Fix `rpc_acoes_negocios_perdidos`:** Corrigir `ORDER BY sub.data_fechamento` → `ORDER BY sub."dataFechamento"` (ou usar alias sem aspas no SELECT interno).

Apos corrigir, re-validar Inv4 e Inv5 via SSH antes de re-emitir verdict.

---

## Handoff

```yaml
handoff:
  from: "@qa"
  to: "@data-engineer"
  verdict: "FAIL"
  output_summary: "Build+tests PASS (169/169). ACL 8/8 = 401. Regressao OK. Porem AC5 Inv4 (pedidos_ganhos CTE falta pdo_situacaopedido) e Inv5 (negocios_perdidos ORDER BY sub.data_fechamento vs JSON key "dataFechamento") — ambas funcoes quebradas em prod."
  issues:
    - "rpc_acoes_pedidos_ganhos: CTE pedidos_dedup nao inclui pdo_situacaopedido, mas pedidos_periodo filtra por ele"
    - "rpc_acoes_negocios_perdidos: ORDER BY dentro de json_agg referencia data_fechamento mas JSON key e dataFechamento"
  next_input: "Aplicar as 2 correcoes via migration (CREATE OR REPLACE FUNCTION) + revalidar Inv4 e Inv5 no banco vivo antes de re-abrir QA"
```
