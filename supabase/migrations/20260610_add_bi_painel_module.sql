-- Add bi.painel module as first item in BI ANALYTICS group
INSERT INTO public.app_modules (id, label, group_id, group_label, sort_order, icon_name)
VALUES ('bi.painel', 'Painel', 'bi', 'BI ANALYTICS', 9, 'LayoutDashboard')
ON CONFLICT (id) DO NOTHING;

-- Grant access to all existing roles that have bi.comercial
INSERT INTO public.role_modules (role_id, module_id)
SELECT role_id, 'bi.painel'
FROM public.role_modules
WHERE module_id = 'bi.comercial'
ON CONFLICT DO NOTHING;
