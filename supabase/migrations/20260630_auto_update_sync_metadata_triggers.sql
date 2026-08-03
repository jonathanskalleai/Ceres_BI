-- =============================================================================
-- Migration: Auto-update sync_metadata via triggers (ETL visibility)
-- Author: @dev (Dex)
-- Date: 2026-06-30
-- =============================================================================
-- Problem:
--   O ETL Python (etl_campos_dealer.py) sincroniza dados perfeitamente para
--   as tabelas mirror.*, mas NAO escreve em mirror.sync_metadata. Resultado:
--   o frontend (BiEtlMonitor) mostra stale/erro mesmo com ETL rodando.
--
-- Solution:
--   Criar triggers AFTER INSERT/UPDATE em cada tabela mirror.* que detectam
--   modificacoes e atualizam sync_metadata automaticamente.
--
--   - Quando dados sao inseridos/atualizados em uma tabela mirror, o trigger
--     mapeia para o view_name correspondente e faz UPDATE em sync_metadata.
--   - Sem dependencia do ETL Python (que pode ou nao escrever em sync_metadata).
--   - Banco se torna fonte da verdade sobre ele mesmo.
--
-- Strategy:
--   - Trigger generico: detecta TG_TABLE_NAME e mapeia para view_name
--   - Atualiza last_sync_at = now() e row_count = COUNT(*)
--   - Sem log de error (sucesso sempre)
--
-- Prerequisites:
--   - mirror.sync_metadata existe (20260603_create_mirror_schema.sql)
--   - ETL Python ja sincroniza dados (mas nao metadata)
--
-- Rollback:
--   DROP TRIGGER IF EXISTS trg_auto_update_sync_metadata ON [tabela];
--   DROP FUNCTION IF EXISTS mirror.fn_auto_update_sync_metadata();
-- =============================================================================

-- =============================================================================
-- 1. TRIGGER FUNCTION — auto-update sync_metadata baseado em TG_TABLE_NAME
-- =============================================================================

CREATE OR REPLACE FUNCTION mirror.fn_auto_update_sync_metadata()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_view_name text;
  v_row_count int;
BEGIN
  -- Mapeamento: nome da tabela mirror.* -> view_name SQL Server
  v_view_name := CASE TG_TABLE_NAME
    WHEN 'crm_negocios'             THEN 'VW_Ceres_CRM_Negocios'
    WHEN 'crm_pedidos'              THEN 'VW_Ceres_CRM_Pedidos'
    WHEN 'crm_pedidos_item'         THEN 'VW_Ceres_CRM_PedidosItem'
    WHEN 'crm_carteira_clientes'    THEN 'VW_Ceres_CRM_CarteiraClientes'
    WHEN 'crm_acoes'                THEN 'VW_Ceres_CRM_Acoes'
    WHEN 'crm_funil_etapa'          THEN 'VW_Ceres_CRM_Negocios_Etapas'
    WHEN 'usuarios'                 THEN 'VW_Ceres_Usuario'
    WHEN 'ordens_servico'           THEN 'VW_Ceres_OrdemServico'
    WHEN 'cliente_parque_maquinas'  THEN 'VW_Ceres_CRM_ClienteParqueMaquinas'
    WHEN 'tecnico_tempo'            THEN 'VW_Ceres_TecnicoTempo'
    WHEN 'agenda_servico'           THEN 'VW_Ceres_Agenda'
    WHEN 'atendimentos_os'          THEN 'VW_Ceres_AtendimentoOS'
    WHEN 'ocorrencias_os'           THEN 'VW_Ceres_Ocorrencias'
    ELSE NULL
  END;

  -- Se nao tem mapeamento, nao faz nada (tabela nao monitorada)
  IF v_view_name IS NULL THEN
    RETURN NEW;
  END IF;

  -- Conta linhas na tabela (pode ser caro em tabelas grandes, mas ETL roda a cada 15min)
  EXECUTE format('SELECT COUNT(*) FROM mirror.%I', TG_TABLE_NAME)
  INTO v_row_count;

  -- Atualiza sync_metadata
  UPDATE mirror.sync_metadata
  SET last_sync_at = now(),
      row_count = v_row_count
  WHERE view_name = v_view_name;

  RETURN NEW;
END;
$$;

-- =============================================================================
-- 2. TRIGGERS — uma por tabela monitorada
-- =============================================================================

-- Drop existing triggers (idempotent)
DROP TRIGGER IF EXISTS trg_auto_sync_metadata_crm_negocios             ON mirror.crm_negocios;
DROP TRIGGER IF EXISTS trg_auto_sync_metadata_crm_pedidos              ON mirror.crm_pedidos;
DROP TRIGGER IF EXISTS trg_auto_sync_metadata_crm_pedidos_item         ON mirror.crm_pedidos_item;
DROP TRIGGER IF EXISTS trg_auto_sync_metadata_crm_carteira_clientes    ON mirror.crm_carteira_clientes;
DROP TRIGGER IF EXISTS trg_auto_sync_metadata_crm_acoes                ON mirror.crm_acoes;
DROP TRIGGER IF EXISTS trg_auto_sync_metadata_crm_funil_etapa          ON mirror.crm_funil_etapa;
DROP TRIGGER IF EXISTS trg_auto_sync_metadata_usuarios                 ON mirror.usuarios;
DROP TRIGGER IF EXISTS trg_auto_sync_metadata_ordens_servico           ON mirror.ordens_servico;
DROP TRIGGER IF EXISTS trg_auto_sync_metadata_cliente_parque_maquinas  ON mirror.cliente_parque_maquinas;
DROP TRIGGER IF EXISTS trg_auto_sync_metadata_tecnico_tempo            ON mirror.tecnico_tempo;
DROP TRIGGER IF EXISTS trg_auto_sync_metadata_agenda_servico           ON mirror.agenda_servico;
DROP TRIGGER IF EXISTS trg_auto_sync_metadata_atendimentos_os          ON mirror.atendimentos_os;
DROP TRIGGER IF EXISTS trg_auto_sync_metadata_ocorrencias_os           ON mirror.ocorrencias_os;

-- Create triggers (AFTER INSERT OR UPDATE — captura todas as modificacoes)
CREATE TRIGGER trg_auto_sync_metadata_crm_negocios
  AFTER INSERT OR UPDATE ON mirror.crm_negocios
  FOR EACH STATEMENT
  EXECUTE FUNCTION mirror.fn_auto_update_sync_metadata();

CREATE TRIGGER trg_auto_sync_metadata_crm_pedidos
  AFTER INSERT OR UPDATE ON mirror.crm_pedidos
  FOR EACH STATEMENT
  EXECUTE FUNCTION mirror.fn_auto_update_sync_metadata();

CREATE TRIGGER trg_auto_sync_metadata_crm_pedidos_item
  AFTER INSERT OR UPDATE ON mirror.crm_pedidos_item
  FOR EACH STATEMENT
  EXECUTE FUNCTION mirror.fn_auto_update_sync_metadata();

CREATE TRIGGER trg_auto_sync_metadata_crm_carteira_clientes
  AFTER INSERT OR UPDATE ON mirror.crm_carteira_clientes
  FOR EACH STATEMENT
  EXECUTE FUNCTION mirror.fn_auto_update_sync_metadata();

CREATE TRIGGER trg_auto_sync_metadata_crm_acoes
  AFTER INSERT OR UPDATE ON mirror.crm_acoes
  FOR EACH STATEMENT
  EXECUTE FUNCTION mirror.fn_auto_update_sync_metadata();

CREATE TRIGGER trg_auto_sync_metadata_crm_funil_etapa
  AFTER INSERT OR UPDATE ON mirror.crm_funil_etapa
  FOR EACH STATEMENT
  EXECUTE FUNCTION mirror.fn_auto_update_sync_metadata();

CREATE TRIGGER trg_auto_sync_metadata_usuarios
  AFTER INSERT OR UPDATE ON mirror.usuarios
  FOR EACH STATEMENT
  EXECUTE FUNCTION mirror.fn_auto_update_sync_metadata();

CREATE TRIGGER trg_auto_sync_metadata_ordens_servico
  AFTER INSERT OR UPDATE ON mirror.ordens_servico
  FOR EACH STATEMENT
  EXECUTE FUNCTION mirror.fn_auto_update_sync_metadata();

CREATE TRIGGER trg_auto_sync_metadata_cliente_parque_maquinas
  AFTER INSERT OR UPDATE ON mirror.cliente_parque_maquinas
  FOR EACH STATEMENT
  EXECUTE FUNCTION mirror.fn_auto_update_sync_metadata();

CREATE TRIGGER trg_auto_sync_metadata_tecnico_tempo
  AFTER INSERT OR UPDATE ON mirror.tecnico_tempo
  FOR EACH STATEMENT
  EXECUTE FUNCTION mirror.fn_auto_update_sync_metadata();

CREATE TRIGGER trg_auto_sync_metadata_agenda_servico
  AFTER INSERT OR UPDATE ON mirror.agenda_servico
  FOR EACH STATEMENT
  EXECUTE FUNCTION mirror.fn_auto_update_sync_metadata();

CREATE TRIGGER trg_auto_sync_metadata_atendimentos_os
  AFTER INSERT OR UPDATE ON mirror.atendimentos_os
  FOR EACH STATEMENT
  EXECUTE FUNCTION mirror.fn_auto_update_sync_metadata();

CREATE TRIGGER trg_auto_sync_metadata_ocorrencias_os
  AFTER INSERT OR UPDATE ON mirror.ocorrencias_os
  FOR EACH STATEMENT
  EXECUTE FUNCTION mirror.fn_auto_update_sync_metadata();

-- =============================================================================
-- 3. NOTIFY PostgREST (nao necessario reload schema, mas boa pratica)
-- =============================================================================

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- 4. TEST — simular ETL rodando (insert dummy em uma tabela)
-- =============================================================================
-- Comentado para nao poluir dados em producao
-- Para testar: INSERT INTO mirror.crm_negocios (...) VALUES (...); depois SELECT * FROM mirror.sync_metadata;