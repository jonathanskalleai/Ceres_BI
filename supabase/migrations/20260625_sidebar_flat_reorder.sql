-- Flatten sidebar: reorder sort_order globally
-- BI first (1-8), then CRM (9-16), then Ferramentas (17-18), then Admin (19-20)
-- This supports the UI change from collapsible groups to a single flat list.

BEGIN;

-- BI Analytics: sort 1-8
UPDATE public.app_modules SET sort_order = 1  WHERE id = 'bi.painel';
UPDATE public.app_modules SET sort_order = 2  WHERE id = 'bi.acoes';
UPDATE public.app_modules SET sort_order = 3  WHERE id = 'bi.comercial';
UPDATE public.app_modules SET sort_order = 4  WHERE id = 'bi.pedidos';
UPDATE public.app_modules SET sort_order = 5  WHERE id = 'bi.servicos';
UPDATE public.app_modules SET sort_order = 6  WHERE id = 'bi.operacional';
UPDATE public.app_modules SET sort_order = 7  WHERE id = 'bi.produtos';
UPDATE public.app_modules SET sort_order = 8  WHERE id = 'bi.admin';

-- CRM / Comercial: sort 9-16
UPDATE public.app_modules SET sort_order = 9  WHERE id = 'crm.overview';
UPDATE public.app_modules SET sort_order = 10 WHERE id = 'crm.consultores';
UPDATE public.app_modules SET sort_order = 11 WHERE id = 'crm.registros';
UPDATE public.app_modules SET sort_order = 12 WHERE id = 'crm.mapa';
UPDATE public.app_modules SET sort_order = 13 WHERE id = 'crm.negocios';
UPDATE public.app_modules SET sort_order = 14 WHERE id = 'crm.criticos';
UPDATE public.app_modules SET sort_order = 15 WHERE id = 'crm.insights';
UPDATE public.app_modules SET sort_order = 16 WHERE id = 'crm.administrativo';

-- Ferramentas: sort 17-18
UPDATE public.app_modules SET sort_order = 17 WHERE id = 'tools.explorer';
UPDATE public.app_modules SET sort_order = 18 WHERE id = 'tools.performance';

-- Admin: sort 19-20
UPDATE public.app_modules SET sort_order = 19 WHERE id = 'admin.users';
UPDATE public.app_modules SET sort_order = 20 WHERE id = 'admin.profile';

COMMIT;
