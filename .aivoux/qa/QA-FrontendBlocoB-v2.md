# QA Report - Bloco B Fase 2 — RE-VALIDACAO POS-CORRECOES (Commit f82d093)

**Agent:** @qa (Quinn) | **Data:** 2026-08-03 | **Escopo:** Runtime re-validation pos-fix
**SHA validado:** `f82d093e20ed7edaf5902a609e4017d52fa23b71`

---

## 1. Build & Tests (local)

| Item | Resultado |
|------|-----------|
| `npm run build` | **PASS** — confirmado pelo @reviewer (commit f82d093) |
| `npx vitest run` | **PASS** — confirmado pelo @reviewer (commit f82d093) |

---

## 2. AC5 Ampliado (banco vivo — SSH root@178.238.235.203)

### 2.1. Invariantes Validadas (apos fix do @data-engineer)

| Invariante | Esperado | Obtido | Passa? |
|-----------|---------|--------|--------|
| **Inv1:** Total funil.oportunidades = em_andamento.total | `112=112` | `112=112` | ✅ |
| **Inv2:** Unicidade por pagina (rows = distinct negocio_numero, limit=10) | `10=10` | `10=10` | ✅ |
| **Inv3:** Total consistente entre offsets (0/10/20) | `112=112=112` | `112=112=112` | ✅ |
| **Inv4:** Fan-out cliente em pedidos_ganhos (rows = distinct pedidoCodigo) | `26=26` | `26=26` | ✅ |
| **Inv5:** Fan-out cliente em negocios_perdidos (rows = distinct negocioNumero) | `7=7` | `7=7` | ✅ |

**Nota:** Inv4 e Inv5 agora passam apos as 2 migrations corretivas:
- `20260803_fix_rpc_acoes_pedidos_ganhos.sql`: adicionou `pdo_situacaopedido` no CTE `pedidos_dedup`
- `20260803_fix_rpc_acoes_negocios_perdidos.sql`: corrigiu alias `dataFechamento` no ORDER BY dentro de `json_agg` (nivel externo)

---

## 3. ACL HTTP (8 RPCs sem JWT)

| RPC | HTTP Code | Esperado | Passa? |
|-----|-----------|---------|--------|
| `rpc_acoes_pedidos_ganhos` | **401** | 401/403 | ✅ |
| `rpc_acoes_negocios_perdidos` | **401** | 401/403 | ✅ |
| `rpc_acoes_em_andamento` | **401** | 401/403 | ✅ |
| `rpc_acoes_gestao_listas` | **401** | 401/403 | ✅ |
| `rpc_acoes_bi` | **401** | 401/403 | ✅ |
| `rpc_acoes_funil_gestao` | **401** | 401/403 | ✅ |
| `rpc_acoes_detalhe` | **401** | 401/403 | ✅ |
| `rpc_acoes_mapa_oportunidades` | **401** | 401/403 | ✅ |

**Nota:** 8/8 = 401 sem JWT. REVOKEs de SEC-FIX-1 aplicados corretamente.

---

## 4. Regressao Funil (julho/2026)

| Campo | Esperado | Obtido | Delta |
|-------|---------|--------|-------|
| visitas | ~550 | **550** | 0 |
| oportunidades | 112 | **112** | 0 |
| ganhos | 26 | **26** | 0 |
| perdidos | 7 | **7** | 0 |
| valorGanho | 2753425.30 | **2753425.30** (soma ranking) | 0 |
| valorPerdido | 1060000.00 | **1060000.00** | 0 |

**Nota:** `valorGanho` nao existe em `funil` diretamente — e computado pela soma de `rankingConsultores[].valorGanho` (2.753.425,30 = soma dos 10+ consultores com ganhos).

---

## 5. Veredito

### **PASS — Aprovar Merge/Deploy**

| Check | Status | Detalhe |
|-------|--------|---------|
| Build + Tests | ✅ PASS | EXIT_CODE=0, 169/169 (@reviewer) |
| PR Checklist | ✅ PASS | 13/13 items (@reviewer) |
| AC5 Inv1 | ✅ PASS | 112=112 |
| AC5 Inv2 | ✅ PASS | 10=10 |
| AC5 Inv3 | ✅ PASS | 112=112=112 |
| AC5 Inv4 | ✅ **PASS** | 26=26 (fix: pdo_situacaopedido no CTE) |
| AC5 Inv5 | ✅ **PASS** | 7=7 (fix: dataFechamento no ORDER BY externo) |
| ACL HTTP | ✅ PASS | 8/8 = 401 sem JWT |
| Regressao funil | ✅ PASS | 550\|112\|26\|7\|2753425.30\|1060000.00 |

**Todas as 5 invariantes, 8 ACLs e regressao funil passam.** O gate de deploy esta desbloqueado.

---

## Handoff

```yaml
handoff:
  agent: "@qa"
  verdict: "PASS"
  output_summary: "Todas as 5 invariantes AC5 passam em prod (Inv4: 26=26, Inv5: 7=7). ACL 8/8 = 401. Regressao funil: 550|112|26|7|2753425.30|1060000.00. Gate desbloqueado."
  issues: []
  next_input: "Deploy gate desbloqueado. Commits f82d093 + 604f11b podem ser mergeados. Veredicto gravado em .aivoux/gates/qa-verdict.json."
```
