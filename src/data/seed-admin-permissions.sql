-- ============================================================
-- SEED: admin permissions
--============================================================
-- RODE contra o DB VPS ANTES do deploy do codigo.
-- Comando: psql $DATABASE_URL -f src/data/seed-admin-permissions.sql
--
-- Objetivo: garantir que os 3 admins atuais tenham acesso a TODOS
-- os 22 modulos antes da nova semantica entrar em producao.
-- Nova semantica: "sem registro = sem acesso" (sem bypass).
-- Idempotente via ON CONFLICT na constraint UNIQUE
-- (user_permissions_user_id_module_id_key).
-- ============================================================

BEGIN;

  -- Seed: garante que admins atuais tem acesso a TODOS os modulos.
  -- Necessario porque a nova semantica eh "sem registro = sem acesso".
  -- Idempotente via ON CONFLICT na UNIQUE (user_id, module_id).
  INSERT INTO public.user_permissions (user_id, module_id, is_visible, granted_by)
  SELECT p.id, m.id, true, p.id
  FROM public.profiles p
  CROSS JOIN public.app_modules m
  WHERE p.role = 'admin'
  ON CONFLICT (user_id, module_id) DO NOTHING;

COMMIT;
