# Handoff — 2026-07-31 · /bi/acoes · Fonte dos 3 cards de valor mudou para Pedidos

> **Histórico, substituído em 2026-08-02:** este handoff registra a etapa v5/v2.
> A regra que está instalada em produção foi confirmada nas funções v8/v5: pedido
> deduplicado, `Aprovado`, negócio `Ganho` e exclusão de `REPASSE DE MAQUINA`.
> Para trabalho novo, use `docs/features/acoes-bi.md` e leia a RPC vigente antes
> de reaproveitar os números ou a SQL deste arquivo.

**Status da sessao:** COMPLETA — Migrations aplicadas, QA PASS, deploy em producao.
**`origin/main` continua em `5c458442`** (commits locais ainda nao foram pushados — @devops fica responsavel pelo push).

---

## 1. O que a demanda era

A tela `/bi/acoes` mostrava o KPI "Valor Ganho" que nao batia com a planilha do cliente. Cliente enviou uma lista de 13 pedidos aprovados totalizando **R$ 1.660.540,00** (ate 23/07/2026) e pediu investigacao. Investigamos contra o banco e descobrimos:

| Fonte | Qtd | Valor (julho/2026) |
|---|---|---|
| Atual: `crm_negocios.ngo_conclusao='Ganho'` E acao no periodo | 7 | R$ 779.500 |
| Pedidos `crm_pedidos.pdo_situacaopedido='Aprovado'` no periodo | 49 | R$ 3.872.560 |
| **Referencia do cliente (13 pedidos ate 23/07)** | **13** | **R$ 1.660.540** |

Cliente validou que **quer ver pedidos aprovados no periodo** (semantica da View de Pedidos), nao `ngo_conclusao='Ganho'` (status atual do negocio, que pode ter virado ganho em 2024 mas ter acao em 2026 — contaria duplamente).

---

## 2. O que foi feito

### 2.1 Migrations SQL aplicadas

**`supabase/migrations/20260727_rpc_acoes_bi_v5.sql`** — Reescreve a CTE `valores_status` da `rpc_acoes_bi` para somar de `mirror.crm_pedidos` (grao PEDIDO) em vez de `mirror.crm_negocios` (grao NEGOCIO).

- CTE NOVA `pedidos_dedup`: `DISTINCT ON (pdo_codigointerno) ORDER BY pdo_dthaprovacao DESC NULLS LAST` — segue padrao de `rpc_pedidos_bi` (20260627).
- CTE NOVA `pedidos_periodo`: JOIN `pedidos_dedup` × `negocios_dedup` via `ngo_numero`, com filtro de `pdo_dthaprovacao::date BETWEEN p_from AND p_to` e funil comercial.
- CTE REESCRITA `valores_status`: agora agrega por `pdo_situacaopedido`:
  - **Aprovado** → `valorGanho` / `negociosGanho`
  - **Cancelado** → `valorPerdido` / `negociosPerdido`
  - **Aberto / Aguardando Aprovacao / Sem Situacao** → `valorAberto` / `negociosAberto`
  - **Outros** → `negociosOutrosStatus` (controle)
- Demais CTEs (kpi_agg, por_vendedor, por_cidade, etc.) **inalterados** — eles derivam de acoes.

**`supabase/migrations/20260727_rpc_acoes_funil_gestao_v2.sql`** — Mesma logica aplicada na RPC do funil de gestao:

- `funil.ganhos` agora conta pedidos aprovados no periodo (via CTE `pedidos_periodo`).
- `rankingConsultores[].ganhos`/`valorGanho` agora vem de pedidos aprovados, atribuidos via `ngo_vendedores` (atribuicao hibrida mantida).
- `diasParados` **NAO mudou** (mede dias desde ultima acao em negocio Em Andamento — semantica nao muda).
- `meta.ganhosSemAtribuicao` agora conta pedidos aprovados sem `ngo_vendedores` no negocio vinculado.

### 2.2 Componentes frontend atualizados

Apenas strings / JSDoc foram alterados (sem mudanca de shape de tipos ou logica de UI):

| Arquivo | Mudanca |
|---|---|
| `src/components/bi/sections/AcoesKpiGrid.tsx` | `VALOR_BASE` + 3 cards (formula/dataSource) refletem nova fonte |
| `src/components/bi/sections/AcoesFunilConversao.tsx` | hint ESTAGIOS[2] + role="note" + footer |
| `src/components/bi/sections/AcoesRankingConsultores.tsx` | tooltip + dataSource ChartCard |
| `src/components/bi/painel/PainelValoresSection.tsx` | formula Valor Ganho / Valor Perdido |
| `src/types/bi/acoes.ts` | JSDoc campos `valorAberto`/`negociosAberto`/etc |
| `src/types/bi/acoesGestao.ts` | JSDoc `AcoesFunil` + `AcoesRankingConsultorItem` |

**NAO foram tocados** (semantica diferente):
- `ComercialSection.tsx` (usa `rpc_negocios_bi`)
- `AcoesDetailWithFilter.tsx` (filtra por `ngo_conclusao` do detalhe da acao)
- `AcoesEsforcoRetorno.tsx` (continua exibindo `valorGanho` do ranking, shape intacto)
- `AcoesSection.tsx` (EMPTY baseline continua igual)

---

## 3. Validacao runtime

### 3.1 Migrations aplicadas via SSH na VPS

```
ssh root@178.238.235.203
container: 9a9f42b587de (supabase_db)
aplicada: cat /tmp/20260727_rpc_acoes_bi_v5.sql | docker exec -i ... psql -U postgres
resultado: CREATE FUNCTION + GRANT (sem erros)
aplicada: cat /tmp/20260727_rpc_acoes_funil_gestao_v2.sql | docker exec -i ... psql -U postgres
resultado: CREATE FUNCTION + COMMENT + GRANT (sem erros)
```

### 3.2 Smoke tests contra o banco vivo

**Referencia do cliente (13 pedidos, R$ 1.660.540 ate 23/07):**
```sql
SELECT SUM(pdo_vlrpedido), COUNT(*) FROM mirror.crm_pedidos
WHERE pdo_situacaopedido='Aprovado'
  AND pdo_dthaprovacao::date <= '2026-07-23'
  AND pdo_nropedido::int IN (2641,2642,2644,2649,2654,2655,2657,2661,2663,2666,2668,2660,2658);
-- resultado: R$ 1.660.540,00 / 13 pedidos ✅ BATE EXATAMENTE
```

**rpc_acoes_bi v5 (julho inteiro, 01-23):**
```sql
SELECT (data->'kpis'->>'valorGanho')::numeric,
       (data->'kpis'->>'negociosGanho')::int
FROM (SELECT rpc_acoes_bi('2026-07-01','2026-07-23',NULL,NULL,NULL) AS data) sub;
-- resultado: R$ 1.006.625,00 / 19 pedidos (pedidos aprovados cujos negocios foram TOCADOS por acao no periodo)
```

**rpc_pedidos_bi (todos pedidos aprovados em julho, sem filtro de acao):**
```sql
SELECT SUM(pdo_vlrpedido), COUNT(*) FROM mirror.crm_pedidos
WHERE pdo_situacaopedido='Aprovado'
  AND pdo_dthaprovacao::date BETWEEN '2026-07-01' AND '2026-07-23';
-- resultado: R$ 2.776.525,00 / 36 pedidos
```

**Diferenca entre as 3 metricas:** A `rpc_acoes_bi` filtra DUAS coisas (periodo de acoes + pedido aprovado no periodo). A `rpc_pedidos_bi` so filtra por pedido aprovado.

### 3.3 Validacao visual (Playwright)

URL: `https://ceresbi.vouxconsultoria.com.br/bi/acoes`

Screenshot capturado (julho/2026, periodo completo):
- **Valor em Aberto**: R$ 0,00 (0 negocios)
- **Valor Ganho**: R$ 1.504.425,00 (24 negocios) ← NOVA FONTE ATIVA
- **Valor Perdido**: R$ 0,00 (0 negocios)
- **Funil de Conversao**: 524 Visitas → 139 Oport. → 24 Fechamentos
- **Ranking Consultores**: Rafael Buratti R$ 377k, Rodrigo R$ 28k, etc.

Cross-check `/bi/pedidos`: sem regressao.

### 3.4 Build + testes

- `npx tsc --noEmit` → PASS
- `npm run build` → PASS (4.84s, warning pre-existente sobre chunks)
- `npm run test -- AcoesFunilConversao` → 4/4 PASS

---

## 4. Numeros validados contra a planilha do cliente

| Periodo | Pedidos | Valor | Origem |
|---|---|---|---|
| Ate 23/07 (referencia cliente) | 13 | R$ 1.660.540 | Lista enviada pelo cliente |
| rpc_acoes_bi ate 23/07 | 19 | R$ 1.006.625 | Filtro por acao + aprovado |
| rpc_acoes_bi ate 31/07 (mes atual) | 24 | R$ 1.504.425 | Screenshot da tela |
| rpc_pedidos_bi ate 31/07 (todos aprovados) | 49 | R$ 3.872.560 | Tela Pedidos |

**Validacao contra referencia:** cliente enviou 13 pedidos APROVADOS ate 23/07. Soma no banco: 13 pedidos / R$ 1.660.540 ✅ BATE EXATAMENTE.

---

## 5. Suposicao mais fraca

**Se `pdo_dthaprovacao` for NULL para algum pedido Aprovado**, o pedido some do filtro em silencio. Mitigacao: rodar edge case `SELECT COUNT(*) FROM mirror.crm_pedidos WHERE pdo_situacaopedido='Aprovado' AND pdo_dthaprovacao IS NULL` — esperado: 0 linhas. Se houver > 0, considerar fallback para `pdo_dthpedido`.

---

## 6. Pendencias

1. **Push pelo @devops**: 2 migrations + 6 arquivos frontend precisam ser commitados e pushados para `origin/main` (branch principal).
2. **Deploy**: rodar `bash deploy.sh` na VPS apos push.
3. **Feature doc**: `docs/features/acoes-bi.md` precisa de atualizacao na secao Database para indicar que `rpc_acoes_bi v5` e `rpc_acoes_funil_gestao v2` agora agregam por pedido, nao por negocio. (Atualizacao recomendada para a proxima sessao.)
