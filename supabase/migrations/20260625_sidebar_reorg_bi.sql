-- BI Sidebar Reorganization: rename labels, reorder, remove Inteligencia
-- Decision: Opcao A (quick wins) — labels + sort_order only, no schema change

-- 1. Reorder and rename
UPDATE public.app_modules SET label = 'Visao Geral',            sort_order = 9  WHERE id = 'bi.painel';
UPDATE public.app_modules SET label = 'Acoes',                  sort_order = 10 WHERE id = 'bi.acoes';
UPDATE public.app_modules SET label = 'Negocios',               sort_order = 11 WHERE id = 'bi.comercial';
UPDATE public.app_modules SET label = 'Pedidos',                sort_order = 12 WHERE id = 'bi.pedidos';
UPDATE public.app_modules SET label = 'Servicos',               sort_order = 13 WHERE id = 'bi.servicos';
UPDATE public.app_modules SET label = 'Produtividade Tecnica',  sort_order = 14 WHERE id = 'bi.operacional';
UPDATE public.app_modules SET label = 'Base Instalada',         sort_order = 15 WHERE id = 'bi.produtos';
UPDATE public.app_modules SET label = 'Carteira de Clientes',   sort_order = 16 WHERE id = 'bi.admin';

-- 2. Remove Inteligencia from nav (user decision: retirar do menu)
DELETE FROM public.role_modules    WHERE module_id = 'bi.inteligencia';
DELETE FROM public.user_permissions WHERE module_id = 'bi.inteligencia';
DELETE FROM public.app_modules     WHERE id         = 'bi.inteligencia';
