-- Migration: pg_cron jobs for mirror incremental sync
-- Author: @data-engineer (Dara)
-- Date: 2026-06-04
-- Description: Schedules recurring sync of Campus Dealer views via edge function.
--   - Incremental views (crm_acoes, ordens_servico): every 5 minutes
--   - Full views (all others): daily at 03:00 UTC (off-peak)
-- Prerequisites: pg_cron extension (created in 20260318132753), pg_net extension

-- =============================================================================
-- 1. INCREMENTAL SYNC — every 5 minutes
-- =============================================================================

SELECT cron.schedule(
  'mirror-sync-incremental',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-campus-dealer',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"views":["VW_Ceres_CRM_Acoes","VW_Ceres_OrdemServico"]}'::jsonb
  );
  $$
);

-- =============================================================================
-- 2. FULL SYNC — daily at 03:00 UTC
-- =============================================================================

SELECT cron.schedule(
  'mirror-sync-full-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/sync-campus-dealer',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"views":["VW_Ceres_CRM_Negocios","VW_Ceres_CRM_Pedidos","VW_Ceres_CRM_PedidosItem","VW_Ceres_CRM_CarteiraClientes","VW_Ceres_CRM_Negocios_Etapas","VW_Ceres_Usuario","VW_Ceres_CRM_ClienteParqueMaquinas"]}'::jsonb
  );
  $$
);

-- =============================================================================
-- 3. REQUIRED: app.settings for self-hosted Supabase
-- =============================================================================
-- These settings must be configured in postgresql.conf or via ALTER SYSTEM:
--
--   ALTER DATABASE postgres SET app.settings.supabase_url = 'https://ceressupabasebi.vouxconsultoria.com.br';
--   ALTER DATABASE postgres SET app.settings.service_role_key = '<service-role-key>';
--
-- After setting, run: SELECT pg_reload_conf();
-- Without these settings, the cron jobs will fail with "unrecognized configuration parameter".
