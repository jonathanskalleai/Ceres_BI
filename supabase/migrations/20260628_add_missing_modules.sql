-- Add missing sidebar modules: bi.inteligencia + bi.etl-monitor
--
-- Gap: 'bi.etl-monitor' (and the Inteligencia page) never existed in
-- public.app_modules, so RLS-driven sidebar never rendered them for anyone.
--
-- New flat order (BI 1-10, CRM 11-18, Ferramentas 19-20, Admin 21-22):
--   bi.painel(1) bi.acoes(2) bi.comercial(3) bi.pedidos(4) bi.servicos(5)
--   bi.operacional(6) bi.produtos(7) bi.admin(8) bi.inteligencia(9) bi.etl-monitor(10)
--   crm.overview(11)..crm.administrativo(18) tools.explorer(19) tools.performance(20)
--   admin.users(21) admin.profile(22)
--
-- Idempotent: UPDATEs key off id (re-running is a no-op once at target value);
-- INSERTs use ON CONFLICT (id) DO NOTHING. sort_order has no UNIQUE constraint,
-- so transient overlaps during the transaction are harmless.

BEGIN;

-- 1) Reorder to free slots 9 (Inteligencia) and 10 (ETL Monitor).
--    BI 1-8 already correct (20260625); shift CRM/Tools/Admin down by 2.
UPDATE public.app_modules SET sort_order = 11 WHERE id = 'crm.overview';
UPDATE public.app_modules SET sort_order = 12 WHERE id = 'crm.consultores';
UPDATE public.app_modules SET sort_order = 13 WHERE id = 'crm.registros';
UPDATE public.app_modules SET sort_order = 14 WHERE id = 'crm.mapa';
UPDATE public.app_modules SET sort_order = 15 WHERE id = 'crm.negocios';
UPDATE public.app_modules SET sort_order = 16 WHERE id = 'crm.criticos';
UPDATE public.app_modules SET sort_order = 17 WHERE id = 'crm.insights';
UPDATE public.app_modules SET sort_order = 18 WHERE id = 'crm.administrativo';

UPDATE public.app_modules SET sort_order = 19 WHERE id = 'tools.explorer';
UPDATE public.app_modules SET sort_order = 20 WHERE id = 'tools.performance';

UPDATE public.app_modules SET sort_order = 21 WHERE id = 'admin.users';
UPDATE public.app_modules SET sort_order = 22 WHERE id = 'admin.profile';

-- 2) Insert/fix the two BI modules.
-- bi.inteligencia: a previous migration (20260615) may have inserted it with
-- sort_order=18 and icon_name='Brain' (not in ICON_MAP) — DO UPDATE fixes that.
INSERT INTO public.app_modules (id, label, group_id, group_label, sort_order, icon_name)
VALUES ('bi.inteligencia', 'Inteligencia', 'bi', 'BI ANALYTICS', 9, 'BarChart3')
ON CONFLICT (id) DO UPDATE SET
  sort_order  = EXCLUDED.sort_order,
  icon_name   = EXCLUDED.icon_name,
  group_label = EXCLUDED.group_label;

-- bi.etl-monitor: new, has never been in app_modules.
INSERT INTO public.app_modules (id, label, group_id, group_label, sort_order, icon_name)
VALUES ('bi.etl-monitor', 'Monitor ETL', 'bi', 'BI ANALYTICS', 10, 'Database')
ON CONFLICT (id) DO NOTHING;

COMMIT;
