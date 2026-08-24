-- Desempenho de Vendas deve seguir o mesmo controle explícito de acesso dos
-- demais dashboards: sem registro em user_permissions, não aparece nem abre.

BEGIN;

INSERT INTO public.app_modules (id, label, group_id, group_label, sort_order, icon_name)
VALUES ('bi.desempenho', 'Desempenho de Vendas', 'bi', 'BI ANALYTICS', 12, 'BarChart3')
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  group_id = EXCLUDED.group_id,
  group_label = EXCLUDED.group_label,
  sort_order = EXCLUDED.sort_order,
  icon_name = EXCLUDED.icon_name;

-- Mantém o dashboard disponível para administradores, que administram os
-- demais acessos pela própria tela de permissões.
INSERT INTO public.user_permissions (user_id, module_id, is_visible, granted_by)
SELECT profile.id, 'bi.desempenho', true, profile.id
FROM public.profiles AS profile
WHERE profile.role = 'admin'
ON CONFLICT (user_id, module_id) DO NOTHING;

COMMIT;
