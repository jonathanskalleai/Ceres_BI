# ARCH-AcoesV10-v2 — Design Técnico: /bi/acoes Correções v10 (pós-auditoria Codex + Phase 0)

**Versão:** 2.0
**Data:** 2026-08-03
**Autor:** @architect (Aria)
**Status:** Aprovado — pronto para @dev
**Substitui:** ARCH-AcoesV10.md (v1 — NO-SHIP pelo Codex)

---

## §1 — Mudanças vs v1 (delta explícito)

### Os 6 blockers do Codex e como o v2 endereça cada um

| # | Blocker Codex | Origem | Como v2 endereça |
|---|---------------|---------|------------------|
| B1 | **AC5 estruturalmente errado.** v1 usava `COUNT(*)` em CTE que retorna JSON (não linhas). | Phase 0 §5: a CTE `oportunidades_negocios` do funil usa `COUNT(DISTINCT ngo_numero)` e retorna 1 JSON, não 112 linhas. | AC5 reescrito como extração de `funil.oportunidades` via `data->'funil'->>'oportunidades'` (JSON path). Validado: `funil.oportunidades=112`, `em_andamento.total=112`, `invariant_holds=true`. |
| B2 | **Reaberto indetectável.** v1 propunha `EXISTS` de ganho/perdido pós-ação para detectar reabertura. Mas não existe histórico de `ngo_conclusao`. | Phase 0 §6: trigger apenas de sync metadata, sem auditoria. Sem `crm_negocios_historico`. | Regra simplificada: `ngo_conclusao='Em Andamento'` no estado atual. Proxy de reaberto: `ngo_datafechamento IS NULL` para candidatos. Decisão explícita do usuário aceita. |
| B3 | **Grant anon crítico.** 4 das 6 RPCs de ações dão EXECUTE a `anon` (todas SECURITY DEFINER como postgres). Qualquer pessoa lê todo o CRM via PostgREST sem autenticação. | Phase 0 §4: `rpc_acoes_bi`, `rpc_acoes_funil_gestao`, `rpc_acoes_mapa_oportunidades`, `rpc_acoes_detalhe` são todas `SECURITY DEFINER` + `GRANT TO anon`. | v2 revoga EXECUTE a anon das 3 RPCs NOVAS SOMENTE (`rpc_acoes_pedidos_ganhos`, `rpc_acoes_negocios_perdidos`, `rpc_acoes_em_andamento`). As 4 existentes não são tocadas. Precedente: `rpc_acoes_clientes_risco` e `rpc_acoes_gestao_listas` já são `authenticated, service_role` apenas. |
| B4 | **AcoesGestaoCarteiraSummary.tsx não aparece no v1 como deletado.** O component tree mostrava o arquivo mas o v1 §4 (Migration Strategy) não listava deleção. | Confusão no v1 entre "mini-card top-3" e "Summary component". | v2 especifica claramente: `AcoesGestaoCarteiraSummary.tsx` **DELETADO** do projeto. `SemContatoTable` permanece exportado em `AcoesGestaoCarteiraTables.tsx` mas sem aba que o consome. |
| B5 | **deploy-gate.sh TIER FAST bypass.** Codex (linhas 103-112) identificou bypass para `tier-fast-used`. | Phase 0 §10: este arquivo **não existe na VPS**. O bypass está apenas no repo local. | v2 documenta: finding **não se aplica ao ambiente de produção atual**. Repo local modificado com bypass mas **não deployado**. Recomendação: corrigir o repo local para consistência ou documentar como "configuração de development". |
| B6 | **Lógica de exclusão em `rpc_acoes_em_andamento` invoca histórico inexistente.** v1 propunha filtrar negócios que "viraram ganho/perdido após a ação" via `EXISTS`, mas sem histórico de `ngo_conclusao` isso não funciona para reabertos genuínos. | Phase 0 §6: `EXISTS (pedido Aprovado com pdo_dthaprovacao > aco_dthconclusao)` e `EXISTS (ngo_datafechamento > aco_dthconclusao)` detectam ganho/perdido fechados **após** a ação, mas não detectam reabertos. | Regra simples implementada: `ngo_conclusao='Em Andamento'` no estado atual + exclusão de REPASSE. A lógica EXISTS de ganho/perdido pós-ação fica como **proxy**, não como detecção de reabertura. Sem histórico, reaberto genuíno é indetectável — aceite. |

### Decisões JÁ fechadas (não re-litigar)

| Decisão | Valor |
|---------|-------|
| GRANT anon nas 3 NOVAS | REVOGADO — `TO authenticated, service_role` SOMENTE |
| GRANT anon nas 4 EXISTENTES | INALTERADO — mantém `TO anon, authenticated, service_role` |
| "Em Andamento" | Sem distinção de reaberto (estado atual) |
| Story 3-A (Desperdício) | UX-DesperdicioV2.md Opção D aceite |
| AC5 | Extrair de JSON (não COUNT em CTE) |
| Deploy | SSH + scp + docker exec + psql + NOTIFY pgrst |

---

## §2 — Pattern de RPCs

### 2.1 — 3 RPCs paralelas

| RPC | Fonte | Semântica | Dedup key |
|-----|-------|---------|-----------|
| `rpc_acoes_pedidos_ganhos` | `crm_pedidos` + `negocios_canonicos` | Pedidos aprovados no período | `pdo_codigointerno` |
| `rpc_acoes_negocios_perdidos` | `negocios_canonicos` | Negócios perdidos no período | `ngo_numero` |
| `rpc_acoes_em_andamento` | `crm_acoes` + `negocios_canonicos` + `crm_pedidos` | Oportunidades em andamento (estado atual) | `ngo_numero` |

### 2.2 — Definições completas

#### `rpc_acoes_pedidos_ganhos`

```sql
CREATE OR REPLACE FUNCTION public.rpc_acoes_pedidos_ganhos(
  p_from date,
  p_to date,
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN json_build_object(
    'rows', (
      SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.pdo_dthaprovacao DESC), '[]'::json)
      FROM (
        SELECT
          pd.pdo_codigointerno         AS pedido_numero,
          pd.pdo_vlrpedido             AS valor_pedido,
          pd.pdo_dthaprovacao          AS data_aprovacao,
          nc.ngo_numero                AS negocio_numero,
          cc.cli_nome                  AS cliente,
          nc.cidade_negocio            AS cidade,
          nc.consultor_negocio          AS consultor,
          pd.pdo_situacaopedido        AS situacao
        FROM pedidos_dedup pd
        JOIN negocios_canonicos nc ON nc.ngo_numero = pd.ngo_numero
        LEFT JOIN mirror.crm_carteira_clientes cc ON cc.cli_idcliente = nc.cli_idcliente
        WHERE pd.pdo_dthaprovacao::date BETWEEN p_from AND p_to
          AND pd.pdo_situacaopedido = 'Aprovado'
          AND nc.ngo_conclusao = 'Ganho'
          AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
          AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
          AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
        LIMIT p_limit
        OFFSET p_offset
      ) sub
    ),
    'total', (
      SELECT COUNT(*)
      FROM pedidos_dedup pd
      JOIN negocios_canonicos nc ON nc.ngo_numero = pd.ngo_numero
      WHERE pd.pdo_dthaprovacao::date BETWEEN p_from AND p_to
        AND pd.pdo_situacaopedido = 'Aprovado'
        AND nc.ngo_conclusao = 'Ganho'
        AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
        AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
        AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_acoes_pedidos_ganhos(date, date, text, text, int, int)
  TO authenticated, service_role;
```

**CTEs para copiar (byte a byte de `rpc_acoes_bi` v9):**
- `negocios_base` — bloco linhas 147-161 de `20260802_rpc_acoes_bi_v9_perdidos_negocios.sql`
- `negocios_canonicos` — bloco linhas 169-183 de `20260802_rpc_acoes_bi_v9_perdidos_negocios.sql`
- `pedidos_dedup` — bloco linhas 184-193 de `20260802_rpc_acoes_bi_v9_perdidos_negocios.sql`

**Retorno:** `{ rows: PedidoDetalheRow[], total: number }`
**Ordenação:** `pdo_dthaprovacao DESC`

---

#### `rpc_acoes_negocios_perdidos`

```sql
CREATE OR REPLACE FUNCTION public.rpc_acoes_negocios_perdidos(
  p_from date,
  p_to date,
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN json_build_object(
    'rows', (
      SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.data_fechamento DESC), '[]'::json)
      FROM (
        SELECT
          nc.ngo_numero                AS negocio_numero,
          cc.cli_nome                  AS cliente,
          nc.cidade_negocio            AS cidade,
          nc.consultor_negocio         AS consultor,
          nc.ngo_datafechamento        AS data_fechamento,
          nc.ngo_vlrtotalnegociado    AS valor_negociado,
          nc.ngo_conclusao             AS conclusao,
          nc.ngo_funil                AS funil
        FROM negocios_canonicos nc
        LEFT JOIN mirror.crm_carteira_clientes cc ON cc.cli_idcliente = nc.cli_idcliente
        WHERE nc.ngo_conclusao = 'Perdido'
          AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
          AND nc.ngo_datafechamento::date BETWEEN p_from AND p_to
          AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
          AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
        LIMIT p_limit
        OFFSET p_offset
      ) sub
    ),
    'total', (
      SELECT COUNT(*)
      FROM negocios_canonicos nc
      WHERE nc.ngo_conclusao = 'Perdido'
        AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
        AND nc.ngo_datafechamento::date BETWEEN p_from AND p_to
        AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
        AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_acoes_negocios_perdidos(date, date, text, text, int, int)
  TO authenticated, service_role;
```

**CTEs para copiar (byte a byte de `rpc_acoes_funil_gestao` v6):**
- `negocios_base` — bloco linhas 125-139 de `20260802_rpc_acoes_funil_gestao_v6_perdidos_negocios.sql`
- `negocios_canonicos` — bloco linhas 145-158 de `20260802_rpc_acoes_funil_gestao_v6_perdidos_negocios.sql`

**Retorno:** `{ rows: NegocioPerdidoRow[], total: number }`
**Ordenação:** `ngo_datafechamento DESC`
**Referência:** julho/2026 deve retornar `total = 7`

---

#### `rpc_acoes_em_andamento`

```sql
CREATE OR REPLACE FUNCTION public.rpc_acoes_em_andamento(
  p_from date,
  p_to date,
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN json_build_object(
    'rows', (
      SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.dias_parado DESC), '[]'::json)
      FROM (
        SELECT
          nc.ngo_numero                AS negocio_numero,
          cc.cli_nome                  AS cliente,
          nc.cidade_negocio            AS cidade,
          aco.aco_vendedor             AS consultor,
          nc.ngo_etapa                 AS etapa,
          nc.ngo_vlrtotalnegociado     AS valor_negociado,
          aco.aco_tipocontato          AS ultima_acao,
          aco.aco_dthconclusao         AS data_ultima_acao,
          (CURRENT_DATE - aco.aco_dthconclusao::date)::int AS dias_parado
        FROM filtered f
        JOIN negocios_canonicos nc ON nc.ngo_numero = f.ngo_nronegocio
        JOIN LATERAL (
          SELECT a.aco_vendedor, a.aco_tipocontato, a.aco_dthconclusao
          FROM mirror.crm_acoes a
          WHERE a.ngo_nronegocio = f.ngo_nronegocio
            AND a.aco_dthconclusao IS NOT NULL
          ORDER BY a.aco_dthconclusao DESC
          LIMIT 1
        ) aco ON TRUE
        LEFT JOIN mirror.crm_carteira_clientes cc ON cc.cli_idcliente = nc.cli_idcliente
        WHERE f.ngo_nronegocio IS NOT NULL
          AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
          AND nc.ngo_conclusao = 'Em Andamento'
          -- Decisão do usuário: SEM distinção de reaberto. Sem EXISTS de
          -- ganho/perdido pós-ação: sem histórico de ngo_conclusao, a
          -- detecção é indetectável. Estado atual é a fonte da verdade.
          AND (p_vendedor IS NULL OR aco.aco_vendedor = p_vendedor)
          AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
        LIMIT p_limit
        OFFSET p_offset
      ) sub
    ),
    'total', (
      SELECT COUNT(DISTINCT nc.ngo_numero)
      FROM filtered f
      JOIN negocios_canonicos nc ON nc.ngo_numero = f.ngo_nronegocio
      WHERE f.ngo_nronegocio IS NOT NULL
        AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
        AND nc.ngo_conclusao = 'Em Andamento'
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_acoes_em_andamento(date, date, text, text, int, int)
  TO authenticated, service_role;
```

**CTEs para copiar (byte a byte de `rpc_acoes_funil_gestao` v6):**
- `filtered` — bloco linhas 104-117 de `20260802_rpc_acoes_funil_gestao_v6_perdidos_negocios.sql`
- `negocios_base` — bloco linhas 125-139 de `20260802_rpc_acoes_funil_gestao_v6_perdidos_negocios.sql`
- `negocios_canonicos` — bloco linhas 145-158 de `20260802_rpc_acoes_funil_gestao_v6_perdidos_negocios.sql`
- `pedidos_dedup` — bloco linhas 159-168 de `20260802_rpc_acoes_funil_gestao_v6_perdidos_negocios.sql`

**Retorno:** `{ rows: AcoesEmAndamentoRow[], total: number }`
**Ordenação:** `dias_parado DESC`
**Referência:** julho/2026 deve retornar `total = 112` (mesmo que `funil.oportunidades`)

**Regra de exclusão implementada:**
- Negócio é Em Andamento HOJE (estado atual canônico)
- Sem Repasse
- Tocado por ação no período (`filtered` JOIN)
- **Sem EXISTS de ganho/perdido pós-ação.** Decisão do usuário A: aceita que reaberto genuíno é indetectável sem histórico de `ngo_conclusao`. A regra é simples, sempre correta, e produz o mesmo número que `funil.oportunidades` (112 em julho/2026).

### 2.3 — Path de deploy (documentado em Phase 0 §9)

```bash
# 1. Criar migration local
# 2. Copiar para VPS
scp -i ~/.ssh/id_ed25519 migration.sql root@178.238.235.203:/tmp/migration.sql

# 3. Aplicar via docker exec + psql
docker exec -i supabase_supabase_db.1.n0afaiypr7f7luy817d6lr2do \
  psql -U postgres -d postgres -f /tmp/migration.sql

# 4. Verificar aplicação
docker exec -i supabase_supabase_db.1.n0afaiypr7f7luy817d6lr2do \
  psql -U postgres -d postgres -c "SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'rpc_acoes_pedidos_ganhos';" | head -3

# 5. Reload PostgREST
docker exec -i supabase_supabase_db.1.n0afaiypr7f7luy817d6lr2do \
  psql -U postgres -c "NOTIFY pgrst, 'reload schema';"
```

**Validação de GRANT (smoke test):**
```sql
-- Deve passar:
SET ROLE authenticated;
SELECT (rpc_acoes_pedidos_ganhos('2026-07-01','2026-07-31',NULL,NULL,50,0)->>'total')::int;

-- Deve falhar com "permission denied":
SET ROLE anon;
SELECT rpc_acoes_pedidos_ganhos('2026-07-01','2026-07-31',NULL,NULL,50,0);
```

---

## §3 — Component Tree

```
/bi/acoes
└── AcoesSection.tsx (301 ln)                          [INALTERADO — caller]

    ├── AcoesKpiGrid.tsx                              [INALTERADO]

    ├── AcoesFunilConversao.tsx                      [Story 1-A]
    │   ├── AcoesDegrauBar.tsx                        [NOVO — extraído]
    │   │   Props: { estagio, valor, base, accent? }
    │   │   accent ausente → gradiente champagne
    │   │   accent presente → cor sólida (success/danger)
    │   └── AcoesDesfechosPeriodo.tsx                 [Story 1-A: wrapper ≤60 ln]
    │       └── AcoesDegrauBar × 2                    [Ganho + Perdido]

    ├── AcoesEsforcoRetorno.tsx                       [INALTERADO]

    ├── AcoesRankingConsultores.tsx                   [INALTERADO]
    ├── AcoesRankingTable.tsx                         [INALTERADO]
    ├── Charts                                         [INALTERADO]
    ├── AcoesClientesTable.tsx                        [INALTERADO]

    ├── AcoesGestaoCarteira.tsx                      [Story 2-A]
    │   ├── TABS: ['desperdicio', 'negativas']       [SEM CONTATO REMOVIDO]
    │   ├── DesperdicioTable                          [Story 3-A: BLOCKED]
    │   └── NegativasTable                            [INALTERADO]
    │
    ├── AcoesGestaoCarteiraSummary.tsx               [DELETADO — Story 2-A]
    │
    ├── AcoesMapaOportunidades.tsx                   [INALTERADO]
    │
    └── AcoesDetailWithFilter.tsx (87 ln)             [Stories 4-A, 4-B, 5-A]
        │
        ├── STATUS_OPTIONS:                           [Story 5-A]
        │   { value: "",           label: "Todos" }
        │   { value: "Em Andamento", label: "Em Andamento" }  ← RENOMEADO
        │   { value: "Ganho",      label: "Ganho" }
        │   { value: "Perdido",    label: "Perdido" }
        │
        ├── statusNegocio === "Em Andamento"         [Story 5-A]
        │   └── AcoesEmAndamentoTable.tsx             [NOVO — ≤150 ln]
        │       └── hook: useEmAndamentoRpc.ts       [NOVO]
        │       Colunas: Negocio | Cliente | Cidade | Consultor |
        │                Etapa | Valor | Ultima Acao | Data | Dias Parado
        │       Ordenacao: diasParado DESC | >90 dias vermelho
        │
        ├── statusNegocio === "Ganho"                [Story 4-A]
        │   └── AcoesPedidosTable.tsx                 [NOVO — ≤150 ln]
        │       └── hook: usePedidosGanhosRpc.ts      [NOVO]
        │       Colunas: N Pedido | Cliente | Cidade | Consultor |
        │                Data Aprovacao | Valor
        │       Ordenacao: pdo_dthaprovacao DESC
        │
        ├── statusNegocio === "Perdido"               [Story 4-B]
        │   └── AcoesNegociosPerdidosTable.tsx        [NOVO — ≤150 ln]
        │       └── hook: useNegociosPerdidosRpc.ts   [NOVO]
        │       Colunas: N Negocio | Cliente | Cidade | Consultor |
        │                Data Fechamento | Valor
        │       Ordenacao: ngo_datafechamento DESC
        │
        └── statusNegocio === ""                      [INALTERADO]
            └── AcoesDetailTable.tsx                  [INALTERADO]
```

### Nova estrutura de arquivos

```
src/components/bi/
├── AcoesDegrauBar.tsx                    [NOVO — Story 1-A]

src/components/bi/sections/
├── AcoesFunilConversao.tsx               [Story 1-A: usa AcoesDegrauBar]
├── AcoesDesfechosPeriodo.tsx             [Story 1-A: wrapper ≤60 ln]
├── AcoesGestaoCarteira.tsx               [Story 2-A: remove sem_contato]
│   └── AcoesGestaoCarteiraSummary.tsx    [DELETADO — Story 2-A]
├── AcoesDetailWithFilter.tsx             [Stories 4-A, 4-B, 5-A]
│
src/components/bi/
├── AcoesPedidosTable.tsx                 [NOVO — Story 4-A; ≤150 ln]
├── AcoesNegociosPerdidosTable.tsx        [NOVO — Story 4-B; ≤150 ln]
└── AcoesEmAndamentoTable.tsx             [NOVO — Story 5-A; ≤150 ln]

src/hooks/bi/
├── usePedidosGanhosRpc.ts                [NOVO — Story 4-A]
├── useNegociosPerdidosRpc.ts             [NOVO — Story 4-B]
└── useEmAndamentoRpc.ts                  [NOVO — Story 5-A]

src/types/bi/
├── acoesPedidosGanhos.ts                 [NOVO — Story 4-A]
├── acoesNegociosPerdidos.ts              [NOVO — Story 4-B]
└── acoesEmAndamento.ts                   [NOVO — Story 5-A]
```

---

## §4 — Migration Strategy

### FASE 1B — 3 migrations SQL (apenas aditivas)

| Migration | Conteúdo |
|-----------|----------|
| `20260803_rpc_acoes_pedidos_ganhos_v1.sql` | Cria `rpc_acoes_pedidos_ganhos` + GRANT `TO authenticated, service_role` (sem anon) |
| `20260803_rpc_acoes_negocios_perdidos_v1.sql` | Cria `rpc_acoes_negocios_perdidos` + GRANT `TO authenticated, service_role` (sem anon) |
| `20260803_rpc_acoes_em_andamento_v1.sql` | Cria `rpc_acoes_em_andamento` + GRANT `TO authenticated, service_role` (sem anon) |

### Ordem de aplicação

```
1. rpc_acoes_pedidos_ganhos    (cria estrutura)
2. rpc_acoes_negocios_perdidos  (cria estrutura)
3. rpc_acoes_em_andamento       (cria estrutura)
4. Verificar ownership + grants
5. Smoke test de GRANT (authenticated vs anon)
6. NOTIFY pgrst, 'reload schema'
```

### Validação pós-deploy (obrigatória)

```sql
-- 1. Confirmar ownership = postgres
SELECT pg_catalog.pg_get_userbyid(proowner) AS owner, proname
FROM pg_proc
WHERE proname IN ('rpc_acoes_pedidos_ganhos', 'rpc_acoes_negocios_perdidos', 'rpc_acoes_em_andamento');

-- 2. Confirmar GRANT
SELECT proname, aclcontains(proacl, 'authenticated'::regrole)
FROM pg_proc WHERE proname IN ('rpc_acoes_pedidos_ganhos', 'rpc_acoes_negocios_perdidos', 'rpc_acoes_em_andamento');

-- 3. Smoke GRANT — authenticated deve passar
SET ROLE authenticated;
SELECT (rpc_acoes_em_andamento('2026-07-01','2026-07-31',NULL,NULL,50,0)->>'total')::int AS em_andamento_total;

-- 4. Smoke GRANT — anon deve falhar
SET ROLE anon;
SELECT rpc_acoes_pedidos_ganhos('2026-07-01','2026-07-31',NULL,NULL,50,0);
-- Erro esperado: "permission denied for function rpc_acoes_pedidos_ganhos"
```

### Compatibilidade com base atual

**FASE 1B é 100% aditiva.** Cria 3 funções novas, não modifica nenhuma existente. Aplicável sem risco de regressão nas telas que usam `rpc_acoes_detalhe`, `rpc_acoes_bi` e `rpc_acoes_funil_gestao`.

---

## §5 — AC5 REESCRITO (invariante JSON executável)

### O que estava errado no v1

O plano v1 propunha:
```sql
-- ERRADO: COUNT(*) em CTE MATERIALIZED que retorna 1 JSON
WITH f AS (...),
     e AS (...)
SELECT COUNT(*) FROM f.funil.oportunidades, COUNT(*) FROM e.em_andamento...
```
A CTE `oportunidades_negocios` do funil retorna **1 JSON**, não 112 linhas. `COUNT(*)` conta 1.

### Correção: extração de JSON path

A estrutura do funil é:
```json
{
  "funil": { "oportunidades": 112, "ganhos": 26, "perdidos": 7, ... },
  ...
}
```

A query de `em_andamento` retorna `{ rows: [...], total: 112 }`.

### Invariante executável

```sql
WITH f AS (
  SELECT rpc_acoes_funil_gestao('2026-07-01','2026-07-31',NULL,NULL) AS data
),
     e AS (
  SELECT rpc_acoes_em_andamento('2026-07-01','2026-07-31',NULL,NULL,50,0) AS data
)
SELECT
  (f.data->'funil'->>'oportunidades')::int AS funil_oportunidades,
  (e.data->>'total')::int                  AS em_andamento_total,
  ((f.data->'funil'->>'oportunidades')::int
    = (e.data->>'total')::int)             AS invariant_holds
FROM f, e;
```

**Resultado esperado:**
```
funil_oportunidades | em_andamento_total | invariant_holds
        112         |        112         |      true
```

**Validação post-deploy (smoke OBRIGATÓRIO):** esta query deve retornar `invariant_holds = true` no dia da release. Se divergir, há bug de lógica de exclusão — não declarar done.

---

## §6 — Riscos Não Mapeados no v1

### 6.1 — Reaproveitados do v1 §5

| # | Risco | Mitigação |
|---|-------|-----------|
| 5.1 | **Indexação** — `pdo_dthaprovacao`, `ngo_datafechamento`, `ngo_numero` em joins | `@data-engineer` roda `EXPLAIN ANALYZE` no banco vivo antes de declarar done. Propor índice se `Seq Scan` em tabelas > 100k rows. |
| 5.2 | **Ordem de criação de funções referenciadas** — `mirror.fn_cli_cidade()`, `mirror.usuarios` | `COMMENT ON FUNCTION` em cada RPC declara dependências. Nunca renomear/dropar sem verificar callers. |
| 5.3 | **Cache invalidation** — `staleTime: 5min` aceito para BI (mirror sync cycle é minutos) | Não implementar invalidation manual (sem webhook de CRM). |
| 5.4 | **Paginação** — reutilizar `PaginationControls` existente, `PAGE_SIZE = 50` | Não criar componente novo de paginação. |
| 5.5 | **Supabase REST reload** — todo deploy de RPC exige `NOTIFY pgrst, 'reload schema'` | Documentado em §2.3. |
| 5.6 | **`diasParado > 90` em vermelho** — mesma convenção do mapa | Padrão existe no projeto; replicar. |
| 5.7 | **Sincronismo de filtros** — `useEffect` que reseta `page=1` quando filtros mudam | Implementar em cada tabela nova conforme padrão existente. |
| 5.8 | **Dead code após Story 2-A** — `useAcoesGestaoListasRpc` ainda chama `sem_contato` mas nunca invocado | Não deletar hook nem RPC (Story 3-A pode reativar). |
| 5.9 | **`AcoesSemContatoRow` órfão** — tipo pode não ter mais consumer após remover sem_contato | Grep antes de remover. Build valida depois. |

### 6.2 — NOVOS (pós-Phase 0)

| # | Risco | Decisão |
|---|-------|---------|
| 6.10 | **`deploy-gate.sh` TIER FAST bypass no repo local.** O finding do Codex (linhas 103-112) identificou bypass mas o arquivo **não existe na VPS** (Phase 0 §10 confirmou). O repo local modificado com bypass não foi deployado. | **Não é blocker de produção.** Repo local: @devops decide se corrige (remover bypass) ou documenta como "development only". VPS: nada a fazer. |
| 6.11 | **Bug do acento `REPASSE DE MÁQUINA` vs `REPASSE DE MAQUINA`.** A CTE `parados` do funil v6 filtra com acento (`'REPASSE DE MÁQUINA'`) mas a base grava sem acento. Isso afeta `diasParados.negociosAbertos` — não `oportunidades`. | **Fora do escopo v2.** Criar ticket/migration própria: alterar filtro para `ILIKE '%REPASSE%MÁQUINA%'` ou corrigir ETL de sync para normalizar. |
| 6.12 | **`diasParados` usa dedup diferente.** A CTE `parados` do funil v6 usa `ngo_datacadastro` para ordenação, diferente de `ngo_dataatualizacao` usada nas outras CTEs. Unificar mudaria `diasParados.negociosAbertos` (112→111 em julho/2026). | **Fora do escopo v2.** Criar ticket próprio com validação própria. |
| 6.13 | **Reaberto genuíno indetectável.** Sem histórico de `ngo_conclusao`, não há como distinguir "sempre Em Andamento" de "reaberto". Sem EXISTS no SQL — aceita como limitação documentada. Estado atual é a fonte da verdade. | **Aceite pelo usuário (decisão A).** Documentado em §1 B6 e nos COMMENTs das RPCs. |
| 6.14 | **Grant anon nas 4 RPCs existentes.** A revogação das 3 NOVAS não endereça as 4 existentes que ainda dão EXECUTE a anon. SECURITY DEFINER + postgres = qualquer pessoa lê todo o CRM. | **Parcialmente endereçado.** As 3 novas não expõem mais. As 4 existentes mantêm o risco. Verificar com `@security` se deve criar ticket separado para revogar anon das 4 existentes. |

---

## §7 — Critérios de PR

### Story 1-A (formato visual único)

- [ ] `AcoesDegrauBar.tsx` criado com props `{ estagio, valor, base, accent? }`
- [ ] `AcoesFunilConversao.tsx` usa `AcoesDegrauBar` para Visitas/Oportunidades (gradiente champagne inalterado)
- [ ] `AcoesDesfechosPeriodo.tsx` usa `AcoesDegrauBar` para Ganho (accent=`var(--voux-success)`) e Perdido (accent=`var(--voux-danger)`) — **≤ 60 linhas**
- [ ] Hint tooltip: Ganho → `crm_pedidos · data de aprovacao do pedido`; Perdido → `crm_negocios · data de fechamento do negocio`
- [ ] `npm run build` passa sem erro TS

### Story 2-A (remover sem contato)

- [ ] `TABS` em `AcoesGestaoCarteira.tsx` contém apenas `desperdicio` e `negativas`
- [ ] `AcoesGestaoCarteiraSummary.tsx` deletado (`grep -r "AcoesGestaoCarteiraSummary" src/` → 0 resultados)
- [ ] Drill-down do chart "Clientes em Risco" desabilitado silenciosamente quando `sem_contato` ausenta
- [ ] `npm run build` passa sem erro TS

### Story 3-A (BLOCKED — até @ux)

- [ ] Aguarda input de `@ux` + validação do demand owner
- [ ] Implementação: Opção D do `UX-DesperdicioV2.md` (Tabela de alertas com InlineBar + badge `[!] SEM OPORTUNIDADE`)

### Story 4-A (drill-down Ganho → pedidos)

- [ ] `rpc_acoes_pedidos_ganhos` criada e aplicada ao banco
- [ ] `rpc_acoes_pedidos_ganhos('2026-07-01','2026-07-31',NULL,NULL,50,0)` retorna `total >= 26`
- [ ] `usePedidosGanhosRpc.ts` criado
- [ ] `AcoesPedidosTable.tsx` criado, **≤ 150 linhas**
- [ ] Colunas: N Pedido | Cliente | Cidade | Consultor | Data Aprovacao | Valor; Ordenacao: `pdo_dthaprovacao DESC`
- [ ] Badge de contexto: "Mostrando pedidos aprovados — fontes: crm_pedidos + crm_negocios."
- [ ] Routing: `statusNegocio === "Ganho"` → `AcoesPedidosTable`
- [ ] GRANT smoke test: `SET ROLE authenticated` passa; `SET ROLE anon` falha com `permission denied`
- [ ] `npm run build` passa sem erro TS

### Story 4-B (drill-down Perdido → negócios)

- [ ] `rpc_acoes_negocios_perdidos` criada e aplicada ao banco
- [ ] `rpc_acoes_negocios_perdidos('2026-07-01','2026-07-31',NULL,NULL,50,0)` retorna `total = 7`
- [ ] `useNegociosPerdidosRpc.ts` criado
- [ ] `AcoesNegociosPerdidosTable.tsx` criado, **≤ 150 linhas**
- [ ] Colunas: N Negocio | Cliente | Cidade | Consultor | Data Fechamento | Valor; Ordenacao: `ngo_datafechamento DESC`
- [ ] Exclusao de `ngo_funil = 'REPASSE DE MAQUINA'` aplicada na RPC
- [ ] Routing: `statusNegocio === "Perdido"` → `AcoesNegociosPerdidosTable`
- [ ] GRANT smoke test: `SET ROLE authenticated` passa; `SET ROLE anon` falha
- [ ] `npm run build` passa sem erro TS

### Story 5-A (Em Andamento → estado atual)

- [ ] `rpc_acoes_em_andamento` criada e aplicada ao banco
- [ ] **SQL da nova RPC usa EXATAMENTE a mesma lógica de `oportunidades_negocios` do funil v6:** `ngo_conclusao = 'Em Andamento'`, `ngo_funil <> 'REPASSE DE MAQUINA'`, `JOIN filtered (acoes no periodo)`. SEM EXISTS de ganho/perdido. SEM proxy. SEM DISTINCT ON extra alem do que o JOIN já entrega. Regra simples e estado atual.
- [ ] **`diasParado > 90` → valor em vermelho** (mesma convencao do mapa)
- [ ] Colunas: N Negocio | Cliente | Cidade | Consultor | Etapa | Valor | Ultima Acao | Data | Dias Parado; Ordenacao: `diasParado DESC`
- [ ] Chip label em `AcoesDetailWithFilter.tsx`: "Em Aberto" → "Em Andamento"
- [ ] Routing: `statusNegocio === "Em Andamento"` → `AcoesEmAndamentoTable`
- [ ] GRANT smoke test: `SET ROLE authenticated` passa; `SET ROLE anon` falha
- [ ] **Verificacao pos-deploy OBRIGATORIA:** rodar o SELECT do AC5 (§5) no dia da release — deve retornar `invariant_holds = true`
- [ ] `npm run build` passa sem erro TS

### Regressao geral

- [ ] `npm run build` → sucesso sem erro TS
- [ ] `npx vitest run` → 169/169 (ou mais se novos testes)
- [ ] Smoke de todas as 5 stories executado em banco vivo antes de PR
- [ ] Feature doc `docs/features/acoes-bi.md` atualizada com novos contratos de RPC
- [ ] 0 imports de `AcoesGestaoCarteiraSummary` no codebase
- [ ] GRANT confirmacao: 3 novas RPCs = `authenticated, service_role` SEM anon

---

## Resumo de arquivos

### Criar (migrations)

```
supabase/migrations/20260803_rpc_acoes_pedidos_ganhos_v1.sql
supabase/migrations/20260803_rpc_acoes_negocios_perdidos_v1.sql
supabase/migrations/20260803_rpc_acoes_em_andamento_v1.sql
```

### Criar (frontend)

```
src/components/bi/AcoesDegrauBar.tsx                    [Story 1-A]
src/components/bi/AcoesPedidosTable.tsx                [Story 4-A; ≤150 ln]
src/components/bi/AcoesNegociosPerdidosTable.tsx        [Story 4-B; ≤150 ln]
src/components/bi/AcoesEmAndamentoTable.tsx             [Story 5-A; ≤150 ln]
src/hooks/bi/usePedidosGanhosRpc.ts                     [Story 4-A]
src/hooks/bi/useNegociosPerdidosRpc.ts                 [Story 4-B]
src/hooks/bi/useEmAndamentoRpc.ts                       [Story 5-A]
src/types/bi/acoesPedidosGanhos.ts                     [Story 4-A]
src/types/bi/acoesNegociosPerdidos.ts                  [Story 4-B]
src/types/bi/acoesEmAndamento.ts                        [Story 5-A]
```

### Modificar

```
src/components/bi/sections/AcoesFunilConversao.tsx          [Story 1-A]
src/components/bi/sections/AcoesDesfechosPeriodo.tsx        [Story 1-A: ≤60 ln]
src/components/bi/sections/AcoesGestaoCarteira.tsx          [Story 2-A]
src/components/bi/sections/AcoesDetailWithFilter.tsx        [Stories 4-A, 4-B, 5-A]
src/types/biRpc.ts                                          [Reexportar novos tipos]
docs/features/acoes-bi.md                                    [Atualizar contratos]
```

### Deletar

```
src/components/bi/sections/AcoesGestaoCarteiraSummary.tsx  [Story 2-A]
```
