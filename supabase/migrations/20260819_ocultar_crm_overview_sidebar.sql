-- A única entrada intitulada "Visão Geral" na sidebar é o BI Painel.
-- O CRM Overview permanece acessível por rota direta como fallback.

UPDATE public.user_permissions
SET is_visible = false
WHERE module_id = 'crm.overview';
