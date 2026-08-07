#!/usr/bin/env bash
# =============================================================================
# deploy_rpcs.sh — Aplicar 8 migrations de /bi/acoes v10 em produção
# VPS: root@178.238.235.203
# Container: supabase_db dinâmico
# =============================================================================
set -eo pipefail

VPS="root@178.238.235.203"
SSH_OPTS="-i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=no"

echo "=== Descobrindo container do banco ==="
CONTAINER=$(ssh $SSH_OPTS "$VPS" \
  'docker ps --filter name=supabase_db --format "{{.Names}}" | head -1')
echo "Container: $CONTAINER"

PSQL_BASE="docker exec -i $CONTAINER psql -U postgres -d postgres"

# =============================================================================
# PRE-DEPLOY: valores de referencia julho/2026
# =============================================================================
echo ""
echo "=== PRE-DEPLOY: Funil referencia ==="
ssh $SSH_OPTS "$VPS" "$PSQL_BASE -t -c \
\"SELECT 'visitas=' || (data->'funil'->>'visitas') || ', oportunidades=' || (data->'funil'->>'oportunidades') || ', ganhos=' || (data->'funil'->>'ganhos') || ', perdidos=' || (data->'funil'->>'perdidos')
 FROM rpc_acoes_funil_gestao('2026-07-01','2026-07-31', NULL, NULL) AS t(data);\""

# =============================================================================
# Copiar migrations para VPS
# =============================================================================
echo ""
echo "=== Copiando migrations para VPS ==="
scp $SSH_OPTS \
  supabase/migrations/20260803_rpc_acoes_pedidos_ganhos_v1.sql \
  supabase/migrations/20260803_rpc_acoes_negocios_perdidos_v1.sql \
  supabase/migrations/20260803_rpc_acoes_em_andamento_v1.sql \
  supabase/migrations/20260803_rpc_acoes_gestao_listas_v2_ordenacao_desperdicio.sql \
  supabase/migrations/20260803_revoke_public_rpc_acoes_bi.sql \
  supabase/migrations/20260803_revoke_public_rpc_acoes_funil_gestao.sql \
  supabase/migrations/20260803_revoke_public_rpc_acoes_detalhe.sql \
  supabase/migrations/20260803_revoke_public_rpc_acoes_mapa_oportunidades.sql \
  "$VPS:/tmp/"

# =============================================================================
# Aplicar migrations 1 a 1 (transacional com -1)
# =============================================================================
MIGRATIONS=(
  "20260803_rpc_acoes_pedidos_ganhos_v1.sql"
  "20260803_rpc_acoes_negocios_perdidos_v1.sql"
  "20260803_rpc_acoes_em_andamento_v1.sql"
  "20260803_rpc_acoes_gestao_listas_v2_ordenacao_desperdicio.sql"
  "20260803_revoke_public_rpc_acoes_bi.sql"
  "20260803_revoke_public_rpc_acoes_funil_gestao.sql"
  "20260803_revoke_public_rpc_acoes_detalhe.sql"
  "20260803_revoke_public_rpc_acoes_mapa_oportunidades.sql"
)

echo ""
for mig in "${MIGRATIONS[@]}"; do
  echo "=== Aplicando: $mig ==="
  ssh $SSH_OPTS "$VPS" "$PSQL_BASE -X -v ON_ERROR_STOP=1 -1 -f /tmp/$mig" 2>&1
  if [[ $? -eq 0 ]]; then
    echo "=== OK: $mig ==="
  else
    echo "=== FALHA: $mig ==="
    exit 1
  fi
done

# =============================================================================
# POST-DEPLOY: Validacao de seguranca
# =============================================================================
echo ""
echo "=== Validacao GRANT das 3 novas funcoes ==="
for fn in rpc_acoes_pedidos_ganhos rpc_acoes_negocios_perdidos rpc_acoes_em_andamento rpc_acoes_gestao_listas; do
  echo "--- $fn ---"
  ssh $SSH_OPTS "$VPS" "$PSQL_BASE -t -c \
    \"SELECT '$fn: existe=' || COUNT(*)::text || ', owner=' || r.rolname || ', public_anon=' || (SELECT COUNT(*) FROM information_schema.routine_privileges WHERE routine_name = '$fn' AND grantee IN ('PUBLIC','anon') AND privilege_type='EXECUTE')::text || ', authenticated=' || (SELECT COUNT(*) FROM information_schema.routine_privileges WHERE routine_name = '$fn' AND grantee = 'authenticated' AND privilege_type='EXECUTE')::text
     FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner
     WHERE p.proname = '$fn';\""
done

echo ""
echo "=== Validacao REVOKE das 4 funcoes existentes ==="
for fn in rpc_acoes_bi rpc_acoes_funil_gestao rpc_acoes_detalhe rpc_acoes_mapa_oportunidades; do
  echo "--- $fn ---"
  ssh $SSH_OPTS "$VPS" "$PSQL_BASE -t -c \
    \"SELECT '$fn: public_anon=' || (SELECT COUNT(*) FROM information_schema.routine_privileges WHERE routine_name = '$fn' AND grantee IN ('PUBLIC','anon') AND privilege_type='EXECUTE')::text || ', authenticated=' || (SELECT COUNT(*) FROM information_schema.routine_privileges WHERE routine_name = '$fn' AND grantee = 'authenticated' AND privilege_type='EXECUTE')::text;\""
done

# =============================================================================
# Smoke HTTP: anon deve falhar
# =============================================================================
SUPABASE_URL="https://ceressupabasebi.vouxconsultoria.com.br"
ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.yXg8zkCdBRNXAPyONyI0GuX77HnQWed9Rnh_R0idFg4"

echo ""
echo "=== Smoke HTTP: anon deve falhar (401/403) ==="
FUNCS=(
  "rpc_acoes_bi"
  "rpc_acoes_funil_gestao"
  "rpc_acoes_detalhe"
  "rpc_acoes_mapa_oportunidades"
  "rpc_acoes_gestao_listas"
  "rpc_acoes_pedidos_ganhos"
  "rpc_acoes_negocios_perdidos"
  "rpc_acoes_em_andamento"
)
for func in "${FUNCS[@]}"; do
  HTTP_CODE=$(ssh $SSH_OPTS "$VPS" \
    "curl -s -o /dev/null -w '%{http_code}' '$SUPABASE_URL/rest/v1/rpc/$func?p_from=2026-07-01&p_to=2026-07-31' -H 'apikey: $ANON_KEY' -H 'Authorization: Bearer '" 2>/dev/null)
  if [[ "$HTTP_CODE" == "401" ]] || [[ "$HTTP_CODE" == "403" ]]; then
    echo "$func: HTTP $HTTP_CODE OK"
  else
    echo "$func: HTTP $HTTP_CODE FALHA (esperado 401/403)"
  fi
done

# =============================================================================
# AC5
# =============================================================================
echo ""
echo "=== AC5: oportunidades == em_andamento.total ==="
ssh $SSH_OPTS "$VPS" "$PSQL_BASE -t -c \
\"SELECT 'funil.oportunidades=' || (f.data->'funil'->>'oportunidades') || ', em_andamento.total=' || (e.data->>'total') || ', match=' ||
   CASE WHEN (f.data->'funil'->>'oportunidades')::int = (e.data->>'total')::int THEN 'TRUE' ELSE 'FALSE' END
 FROM rpc_acoes_funil_gestao('2026-07-01','2026-07-31', NULL, NULL) f(data),
      rpc_acoes_em_andamento('2026-07-01','2026-07-31', NULL, NULL, 50, 0) e(data);\""

echo ""
echo "=== AC5.2: total consistente entre offsets ==="
ssh $SSH_OPTS "$VPS" "$PSQL_BASE -t -c \
\"SELECT 'p0=' || (rpc_acoes_em_andamento('2026-07-01','2026-07-31', NULL, NULL, 10, 0)->>'total') ||
        ', p10=' || (rpc_acoes_em_andamento('2026-07-01','2026-07-31', NULL, NULL, 10, 10)->>'total') ||
        ', p20=' || (rpc_acoes_em_andamento('2026-07-01','2026-07-31', NULL, NULL, 10, 20)->>'total');\""

# =============================================================================
# Regressao do funil
# =============================================================================
echo ""
echo "=== Regressao funil (esperado: 546/112/26/7) ==="
ssh $SSH_OPTS "$VPS" "$PSQL_BASE -t -c \
\"SELECT 'visitas=' || (data->'funil'->>'visitas') || ', oportunidades=' || (data->'funil'->>'oportunidades') || ', ganhos=' || (data->'funil'->>'ganhos') || ', perdidos=' || (data->'funil'->>'perdidos')
 FROM rpc_acoes_funil_gestao('2026-07-01','2026-07-31', NULL, NULL) AS t(data);\""

# =============================================================================
# PostgREST reload
# =============================================================================
echo ""
echo "=== PostgREST reload ==="
ssh $SSH_OPTS "$VPS" "$PSQL_BASE -c \"NOTIFY pgrst, 'reload schema';\""

echo ""
echo "=== Deploy concluido ==="
