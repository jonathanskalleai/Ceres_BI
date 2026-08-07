-- Add bi.inteligencia module to BI ANALYTICS group
INSERT INTO public.app_modules (id, label, group_id, group_label, sort_order, icon_name)
VALUES ('bi.inteligencia', 'Inteligencia', 'bi', 'BI ANALYTICS', 18, 'Brain')
ON CONFLICT (id) DO NOTHING;

-- Grant access to all existing roles that have bi.painel
INSERT INTO public.role_modules (role_id, module_id)
SELECT role_id, 'bi.inteligencia'
FROM public.role_modules
WHERE module_id = 'bi.painel'
ON CONFLICT DO NOTHING;
