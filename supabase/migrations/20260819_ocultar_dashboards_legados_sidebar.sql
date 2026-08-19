-- Go-live da navegação consolidada do BI.
-- Rotas, permissões e código legado permanecem como fallback temporário; esta
-- migration altera somente o que aparece na sidebar para usuários existentes.

UPDATE public.app_modules
SET label = CASE id
  WHEN 'bi.comercial' THEN 'Vendas & Resultados'
  WHEN 'bi.servicos' THEN 'Pós-Venda & Serviços'
  WHEN 'crm.overview' THEN 'Visão Geral'
  ELSE label
END
WHERE id IN ('bi.comercial', 'bi.servicos', 'crm.overview');

UPDATE public.user_permissions
SET is_visible = false
WHERE module_id IN (
  -- Absorvidos pelas abas consolidadas
  'bi.painel',
  'bi.pedidos',
  'bi.produtos',
  'bi.operacional',
  'bi.admin',
  'bi.inteligencia',
  -- CRM legado que não compõe a entrega principal
  'crm.mapa',
  'crm.negocios',
  'crm.criticos',
  'crm.insights',
  'crm.administrativo',
  -- Relatório legado fora da navegação executiva
  'tools.performance'
);
