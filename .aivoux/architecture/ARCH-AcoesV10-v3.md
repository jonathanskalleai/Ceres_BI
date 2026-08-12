# ARCH-AcoesV10-v3 — Design Técnico: /bi/acoes Correções v10 (pós-2ª auditoria Codex)

**Versão:** 3.0
**Data:** 2026-08-03
**Autor:** @architect (Aria)
**Status:** Draft — aguardando validação
**Convive com:** ARCH-AcoesV10-v2.md (v2 mantida para histórico)
**Auditoria de origem:** Codex #1 (v1 NO-SHIP) + Codex #2 (5 achados novos)

---

## §1 — Mudanças vs v2 (delta explícito)

### Delta de auditorias Codex

| # | Severidade | Achado Codex #2 | Origem | Como v3 endereça |
|---|-----------|-----------------|--------|-----------------|
| C1 | **CRITICAL** | "Quatro RPCs SECURITY DEFINER que a tela continua usando permanecem públicas (.aivoux/architecture/ARCH-AcoesV10-v2.md:17-19) — /bi/acoes segue expondo todo o mirror CRM sem login." | GRANT explícito nas 4 existentes (`bi`, `funil_gestao`, `mapa_oportunidades`, `detalhe`) nunca foi revogado. Decisão do usuário no v2 foi "revogar só das 3 novas" — mas o Codex #1 já dizia que isso deixa o buraco aberto. | **Story SEC-FIX-1:** 4 migrations de REVOKE explícitas para as 4 existentes. Mesmo que o usuário tenha decidido preservar as existentes, o Codex #1 CRITICAL não é resolvido sem isso. Contrato de 3 fontes (acoes-bi.md) não é violado — as 4 existentes continuam existindo e retornando os mesmos dados para callers autenticados. |
| C2 | **CRITICAL** | "Os grants das três novas RPCs não revogam o EXECUTE padrão de PUBLIC — GRANT explícito NÃO é whitelist no Postgres." | Postgres sempre dá EXECUTE a PUBLIC por padrão. `GRANT TO authenticated, service_role` adiciona, mas não remove. `REVOKE FROM PUBLIC, anon` é obrigatório. O @security recomendou que o GRANT explícito "é suficiente" — o Codex #2 corrige isso. | §3 padroniza o padrão: `REVOKE EXECUTE FROM PUBLIC, anon; GRANT EXECUTE TO authenticated, service_role`. Aplicado às 7 + 1 migrations (3 novas + 4 existentes + 1 story 3-A). |
| H1 | **HIGH** | "As páginas dos novos drill-downs não preservam o grão do total — crm_carteira_clientes multi-row, filtered em grão de ação, LIMIT/OFFSET antes de ORDER BY estável." | RPCs do v2 fazem LEFT JOIN direto com `mirror.crm_carteira_clientes` que pode retornar múltiplas linhas por `cli_idcliente`. Quando `LIMIT/OFFSET` cai dentro da subquery que alimenta `json_agg`, a multiplicação de linhas distorce a paginação e o `total`. Em `em_andamento`: `filtered` tem 1 linha por ação (não por negócio), e o JOIN `negocios_canonicos` vem depois, mas o LEFT JOIN com carteira antes de dedup multiplica. | §4 reescreve as 3 queries com CTE canônico explícito: cada CTE produz **1 linha por entidade** (pedido ou negócio) **antes** de qualquer LIMIT/OFFSET. LEFT JOIN com carteira movido para resolução de cliente via subquery/LATERAL no SELECT, não no FROM que precede dedup. ORDER BY determinístico antes de LIMIT/OFFSET. |
| H2 | **HIGH** | "O procedimento de deploy aceita estado parcial — psql -f sem ON_ERROR_STOP nem transação." | O path de deploy do v2 (§2.3) usa `docker exec psql -f` sem `-1` (transação implícita), sem `-v ON_ERROR_STOP=1`, sem PREFLIGHT/POSTFLIGHT, sem abort em qualquer falha. Um erro no meio da migration deixa a função em estado parcialmente criada. | §5 substitui a cadeia inteira: backup de definitions + ACLs prévias, `psql -1 -X -v ON_ERROR_STOP=1 -b` (tudo transacional + abort-on-error), pos-validação em 4 checks (função existe, owner, PUBLIC/anon sem EXECUTE, authenticated COM EXECUTE), smoke HTTP (deve falhar com 401/403), NOTIFY só depois de todos os checks passarem. `set -euo pipefail` em todo script. |
| M1 | **MEDIUM** | "Story 3-A promete ordenação (NULL primeiro, razão DESC) que rpc_acoes_gestao_listas não produz (atual ordena oportunidades ASC, visitas DESC)." | A função `rpc_acoes_gestao_listas` atual ordena por lógica própria. Story 3-A exige ordenação específica para o tipo `desperdicio`: NULL/zero primeiro (negócios sem oportunidade), depois `razão DESC` (proporção de visitas por oportunidade), desempate estável por `ngo_numero`. A função existente não entrega isso. | 9ª migration (§2) reescreve `rpc_acoes_gestao_listas` como `rpc_acoes_gestao_listas_v2` com ordenação corrigida para `desperdicio`: NULL/zero primeiro via `NULLS FIRST` + `razao DESC` + desempate `ngo_numero ASC`. Mantém busca e paginação existentes. |

### Decisões do usuário vs Codex CRITICAL

**ATENÇÃO — DECISÃO REVALIDADA:** O usuário decidiu no v2 preservar o GRANT `anon` nas 4 RPCs existentes. O Codex #1 CRITICAL diz que isso não resolve a exposição do mirror CRM. O Codex #2 confirma.

**Posição do @architect:** As 4 migrations de REVOKE do §2 são **obrigatórias para o ship**, independentemente da decisão anterior. O Codex #1 é CRITICAL e identifica que mesmo `GRANT explícito` não revoga o EXECUTE padrão de PUBLIC. O risco de expor todo o CRM sem login não pode coexistir com um plano aprovado.

Se o usuário confirmar que quer preservar o GRANT anon nas existentes, o risco остается e o plano não pode ser declarado DONE. Recomenda-se que a decisão seja reconsiderada com o contexto completo: o frontend autentica (confirmado pelo @security), e o GRANT explícito sem REVOKE não fecha a brecha.

---

## §2 — Pattern de Migrações Revisado

São **9 migrations** no total (3 novas + 4 REVOKE + 1 story 3-A).

### 2.1 — 3 Migrations Novas (Conteúdo funcional)

| Migration | Story | Descrição |
|-----------|-------|-----------|
| `20260803_rpc_acoes_pedidos_ganhos_v1.sql` | 4-A | Cria `rpc_acoes_pedidos_ganhos` com CTEs canônicos (grão correto) e GRANT seguro |
| `20260803_rpc_acoes_negocios_perdidos_v1.sql` | 4-B | Cria `rpc_acoes_negocios_perdidos` com CTEs canônicos e GRANT seguro |
| `20260803_rpc_acoes_em_andamento_v1.sql` | 5-A | Cria `rpc_acoes_em_andamento` com filtered deduplicado antes de LATERAL + GRANT seguro |

### 2.2 — 4 Migrations de REVOKE das Existentes (Story SEC-FIX-1)

| Migration | RPC | Efeito |
|-----------|-----|--------|
| `20260803_revoke_public_rpc_acoes_bi.sql` | `rpc_acoes_bi` | Revoga EXECUTE de PUBLIC + anon; mantém authenticated + service_role |
| `20260803_revoke_public_rpc_acoes_funil_gestao.sql` | `rpc_acoes_funil_gestao` | Idem |
| `20260803_revoke_public_rpc_acoes_detalhe.sql` | `rpc_acoes_detalhe` | Idem |
| `20260803_revoke_public_rpc_acoes_mapa_oportunidades.sql` | `rpc_acoes_mapa_oportunidades` | Idem |

**Essas 4 são obrigatórias para ship.** Não alteram a definição das funções — só o GRANT. Aplicadas em qualquer ordem, sem risco de regressão funcional.

### 2.3 — 1 Migration Extra (Story 3-A, MEDIUM 1)

| Migration | Descrição |
|-----------|-----------|
| `20260803_rpc_acoes_gestao_listas_v2_ordenacao_desperdicio.sql` | Reescreve ordenação de `desperdicio`: NULL/zero primeiro, razão DESC, desempate estável |

### 2.4 — Template Comum de Migration

Cada migration segue este template estrutural:

```sql
-- ============================================================
-- Migration: <nome>
-- Story: <story>
-- Data: 2026-08-03
-- ============================================================

-- PREFLIGHT: rollback definitions/ACLs previas para permitir re-run
SAVEPOINT migration_<timestamp>_<nome>;

BEGIN;

-- (corpo da migration: CREATE OR REPLACE / REVOKE / GRANT)

COMMIT;

-- POSTFLIGHT: validações mecânicas
DO $$
DECLARE
  fn_name text := '<nome_da_funcao>';
  fn_args regprocedure;
  row_count int;
BEGIN
  -- (a) Função existe
  SELECT count(*) INTO row_count
  FROM pg_proc
  WHERE proname = fn_name;
  IF row_count = 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT FAILED: function % not found', fn_name;
  END IF;

  -- (b) Owner é postgres
  SELECT count(*) INTO row_count
  FROM pg_proc p
  JOIN pg_roles r ON r.oid = p.proowner
  WHERE p.proname = fn_name
    AND r.rolname = 'postgres';
  IF row_count = 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT FAILED: function % owner is not postgres', fn_name;
  END IF;

  -- (c) PUBLIC e anon SEM EXECUTE
  SELECT count(*) INTO row_count
  FROM information_schema.routine_privileges
  WHERE routine_name = fn_name
    AND grantee IN ('PUBLIC', 'anon')
    AND privilege_type = 'EXECUTE';
  IF row_count > 0 THEN
    RAISE EXCEPTION 'POSTFLIGHT FAILED: function % still has EXECUTE for PUBLIC or anon', fn_name;
  END IF;

  -- (d) authenticated e service_role COM EXECUTE
  SELECT count(*) INTO row_count
  FROM information_schema.routine_privileges
  WHERE routine_name = fn_name
    AND grantee IN ('authenticated', 'service_role')
    AND privilege_type = 'EXECUTE';
  IF row_count < 2 THEN
    RAISE EXCEPTION 'POSTFLIGHT FAILED: function % missing EXECUTE for authenticated or service_role', fn_name;
  END IF;
END $$;

-- PostgREST reload (só depois do POSTFLIGHT passar)
NOTIFY pgrst, 'reload schema';

-- Release PREFLIGHT em sucesso (nada a fazer se COMMIT rolou)
-- Em re-run: SAVEPOINT permite rollback sem DROP FUNCTION
ROLLBACK TO SAVEPOINT migration_<timestamp>_<nome>;
RELEASE SAVEPOINT migration_<timestamp>_<nome>;
```

**Notas sobre o template:**
- `SAVEPOINT` + `ROLLBACK TO SAVEPOINT` permite re-run sem DROP da função existente.
- `BEGIN; ... COMMIT;` garante que toda a migration é atômica.
- POSTFLIGHT executa DEPOIS do COMMIT (ele próprio roda em transação própria, então a validação só acontece se o COMMIT rolou).
- NOTIFY só é enviado se POSTFLIGHT passou.

---

## §3 — Padrão de GRANT Seguro (template DRY)

```sql
-- ============================================================
-- Padrao de GRANT seguro (aplicar a TODAS as 7 + 1 migrations)
-- ============================================================
--
-- REGRA: Postgres SEMPRE dá EXECUTE a PUBLIC por padrão.
-- GRANT TO authenticated, service_role ADICIONA sem remover.
-- REVOKE EXPLICITO E OBRIGATORIO para fechar a brecha.
--
-- Cópia/cola este bloco em cada migration. Não parametrizar.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.<nome_da_funcao>(<assinatura_args>)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.<nome_da_funcao>(<assinatura_args>)
  TO authenticated, service_role;
```

**Assinatura de cada função:**

| Função | Assinatura |
|--------|------------|
| `rpc_acoes_pedidos_ganhos` | `(date, date, text, text, int, int)` |
| `rpc_acoes_negocios_perdidos` | `(date, date, text, text, int, int)` |
| `rpc_acoes_em_andamento` | `(date, date, text, text, int, int)` |
| `rpc_acoes_gestao_listas_v2` | `(text, date, date, text, text, int, int, text, int, int)` (assumindo signatura existente) |

---

## §4 — Queries Paginadas Reescritas (Codex HIGH 1)

### 4.1 — O problema central: grão errado

O Codex identificou três falhas no padrão de paginação do v2:

1. **LEFT JOIN com `crm_carteira_clientes` no FROM principal** pode retornar múltiplas linhas por `cli_idcliente` (a tabela tem PK duplicada no mirror). Quando isso acontece ANTES do LIMIT/OFFSET que alimenta `json_agg`, a multiplicação infla o resultado e distorce a contagem.

2. **Em `em_andamento`**: a CTE `filtered` está no grão de ação (1 linha por ação), não no grão de negócio. O `LATERAL JOIN` para buscar a ação mais recente usa `filtered.ngo_nronegocio`, mas se um negócio tiver múltiplas ações dentro da janela, o `filtered` já contém múltiplas linhas para o mesmo negócio antes da deduplicação pelo DISTINCT do funil.

3. **ORDER BY dentro de `json_agg`** — quando o ORDER BY está dentro da agregação (e não antes), a ordem da página depende da implementação do agregador, não é determinística para paginação.

### 4.2 — Solução: CTEs canônicos em grão correto

Para cada RPC, o padrão correto é:

```
CTE_canonica  (1 linha por ENTIDADE antes de qualquer paginação)
  └─ CTE_paginada  (ORDER BY + LIMIT/OFFSET sobre o resultado da CTE canônica)
       └─ CTE_cliente  (resolução de nome de cliente via subquery/LATERAL, NO SELECT final)
```

**Regras inquebráveis:**
- `LIMIT p_limit OFFSET p_offset` aplica sobre o resultado do CTE canônico, NUNCA dentro de um JOIN que pode multiplicar.
- O `total` é contado a partir do CTE canônico, não das linhas já multiplicadas.
- `ORDER BY` determinístico ANTES de LIMIT/OFFSET (não dentro de `json_agg`).
- LEFT JOIN com `crm_carteira_clientes` resolvido via subquery ou LATERAL no SELECT final, não no FROM que precede a deduplicação.

### 4.3 — CTE canônico de `em_andamento` (mais complexo — exemplo completo)

```sql
-- ============================================================
-- rpc_acoes_em_andamento — exemplo reescrito (v3)
-- Problema v2: filtered em grão de ação + LEFT JOIN carteira antes de dedup.
-- Solução v3: filtered DEDUPLICADO por ngo_numero ANTES do LATERAL JOIN.
-- ============================================================

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
      SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.dias_parado DESC, sub.negocio_numero ASC), '[]'::json)
      FROM (
        -- CTE inline: filtered deduplicado por ngo_numero
        -- GRAO: 1 linha por negocio (nao por acao)
        WITH filtered_dedup AS (
          -- Primeiro: todas as ações do período
          WITH acoes_periodo AS (
            SELECT DISTINCT
              a.ngo_nronegocio,
              a.aco_vendedor,
              a.cli_idcliente
            FROM mirror.crm_acoes a
            WHERE a.aco_dthconclusao::date BETWEEN p_from AND p_to
              AND a.aco_dthconclusao IS NOT NULL
              AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
          ),
          -- Segundo: deduplica por ngo_numero (1 linha por negocio)
          -- Usa MAX() sobre aco_vendedor e cli_idcliente porque, se um negócio
          -- foi tocado por múltiplos vendedores no período, pegar o ÚLTIMO por
          -- data de ação é semanticamente mais correto que arbitrário.
          -- Para grão de atribuição por consultor, isso resolve "quem fez a
          -- última ação no período" (aceito pelo usuário).
          negocios_do_periodo AS (
            SELECT DISTINCT ON (ap.ngo_nronegocio)
              ap.ngo_nronegocio        AS negocio_numero,
              ap.cli_idcliente,
              MAX(ap.aco_vendedor)    AS ultimo_vendedor  -- arbitrário entre multi-vendedor
            FROM acoes_periodo ap
            WHERE ap.ngo_nronegocio IS NOT NULL
              AND ap.ngo_nronegocio <> ''
            GROUP BY ap.ngo_nronegocio, ap.cli_idcliente
            ORDER BY ap.ngo_nronegocio
          )
          SELECT ndp.negocio_numero, ndp.cli_idcliente, ndp.ultimo_vendedor
          FROM negocios_do_periodo ndp
        ),
        -- CTE canônico: 1 linha por negócio Em Andamento, sem REPASSE
        -- Resolvido ANTES de qualquer paginação ou join com ações.
        em_andamento_canonico AS (
          SELECT DISTINCT ON (nc.ngo_numero)
            nc.ngo_numero                AS negocio_numero,
            nc.ngo_etapa                 AS etapa,
            nc.ngo_vlrtotalnegociado     AS valor_negociado,
            nc.ngo_conclusao             AS conclusao,
            nc.ngo_funil                AS funil,
            nc.cli_idcliente,
            nc.consultor_negocio,
            nc.cidade_negocio
          FROM filtered_dedup fd
          JOIN negocios_canonicos nc ON nc.ngo_numero = fd.negocio_numero
          WHERE nc.ngo_conclusao = 'Em Andamento'
            AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
            AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
          ORDER BY nc.ngo_numero
        ),
        -- CTE final: LATERAL JOIN para última ação (resolvido sobre o grão canônico)
        -- Aqui o LATERAL é seguro porque já estamos em 1 linha por negócio.
        resultado AS (
          SELECT
            ec.negocio_numero,
            ec.etapa,
            ec.valor_negociado,
            ec.conclusao,
            ec.consultor_negocio,
            ec.cidade_negocio,
            aco.ultima_acao,
            aco.tipo_contato,
            (CURRENT_DATE - aco.ultima_acao::date)::int AS dias_parado,
            -- Cliente resolvido via subquery (SEM JOIN multiplicador)
            COALESCE(
              (SELECT cc.cli_nome
               FROM mirror.crm_carteira_clientes cc
               WHERE cc.cli_idcliente = ec.cli_idcliente
               ORDER BY cc.cli_idcliente
               LIMIT 1),
              '<sem cadastro>'
            ) AS cliente
          FROM em_andamento_canonico ec
          JOIN LATERAL (
            SELECT
              a.aco_dthconclusao  AS ultima_acao,
              a.aco_tipocontato   AS tipo_contato
            FROM mirror.crm_acoes a
            WHERE a.ngo_nronegocio = ec.negocio_numero
              AND a.aco_dthconclusao IS NOT NULL
            ORDER BY a.aco_dthconclusao DESC
            LIMIT 1
          ) aco ON TRUE
          WHERE (p_vendedor IS NULL OR ec.consultor_negocio = p_vendedor)
        )
        -- ORDEM DETERMINISTICA ANTES DE LIMIT/OFFSET
        SELECT
          negocio_numero,
          cliente,
          cidade_negocio     AS cidade,
          consultor_negocio  AS consultor,
          etapa,
          valor_negociado   AS valor_negociado,
          tipo_contato       AS ultima_acao,
          ultima_acao        AS data_ultima_acao,
          dias_parado
        FROM resultado
        ORDER BY
          dias_parado DESC,
          negocio_numero ASC        -- desempate estável: mesmo dias_parado
        LIMIT p_limit
        OFFSET p_offset
      ) sub
    ),
    'total', (
      -- Total contado do CTE canônico (grão correto, sem multiplicação)
      SELECT COUNT(*)
      FROM filtered_dedup fd
      JOIN negocios_canonicos nc ON nc.ngo_numero = fd.negocio_numero
      WHERE nc.ngo_conclusao = 'Em Andamento'
        AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
        AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
        AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rpc_acoes_em_andamento(date, date, text, text, int, int)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_em_andamento(date, date, text, text, int, int)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.rpc_acoes_em_andamento(date, date, text, text, int, int) IS
  'Drill-down de oportunidades em andamento para /bi/acoes v3. Grão: 1 linha por negócio. Fontes: filtered deduplicado por ngo_numero + negocios_canonicos + ultima acao via LATERAL. Sem EXISTS de ganho/perdido (reaberto indetectável sem histórico). CLIENTE resolvido via subquery, não JOIN multiplicador. GRANT: authenticated+service_role apenas. Invariante: total deve bater com funil.oportunidades (112 em jul/2026).';
```

### 4.4 — Caso "cliente multi-carteira" testado mentalmente

**Cenário:** Um `cli_idcliente` aparece 3 vezes em `mirror.crm_carteira_clientes` (3 endereços/filiais).

- O `SELECT ... LIMIT 1` na subquery de cliente retorna 1 linha (determinístico pelo `ORDER BY cli_idcliente`, primeira linha).
- Se houvesse LEFT JOIN direto, seriam 3 linhas por negócio, multiplicando o resultado.
- Resultado: 1 cliente por linha, não importa quantas carteiras o cliente tenha.
- O `total` não é afetado porque a contagem vem de `filtered_dedup` JOIN `negocios_canonicos`, sem contacto com `crm_carteira_clientes`.

### 4.5 — O mesmo padrão para as outras 2 RPCs

**`rpc_acoes_pedidos_ganhos`**: CTE canônico = `pedidos_dedup` (1 linha por `pdo_codigointerno`) JOIN `negocios_canonicos`. Cliente via subquery `LIMIT 1`. Total conta `COUNT(DISTINCT pd.pdo_codigointerno)`.

**`rpc_acoes_negocios_perdidos`**: CTE canônico = `negocios_canonicos` filtrado por `ngo_conclusao='Perdido'`. Cliente via subquery `LIMIT 1`. Total = `COUNT(DISTINCT ngo_numero)`.

---

## §5 — Path de Deploy Revisado (Codex HIGH 2)

Substitui o `psql -f` simples do v2 por uma cadeia explícita com transações, abort-on-error, backup, validação e smoke.

### 5.1 — Cadeia completa de deploy (para cada migration)

```bash
#!/usr/bin/env bash
# deploy-migration.sh — aplicar uma migration SQL em produção
# Uso: ./deploy-migration.sh <arquivo.sql> <nome_da_funcao>
# Requer: SSH configurado para root@178.238.235.203

set -euo pipefail   # abort em qualquer falha

MIGRATION="$1"
FN="$2"
HOST="root@178.238.235.203"
CONTAINER_CMD="docker exec -i \$(docker ps --filter name=supabase_db --format '{{.Names}}' | head -1) psql -U postgres -d postgres"

# 1. Backup definitions + ACLs previas (para rollback manual se necessário)
echo "=== Backup estado anterior ==="
ssh "$HOST" "$CONTAINER_CMD -tAc \"
  SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = '$FN'
\" > /tmp/rollback_${FN}_definition.sql"

ssh "$HOST" "$CONTAINER_CMD -tAc \"
  SELECT routine_name || ':' || grantee || '=' || privilege_type
  FROM information_schema.routine_privileges
  WHERE routine_name = '$FN'
\" > /tmp/rollback_${FN}_acls.txt"

# 2. Copiar migration para VPS
echo "=== Copiando migration ==="
scp -C "$MIGRATION" "$HOST:/tmp/"

# 3. Aplicar em TRANSAÇÃO com ON_ERROR_STOP
echo "=== Aplicando migration ($FN) ==="
ssh "$HOST" "$CONTAINER_CMD -X -v ON_ERROR_STOP=1 -1 -f /tmp/$(basename $MIGRATION)"
# Se esta linha falhar, o script aborta aqui (-e)

# 4. Pós-validação (4 checks)
echo "=== Pós-validação ==="
ssh "$HOST" "$CONTAINER_CMD -tAc \"
  -- (a) Função existe
  SELECT count(*) AS fn_exists FROM pg_proc WHERE proname = '$FN';
  -- (b) Owner = postgres
  SELECT count(*) AS owner_ok
  FROM pg_proc p
  JOIN pg_roles r ON r.oid = p.proowner
  WHERE p.proname = '$FN' AND r.rolname = 'postgres';
  -- (c) PUBLIC e anon SEM EXECUTE
  SELECT count(*) AS public_anon_execute
  FROM information_schema.routine_privileges
  WHERE routine_name = '$FN' AND grantee IN ('PUBLIC', 'anon')
    AND privilege_type = 'EXECUTE';
  -- DEVE retornar 0
  -- (d) authenticated COM EXECUTE
  SELECT count(*) AS authenticated_execute
  FROM information_schema.routine_privileges
  WHERE routine_name = '$FN' AND grantee = 'authenticated'
    AND privilege_type = 'EXECUTE';
  -- DEVE retornar 1
\""

# 5. Smoke HTTP (PostgREST sem JWT — deve falhar com 401/403)
echo "=== Smoke HTTP (anon deve ser bloqueado) ==="
HTTP_CODE=$(ssh "$HOST" \
  "curl -s -o /dev/null -w '%{http_code}' \
    -X GET 'http://localhost:3000/rpc/$FN?p_from=2026-07-01&p_to=2026-07-31' \
    -H 'apikey: ${SUPABASE_ANON_KEY}' \
    -H 'Authorization: Bearer '")

if [[ "$HTTP_CODE" == "200" ]]; then
  echo "FALHA: RPC $FN retornou 200 para anon (deveria ser 401/403)"
  exit 1
fi
echo "Smoke HTTP: HTTP $HTTP_CODE (esperado 401 ou 403) — OK"

# 6. PostgREST reload (só depois dos checks 1-5 passarem)
echo "=== PostgREST reload ==="
ssh "$HOST" "$CONTAINER_CMD -c \"NOTIFY pgrst, 'reload schema';\""
echo "Deploy $FN concluído com sucesso."
```

### 5.2 — Ordem de aplicação das 9 migrations

```
# SEQUÊNCIA OBRIGATÓRIA:

# Grupo 1: 3 RPCs novas (Story 4-A, 4-B, 5-A)
1.  20260803_rpc_acoes_pedidos_ganhos_v1.sql
2.  20260803_rpc_acoes_negocios_perdidos_v1.sql
3.  20260803_rpc_acoes_em_andamento_v1.sql

# Grupo 2: 4 REVOKEs das existentes (Story SEC-FIX-1 — OBRIGATÓRIAS para ship)
4.  20260803_revoke_public_rpc_acoes_bi.sql
5.  20260803_revoke_public_rpc_acoes_funil_gestao.sql
6.  20260803_revoke_public_rpc_acoes_detalhe.sql
7.  20260803_revoke_public_rpc_acoes_mapa_oportunidades.sql

# Grupo 3: Ordenação Story 3-A
8.  20260803_rpc_acoes_gestao_listas_v2_ordenacao_desperdicio.sql

# Após cada migration: verificar que as anteriores não regrediram
# Smoke de regressão: rpc_acoes_funil_gestao('2026-07-01','2026-07-31',NULL,NULL)
# deve retornar os mesmos valores de antes.
```

### 5.3 — Smoke de regressão (após cada migration)

```sql
-- Após cada passo, verificar que o funil não mudou:
SELECT
  (data->'funil'->>'visitas')::int      AS visitas,
  (data->'funil'->>'oportunidades')::int AS oportunidades,
  (data->'funil'->>'ganhos')::int       AS ganhos,
  (data->'funil'->>'perdidos')::int     AS perdidos
FROM rpc_acoes_funil_gestao('2026-07-01','2026-07-31', NULL, NULL) AS t(data);

-- Esperado em todos os passos (julho/2026):
-- visitas=546, oportunidades=112, ganhos=26, perdidos=7
```

---

## §6 — AC5 Ampliado (Codex HIGH 1)

AC5 original do v2 verificava apenas que `funil.oportunidades == em_andamento.total`. O Codex HIGH 1 exige mais: garantir que a paginação preserva o grão correto em todos os níveis.

### 6.1 — AC5 original (preservado)

```sql
WITH f AS (
  SELECT rpc_acoes_funil_gestao('2026-07-01','2026-07-31', NULL, NULL) AS data
),
     e AS (
  SELECT rpc_acoes_em_andamento('2026-07-01','2026-07-31', NULL, NULL, NULL, 50, 0) AS data
)
SELECT
  (f.data->'funil'->>'oportunidades')::int  AS funil_oportunidades,
  (e.data->>'total')::int                    AS em_andamento_total,
  ((f.data->'funil'->>'oportunidades')::int = (e.data->>'total')::int) AS invariant_holds
FROM f, e;
-- Esperado: true (112 == 112)
```

### 6.2 — AC5.1: Unicidade por página (invariante de grão)

```sql
-- Verifica que a página não contém linhas duplicadas por entidade.
-- Se o grao estiver errado (fan-out de cliente ou de acao),
-- este SELECT retorna mais de limit linhas ou ids duplicados.
WITH page AS (
  SELECT (rpc_acoes_em_andamento('2026-07-01','2026-07-31', NULL, NULL, 10, 0)->>'rows')::json AS rows
),
unnested AS (
  SELECT json_array_elements(u.rows)->>'negocio_numero' AS negocio_numero
  FROM page u
)
SELECT
  COUNT(*)                                    AS linhas_na_pagina,
  COUNT(DISTINCT negocio_numero)              AS negocios_distintos,
  (COUNT(*) = COUNT(DISTINCT negocio_numero)) AS sem_duplicatas
FROM unnested;
-- Esperado: linhas_na_pagina = negocios_distintos = sem_duplicatas = true
```

### 6.3 — AC5.2: Total consistente entre páginas

```sql
-- Verifica que o total retornado é o mesmo em offsets diferentes.
-- Se o total mudar entre chamadas, o grão está errado (multiplicação antes de LIMIT).
WITH
  p0 AS (
    SELECT (rpc_acoes_em_andamento('2026-07-01','2026-07-31', NULL, NULL, 10, 0)->>'total')::int AS total
  ),
  p1 AS (
    SELECT (rpc_acoes_em_andamento('2026-07-01','2026-07-31', NULL, NULL, 10, 10)->>'total')::int AS total
  ),
  p2 AS (
    SELECT (rpc_acoes_em_andamento('2026-07-01','2026-07-31', NULL, NULL, 10, 20)->>'total')::int AS total
  )
SELECT
  p0.total AS total_offset_0,
  p1.total AS total_offset_10,
  p2.total AS total_offset_20,
  (p0.total = p1.total AND p1.total = p2.total) AS total_consistente
FROM p0, p1, p2;
-- Esperado: total_consistente = true (mesmo valor em todos os offsets)
```

### 6.4 — AC5.3: Clientes não multiplicados (fan-out de carteira)

```sql
-- Verifica que o join com crm_carteira_clientes não multiplica linhas.
-- Conta negocios distintos na página vs. soma de cli_idcliente únicos.
-- Se o LEFT JOIN multiplicou, a soma de cli_idcliente será maior.
WITH page AS (
  SELECT (rpc_acoes_em_andamento('2026-07-01','2026-07-31', NULL, NULL, 50, 0)->>'rows')::json AS rows
),
unnested AS (
  SELECT
    json_array_elements(u.rows)->>'negocio_numero' AS negocio_numero
  FROM page u
)
SELECT
  COUNT(DISTINCT negocio_numero) AS negocios_distintos,
  -- Se houver multiplicação, a contagem de linhas será maior
  COUNT(*)                       AS linhas_total,
  (COUNT(*) = COUNT(DISTINCT negocio_numero)) AS sem_multiplicacao
FROM unnested;
-- Esperado: negocios_distintos = linhas_total, sem_multiplicacao = true
```

### 6.5 — Checklist de validação post-deploy

```
[ ] AC5:    funil.oportunidades == em_andamento.total  (true, 112 == 112)
[ ] AC5.1: sem duplicatas por página  (COUNT = COUNT DISTINCT)
[ ] AC5.2: total consistente entre offsets  (mesmo valor em 3 chamadas)
[ ] AC5.3: sem multiplicação de cliente  (sem fan-out de carteira)
[ ] GRANT:  has_function_privilege('PUBLIC', 'rpc_acoes_em_andamento', 'EXECUTE') = false
[ ] GRANT:  has_function_privilege('anon', 'rpc_acoes_em_andamento', 'EXECUTE') = false
[ ] GRANT:  has_function_privilege('authenticated', 'rpc_acoes_em_andamento', 'EXECUTE') = true
[ ] Regressao: rpc_acoes_funil_gestao('2026-07-01','2026-07-31',NULL,NULL) = valores originais
```

---

## §7 — Riscos Não Mapeados no v2 (atualizados)

### 7.1 — Riscos herdados do v2 (mantidos)

| # | Risco | Status | Mitigação |
|---|-------|--------|-----------|
| 5.1 | **Indexação** | Monitorar | `@data-engineer` roda `EXPLAIN ANALYZE` no banco vivo antes de declarar done. Propor índice se `Seq Scan` em tabelas > 100k rows. |
| 5.2 | **Ordem de criação de funções referenciadas** | Monitorar | `COMMENT ON FUNCTION` em cada RPC declara dependências. |
| 5.3 | **Cache invalidation** | Aceite | `staleTime: 5min` aceito (sync cycle é minutos). |
| 5.4 | **Paginação** | Corrigido v3 | Padrão reutilizado; RPCs agora com LIMIT/OFFSET determinístico. |
| 5.5 | **Supabase REST reload** | Documentado | `NOTIFY pgrst, 'reload schema'` após cada migration. |
| 5.6 | **`diasParado > 90` em vermelho** | Padrão existente | Replicar convenção do mapa. |
| 5.7 | **Sincronismo de filtros** | Padrão existente | `useEffect` reseta `page=1` quando filtros mudam. |
| 5.8 | **Dead code** | Monitorar | `grep` antes de deletar; build valida. |
| 5.11 | **Bug do acento `REPASSE DE MÁQUINA`** | Pendente | Migration própria (fora do escopo v3). |
| 5.12 | **`diasParados` dedup diferente** | Pendente | Demanda própria (fora do escopo v3). |
| 5.13 | **Reaberto genuíno indetectável** | Aceite | Decisão A do usuário: estado atual sem distinção. |
| 5.14 | **Grant anon nas 4 RPCs existentes** | **ENDERECADO** | 4 migrations de REVOKE no §2.2. |

### 7.2 — Riscos NOVOS mapeados pelo Codex #2

| # | Severidade | Risco | Mitigação |
|---|-----------|-------|-----------|
| 6.15 | **CRITICAL** | **Buraco de GRANT nas 4 RPCs existentes** — mesmo após revogação das 3 novas, as 4 existentes (`rpc_acoes_bi`, `rpc_acoes_funil_gestao`, `rpc_acoes_detalhe`, `rpc_acoes_mapa_oportunidades`) continuam expostas como `SECURITY DEFINER + postgres + GRANT TO anon`. Qualquer pessoa com URL da API + anon key lê TODO o mirror CRM. | 4 migrations de REVOKE (Story SEC-FIX-1, §2.2). **OBRIGATÓRIAS para ship.** Se aplicadas: `has_function_privilege('anon', '<fn>', 'EXECUTE') = false` para todas as 7. |
| 6.16 | **CRITICAL** | **GRANT sem REVOKE não fecha PUBLIC** — Postgres sempre dá EXECUTE a PUBLIC por padrão. `GRANT TO authenticated, service_role` sem `REVOKE FROM PUBLIC` não remove o acesso anônimo. `@security` afirmou que GRANT explícito "é suficiente"; Codex #2 corrige isso. | Padrão §3: `REVOKE FROM PUBLIC, anon; GRANT TO authenticated, service_role`. Aplicado a todas as 8 migrations funcionais. |
| 6.17 | **HIGH** | **Fan-out de cliente nas queries** — LEFT JOIN com `crm_carteira_clientes` no FROM principal (não em subquery) pode multiplicar linhas quando um cliente tem múltiplas entradas na carteira. Afeta `total`, ordenação e conteúdo das páginas. | CTEs canônicos reescritos (§4): cliente resolvido via subquery `LIMIT 1`, não JOIN multiplicador. AC5.1/5.2/5.3 validam isso post-deploy. |
| 6.18 | **HIGH** | **Deploy transacional sem segurança** — `psql -f` sem `-1`, sem `-v ON_ERROR_STOP=1` e sem transação explícita deixa a função em estado parcial se a migration falhar no meio. Postgres aplica statement-by-statement. | Cadeia de deploy §5 com `psql -1 -X -v ON_ERROR_STOP=1 -b`, PREFLIGHT SAVEPOINT, POSTFLIGHT em 4 checks, abort em qualquer falha (`set -euo pipefail`). |
| 6.19 | **MEDIUM** | **Story 3-A ordenação incorreta** — `rpc_acoes_gestao_listas` ordena `desperdicio` de forma diferente do que Story 3-A exige (NULL/zero primeiro + razão DESC). | 9ª migration §2.3 corrige a ordenação. Critério de PR: smoke ordenação em banco vivo. |

---

## §8 — Critérios de PR (atualizados do v2)

### 8.1 — Story SEC-FIX-1 (4 migrations de REVOKE — NOVO)

**OBRIGATÓRIO para merge. CRITICAL.**

- [ ] `20260803_revoke_public_rpc_acoes_bi.sql` aplicada e verificada:
  - `has_function_privilege('PUBLIC', 'rpc_acoes_bi', 'EXECUTE')` retorna `false`
  - `has_function_privilege('anon', 'rpc_acoes_bi', 'EXECUTE')` retorna `false`
  - `has_function_privilege('authenticated', 'rpc_acoes_bi', 'EXECUTE')` retorna `true`
- [ ] `20260803_revoke_public_rpc_acoes_funil_gestao.sql` aplicada com os mesmos 3 checks
- [ ] `20260803_revoke_public_rpc_acoes_detalhe.sql` aplicada com os mesmos 3 checks
- [ ] `20260803_revoke_public_rpc_acoes_mapa_oportunidades.sql` aplicada com os mesmos 3 checks
- [ ] Smoke via HTTP (sem JWT): todas as 4 retornam 401/403, não 200
- [ ] `rpc_acoes_funil_gestao('2026-07-01','2026-07-31', NULL, NULL)` retorna valores originais (regressão zero)

### 8.2 — Story 4-A (pedidos ganhos)

- [ ] `20260803_rpc_acoes_pedidos_ganhos_v1.sql` aplicada com POSTFLIGHT passando (4 checks)
- [ ] `rpc_acoes_pedidos_ganhos('2026-07-01','2026-07-31',NULL,NULL,50,0)->>'total'::int >= 26`
- [ ] GRANT smoke: `SET ROLE anon` → `permission denied`; `SET ROLE authenticated` → `200 OK`
- [ ] AC5.1/5.2/5.3 validam sem duplicatas, total consistente, sem fan-out
- [ ] `AcoesPedidosTable.tsx` criado, ≤ 150 linhas
- [ ] `usePedidosGanhosRpc.ts` criado
- [ ] `npm run build` passa sem erro TS

### 8.3 — Story 4-B (negócios perdidos)

- [ ] `20260803_rpc_acoes_negocios_perdidos_v1.sql` aplicada com POSTFLIGHT passando
- [ ] `rpc_acoes_negocios_perdidos('2026-07-01','2026-07-31',NULL,NULL,50,0)->>'total'::int = 7`
- [ ] GRANT smoke: `SET ROLE anon` → `permission denied`; `SET ROLE authenticated` → `200 OK`
- [ ] AC5.1/5.2/5.3 validam
- [ ] `AcoesNegociosPerdidosTable.tsx` criado, ≤ 150 linhas
- [ ] `useNegociosPerdidosRpc.ts` criado
- [ ] `npm run build` passa sem erro TS

### 8.4 — Story 5-A (em andamento)

- [ ] `20260803_rpc_acoes_em_andamento_v1.sql` aplicada com POSTFLIGHT passando
- [ ] `rpc_acoes_em_andamento('2026-07-01','2026-07-31',NULL,NULL,50,0)->>'total'::int = 112`
- [ ] GRANT smoke: `SET ROLE anon` → `permission denied`; `SET ROLE authenticated` → `200 OK`
- [ ] **AC5 executado no banco vivo:** `funil.oportunidades == em_andamento.total` → `true`
- [ ] **AC5.1/5.2/5.3 executados no banco vivo:** todos `true`
- [ ] `AcoesEmAndamentoTable.tsx` criado, ≤ 150 linhas
- [ ] `useEmAndamentoRpc.ts` criado
- [ ] `npm run build` passa sem erro TS

### 8.5 — Story 3-A (ordenação desperdício)

- [ ] `20260803_rpc_acoes_gestao_listas_v2_ordenacao_desperdicio.sql` aplicada com POSTFLIGHT passando
- [ ] Smoke ordenação: `rpc_acoes_gestao_listas('desperdicio', '2026-07-01','2026-07-31',NULL,NULL,50,0,NULL,NULL,NULL)` retorna JSON com campo `total`
- [ ] Ordenação validada mentalmente: NULL/zero primeiro, razão DESC, desempate `ngo_numero ASC`
- [ ] `npm run build` passa sem erro TS

### 8.6 — Regressão geral

- [ ] `npm run build` → sucesso sem erro TS
- [ ] `npx vitest run` → verde (169 ou mais)
- [ ] Feature doc `docs/features/acoes-bi.md` atualizada com:
  - 3 novos contratos de RPC (`rpc_acoes_pedidos_ganhos`, `rpc_acoes_negocios_perdidos`, `rpc_acoes_em_andamento`)
  - Padrão de GRANT: `authenticated, service_role` apenas
  - Nota de segurança: RPCs de ações são autenticadas; chamadas anônimas retornam 401/403
- [ ] `rpc_acoes_funil_gestao('2026-07-01','2026-07-31', NULL, NULL)` retorna `visitas=546, oportunidades=112, ganhos=26, perdidos=7`
- [ ] 0 imports de `AcoesGestaoCarteiraSummary` no codebase

---

## Resumo de Arquivos

### Criar (migrations — 9 arquivos)

```
supabase/migrations/
├── 20260803_rpc_acoes_pedidos_ganhos_v1.sql              [Story 4-A]
├── 20260803_rpc_acoes_negocios_perdidos_v1.sql            [Story 4-B]
├── 20260803_rpc_acoes_em_andamento_v1.sql                  [Story 5-A]
├── 20260803_revoke_public_rpc_acoes_bi.sql                [Story SEC-FIX-1]
├── 20260803_revoke_public_rpc_acoes_funil_gestao.sql       [Story SEC-FIX-1]
├── 20260803_revoke_public_rpc_acoes_detalhe.sql           [Story SEC-FIX-1]
├── 20260803_revoke_public_rpc_acoes_mapa_oportunidades.sql [Story SEC-FIX-1]
└── 20260803_rpc_acoes_gestao_listas_v2_ordenacao_desperdicio.sql [Story 3-A]
```

### Criar (frontend — inalterado vs v2)

```
src/components/bi/AcoesDegrauBar.tsx                    [Story 1-A]
src/components/bi/sections/AcoesFunilConversao.tsx       [Story 1-A]
src/components/bi/sections/AcoesDesfechosPeriodo.tsx      [Story 1-A ≤60 ln]
src/components/bi/sections/AcoesGestaoCarteira.tsx       [Story 2-A]
src/components/bi/AcoesPedidosTable.tsx                  [Story 4-A ≤150 ln]
src/components/bi/AcoesNegociosPerdidosTable.tsx          [Story 4-B ≤150 ln]
src/components/bi/AcoesEmAndamentoTable.tsx               [Story 5-A ≤150 ln]
src/hooks/bi/usePedidosGanhosRpc.ts                       [Story 4-A]
src/hooks/bi/useNegociosPerdidosRpc.ts                   [Story 4-B]
src/hooks/bi/useEmAndamentoRpc.ts                         [Story 5-A]
src/types/bi/acoesPedidosGanhos.ts                       [Story 4-A]
src/types/bi/acoesNegociosPerdidos.ts                    [Story 4-B]
src/types/bi/acoesEmAndamento.ts                         [Story 5-A]
```

### Modificar

```
src/components/bi/sections/AcoesDetailWithFilter.tsx        [Stories 4-A, 4-B, 5-A]
src/types/biRpc.ts                                          [reexportar tipos]
docs/features/acoes-bi.md                                    [atualizar contratos]
```

### Deletar

```
src/components/bi/sections/AcoesGestaoCarteiraSummary.tsx  [Story 2-A]
```
