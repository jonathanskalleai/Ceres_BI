-- A Visão Geral de cards (bi.painel) é a entrada executiva do BI e deve
-- permanecer visível. Esta correção não reexibe os demais dashboards legados.

UPDATE public.app_modules
SET label = 'Visão Geral'
WHERE id = 'bi.painel';

UPDATE public.user_permissions
SET is_visible = true
WHERE module_id = 'bi.painel';
