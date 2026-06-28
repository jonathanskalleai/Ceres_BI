-- Full Sidebar Reorganization: rename CRM group + labels, reorder, remove crm.regioes, update tools labels
-- Follows pattern from 20260625_sidebar_reorg_bi.sql

BEGIN;

-- ============================================================
-- 1. Rename group_label: "COMERCIAL CRM" → "COMERCIAL"
-- ============================================================
UPDATE public.app_modules
SET group_label = 'COMERCIAL'
WHERE group_id = 'comercial';

-- ============================================================
-- 2. CRM modules: update labels + sort_order + icon_name
-- ============================================================
UPDATE public.app_modules SET label = 'Painel Comercial',       sort_order = 1, icon_name = 'LayoutDashboard'      WHERE id = 'crm.overview';
UPDATE public.app_modules SET label = 'Equipe',                 sort_order = 2, icon_name = 'Users'                 WHERE id = 'crm.consultores';
UPDATE public.app_modules SET label = 'Atividades',             sort_order = 3, icon_name = 'Table2'                WHERE id = 'crm.registros';
UPDATE public.app_modules SET label = 'Mapa de Cobertura',      sort_order = 4, icon_name = 'Map'                   WHERE id = 'crm.mapa';
UPDATE public.app_modules SET label = 'Pipeline',               sort_order = 5, icon_name = 'Handshake'             WHERE id = 'crm.negocios';
UPDATE public.app_modules SET label = 'Clientes sem Contato',   sort_order = 6, icon_name = 'AlertTriangle'         WHERE id = 'crm.criticos';
UPDATE public.app_modules SET label = 'Notas de Campo',         sort_order = 7, icon_name = 'MessageSquareText'     WHERE id = 'crm.insights';
UPDATE public.app_modules SET label = 'Gestao Interna',         sort_order = 8, icon_name = 'ClipboardList'          WHERE id = 'crm.administrativo';

-- ============================================================
-- 3. Remove crm.regioes (no page exists for it)
-- ============================================================
DELETE FROM public.user_permissions  WHERE module_id = 'crm.regioes';
DELETE FROM public.app_modules       WHERE id        = 'crm.regioes';

-- ============================================================
-- 4. Ferramentas: update labels
-- ============================================================
UPDATE public.app_modules SET label = 'Explorador de Dados' WHERE id = 'tools.explorer';
UPDATE public.app_modules SET label = 'Relatorio Anual'     WHERE id = 'tools.performance';

COMMIT;
