-- =====================================================================
-- 20260726_revoke_anon_mirror.sql
-- Fecha vazamento de PII para o role `anon` (LGPD).
--
-- STATUS: APLICADO em producao em 2026-07-26 como `supabase_admin`.
--         Validado antes em dry-run (BEGIN/ROLLBACK) no banco vivo.
--         Nao rode pela metade: a Parte 1 sozinha nao fecha nada.
--
-- AUTORIZACAO EXPLICITA DO USUARIO (registrada em .aivoux/gates/overrides.log):
--   Opcao escolhida pelo usuario: "Sim, autorizo as 3"
--   Descrita como: "REVOKE EXECUTE FROM PUBLIC nas 28 RPCs + executar como
--   supabase_admin + revogar truncate_mirror_table."
--   Necessaria porque as 3 operacoes estavam vetadas por padrao: revogar de
--   PUBLIC, executar como supabase_admin, e mexer numa funcao nao-`rpc_`.
-- =====================================================================
--
-- O INCIDENTE
-- -----------
-- O role `anon` do PostgREST e autenticado por um JWT PUBLICO (`VITE_*`,
-- inlinado no bundle pelo Vite). "Protegido pela anon key" nao e protecao:
-- qualquer pessoa com a URL do projeto le os mesmos dados que o app.
--
-- Medido no banco de producao em 2026-07-26 (self-hosted na VPS, NAO o
-- Cloud do supabase/config.toml):
--   * `anon` com SELECT em 18 das 19 tabelas de `mirror`
--   * 28/28 funcoes `public.rpc_*` SECURITY DEFINER executaveis por `anon`
--   * Exposto: 8.660 CNPJ/CPF, 14.880 telefones, 15.343 enderecos,
--     2.990 coordenadas, + `mirror.usuarios` com 96 CPF de funcionarios.
--
-- Provas ao vivo (REST anonimo, chave anon publica):
--   GET  /rest/v1/crm_carteira_clientes  (Accept-Profile: mirror) -> HTTP 200, CPF em claro
--   POST /rest/v1/rpc/rpc_clientes_criticos                       -> HTTP 200, 63 KB, 200 linhas
--
-- NAO e regressao do v7 — e pre-existente e vale para o projeto inteiro.
--
--
-- POR QUE **NAO** SE MEXE NO `PGRST_DB_SCHEMAS`
-- ---------------------------------------------
-- A correcao "obvia" (tirar `mirror` de
-- PGRST_DB_SCHEMAS=public,storage,graphql_public,mirror) QUEBRA O APP.
-- O frontend le tabelas de `mirror` DIRETAMENTE via
-- `supabase.schema("mirror").from(...)` em 6 servicos: useSyncStatus,
-- negociosService, pedidosBIService, adminBIService, servicosBIService,
-- negociosBIService. Remover o schema do REST derruba essas telas.
-- A correcao certa e por PRIVILEGIO, nao por exposicao de schema.
-- Nenhuma config de service muda. Nao ha `docker service update`.
--
--
-- POR QUE ISSO E SEGURO PARA O APP
-- --------------------------------
-- O app JA exige login: em src/App.tsx toda rota exceto /login esta atras de
-- ProtectedRoute + ModuleGuard. Depois do login o PostgREST usa o role
-- `authenticated`, que este script NAO toca (verificado em dry-run:
-- authenticated mantem SELECT em 18/18 tabelas e EXECUTE em 28/28 RPCs).
-- O ETL tambem nao e afetado: conecta como `postgres`, nao como `anon`.
--
--
-- COMO RODAR  (IMPORTANTE)
-- ------------------------
-- Rodar como **supabase_admin**, NAO como postgres:
--
--   psql -U supabase_admin -d postgres -f 20260726_revoke_anon_mirror.sql
--
-- Motivo medido: o grantor da maioria dos objetos e `supabase_admin`, e
-- `postgres` NAO e membro dele (pg_has_role -> false). Rodando como
-- `postgres` o REVOKE vira NO-OP SILENCIOSO: o Postgres emite apenas
-- "WARNING: no privileges could be revoked for ..." e sai com sucesso.
-- Dry-run como postgres: `anon` continuava lendo 16 das 18 tabelas e
-- executando 28 das 28 RPCs. Um "REVOKE" que retorna sucesso e nao revoga
-- nada e a pior falha possivel aqui — daria incidente por encerrado com o
-- vazamento aberto.
--
--
-- POR QUE A PARTE 2 REVOGA DE `PUBLIC`  (autorizado — ver cabecalho)
-- -------------------------------------------------------------------
-- As 32 funcoes de `public` (28 rpc_* + 4 helpers) tem EXECUTE concedido ao
-- pseudo-role **PUBLIC** (`=X/...` no proacl). Consequencia medida:
--   `REVOKE EXECUTE ON FUNCTION ... FROM anon` NAO TEM EFEITO NENHUM.
--   Dry-run: depois do revoke, anon ainda executava 28/28. `anon` herda o
--   privilegio de PUBLIC, entao revogar so dele nao remove nada.
-- Para fechar de fato e obrigatorio revogar de PUBLIC.
--
-- Isso NAO derruba `authenticated`: as 32 funcoes tem grant EXPLICITO para
-- `authenticated` alem do grant a PUBLIC. Dry-run apos revogar de PUBLIC:
--   anon 0/28  |  authenticated 28/28  |  service_role 28/28  |  postgres 28/28
-- e 3 das 4 funcoes NAO-rpc (handle_new_user, is_admin, set_updated_at) ficam
-- INTOCADAS. A 4a, `truncate_mirror_table`, NAO fica: ela e alvo deliberado da
-- Parte 3 (P0 destrutivo) e tem `anon` e `authenticated` revogados la.
--
-- Nao basta a Parte 1. As RPCs sao SECURITY DEFINER: executam com os
-- privilegios do DONO e ignoram o privilegio de tabela de quem chama.
-- Prova em dry-run: com SELECT revogado de `anon` em TODAS as tabelas de
-- mirror, o role `anon` ainda extraiu 200 linhas de clientes chamando
-- `public.rpc_clientes_criticos()`. Rodar so a Parte 1 nao fecha o
-- vazamento — so cria a falsa sensacao de que fechou.
-- =====================================================================


-- As Partes 1-3 sao ATOMICAS: ou tudo aplica, ou nada aplica. E a mitigacao
-- do aviso "nao rode pela metade" do cabecalho — a Parte 1 sozinha nao fecha
-- o vazamento (as RPCs SECURITY DEFINER contornam o privilegio de tabela).
BEGIN;


-- ---------------------------------------------------------------------
-- PARTE 1 — tabelas de `mirror`
-- ---------------------------------------------------------------------
-- Nenhuma tabela de mirror tem grant a PUBLIC (medido: 0), entao revogar
-- de `anon` aqui e suficiente e cirurgico.

REVOKE SELECT ON ALL TABLES IN SCHEMA mirror FROM anon;

-- Impede a regressao silenciosa: sem isto, a proxima tabela criada em
-- `mirror` nasce legivel por `anon` de novo.
-- ATENCAO ao `FOR ROLE`: o default ACL de TABLES em mirror pertence a
-- `supabase_admin`. Sem o FOR ROLE explicito, o ALTER cria uma entrada para
-- o role corrente e a entrada real fica intacta — outro no-op silencioso
-- (confirmado em dry-run).
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA mirror
  REVOKE SELECT ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA mirror
  REVOKE SELECT ON TABLES FROM anon;


-- ---------------------------------------------------------------------
-- PARTE 2 — funcoes `public.rpc_*` (SECURITY DEFINER)
-- ---------------------------------------------------------------------
-- Escopo restrito ao prefixo `rpc_`. Das 4 funcoes nao-rpc, 3 ficam de fora
-- de proposito: `is_admin` e usada em policies de RLS e `handle_new_user` no
-- fluxo de criacao de usuario — revogar em massa com
-- `ON ALL FUNCTIONS IN SCHEMA public` poderia atingir o login.
-- (A 4a, `truncate_mirror_table`, e tratada a parte na Parte 3.)

DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname LIKE 'rpc\_%'
  LOOP
    -- PUBLIC primeiro: e dele que `anon` herda o EXECUTE.
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', f.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon',   f.sig);
  END LOOP;
END $$;


-- ---------------------------------------------------------------------
-- PARTE 3 — `public.truncate_mirror_table(text)`   [P0 — DESTRUTIVO]
-- ---------------------------------------------------------------------
-- Nao e vazamento de leitura: e destruicao de dados por anonimo.
-- A funcao e SECURITY DEFINER (owner `postgres`), executavel por `anon` via
-- PUBLIC, e o corpo faz `EXECUTE format('TRUNCATE %I.%I', ...)`. A unica
-- validacao e exigir o prefixo 'mirror.'. Ou seja, um POST anonimo em
-- /rest/v1/rpc/truncate_mirror_table {"table_name":"mirror.<tabela>"}
-- apaga qualquer tabela do DW.
--
-- Revogado tambem de `authenticated`: nenhum usuario de BI tem motivo para
-- truncar o DW.
--
-- QUEM REALMENTE CHAMA ESTA FUNCAO (verificado no codigo, nao presumido):
--   * `supabase/functions/sync-campus-dealer/index.ts:897` — UNICO caller real.
--     Usa `SUPABASE_SERVICE_ROLE_KEY`, logo executa como **`service_role`**,
--     que esta preservado. E este o caller que nao pode quebrar.
--   * O ETL Python NAO chama esta funcao: faz `TRUNCATE TABLE {dest}` em SQL
--     direto (`/opt/etl-stack/etl_campos_dealer.py:135`), como `postgres`.
-- `postgres` (owner) e `service_role` mantem EXECUTE; ambos seguem operando.

REVOKE EXECUTE ON FUNCTION public.truncate_mirror_table(text)
  FROM PUBLIC, anon, authenticated;

COMMIT;


-- ---------------------------------------------------------------------
-- VALIDACAO (rodar junto; esperado: anon 0 / authenticated inalterado)
-- ---------------------------------------------------------------------
SELECT 'mirror.tabelas' AS alvo,
       count(*) FILTER (WHERE has_table_privilege('anon', c.oid,'SELECT'))          AS anon_esperado_0,
       count(*) FILTER (WHERE has_table_privilege('authenticated', c.oid,'SELECT')) AS auth_esperado_18
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'mirror' AND c.relkind IN ('r','v','m','p','f');

SELECT 'public.rpc_*' AS alvo,
       count(*) FILTER (WHERE has_function_privilege('anon', p.oid,'EXECUTE'))          AS anon_esperado_0,
       count(*) FILTER (WHERE has_function_privilege('authenticated', p.oid,'EXECUTE')) AS auth_esperado_28
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname LIKE 'rpc\_%';

SELECT 'truncate_mirror_table' AS alvo,
       has_function_privilege('anon',          p.oid,'EXECUTE') AS anon_esperado_f,
       has_function_privilege('authenticated', p.oid,'EXECUTE') AS auth_esperado_f,
       has_function_privilege('postgres',      p.oid,'EXECUTE') AS postgres_esperado_t
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'truncate_mirror_table';


-- =====================================================================
-- ROLLBACK (restaura o estado atual — inseguro — em segundos)
-- =====================================================================
-- Rodar como supabase_admin:
--
--   -- ATENCAO: o estado anterior era 18/19, NAO 19/19. `anon` NUNCA teve
--   -- SELECT em mirror.crm_carteira_clientes_bak_20260630 (backup com 15.222
--   -- linhas de carteira; `authenticated` tambem nao le). Um
--   -- `GRANT ... ON ALL TABLES` aqui ABRIRIA um vazamento que nunca existiu —
--   -- dentro do rollback do documento que fecha vazamento. Por isso o REVOKE
--   -- logo apos o GRANT:
--   GRANT SELECT ON ALL TABLES IN SCHEMA mirror TO anon;
--   REVOKE SELECT ON mirror.crm_carteira_clientes_bak_20260630 FROM anon;
--   ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA mirror
--     GRANT SELECT ON TABLES TO anon;
--   DO $$ DECLARE f record; BEGIN
--     FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
--              JOIN pg_namespace n ON n.oid = p.pronamespace
--              WHERE n.nspname='public' AND p.proname LIKE 'rpc\_%'
--     LOOP
--       EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO PUBLIC', f.sig);
--       EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon',   f.sig);
--     END LOOP; END $$;
--   GRANT EXECUTE ON FUNCTION public.truncate_mirror_table(text)
--     TO PUBLIC, anon, authenticated;
--
-- NAO ha nada a reverter quanto ao `ALTER ... FOR ROLE postgres` da Parte 1.
-- Verificado no `pg_default_acl` real (antes E depois): o schema mirror so tem
-- as entradas `postgres|S` (sequences) e `supabase_admin|r` (tables). NUNCA
-- existiu entrada `postgres|r`, e o ALTER daquela linha foi um NO-OP
-- preventivo (revogar algo nunca concedido nao cria entrada).
-- **NAO execute um GRANT correspondente para "restaurar" essa entrada** — ele
-- a CRIARIA, e toda tabela futura criada por `postgres` em mirror passaria a
-- nascer legivel por `anon`. Seria introduzir o bug que esta migration fecha.
--
--
-- =====================================================================
-- FORA DE ESCOPO — ACHADOS QUE PRECISAM DE DECISAO SEPARADA
-- =====================================================================
-- 0) [PENDENCIA REGISTRADA — nao corrigida aqui, vira demanda SIMPLE propria]
--    O corpo de `truncate_mirror_table` (definido em
--    20260603_create_mirror_schema.sql:202) tem o comentario
--    `-- Whitelist: only mirror schema tables allowed` sobre um
--    `IF table_name NOT LIKE 'mirror.%'`. **Isso NAO e whitelist, e checagem
--    de prefixo**: aceita qualquer uma das 19 tabelas de mirror, incluindo
--    `sync_control` e `sync_metadata`. Nao ha SQL injection (o `%I` do
--    format() quota o identificador), mas o comentario mente e a proxima
--    pessoa vai confiar nele. Correcao (~30 min): trocar o LIKE por checagem
--    real em `pg_tables` + corrigir o comentario.
--
-- 1) `truncate_mirror_table` foi CORRIGIDO na Parte 3 desta migration.
--    Residual: a funcao continua sem validar o nome da tabela alem do
--    prefixo (vide item 0). Hoje so `postgres`/`service_role` executam, entao
--    nao e mais exploravel externamente — mas a validacao fraca deveria ser endurecida
--    (whitelist de tabelas, nao prefixo) num pipeline proprio.
--
-- 2) RLS ativo em apenas 6 das 19 tabelas de `mirror`. Com os REVOKEs acima
--    isso deixa de ser exploravel por `anon`, mas continua sendo a unica
--    barreira entre um usuario logado qualquer e os dados de todos.
--
-- 3) `public.profiles`, `user_permissions`, `app_modules`, `metas_comerciais`
--    tem SELECT para `anon`. Todas com RLS ativo, entao dependem inteiramente
--    das policies estarem corretas — auditar com @security.
--
-- 4) Default privilege de SEQUENCES em `mirror` ainda concede `rU` a `anon`
--    (dono: postgres). Baixo impacto, mas e residuo do mesmo problema.
-- =====================================================================
