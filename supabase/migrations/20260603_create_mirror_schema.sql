-- Migration: Create mirror schema for Campus Dealer data sync
-- Author: @data-engineer (Dara)
-- Date: 2026-06-03
-- Description: Creates schema mirror with 9 business tables, 2 control tables,
--              indexes, RLS policies, and truncate helper function.

-- =============================================================================
-- 1. SCHEMA
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS mirror;

-- =============================================================================
-- 2. CONTROL TABLES
-- =============================================================================

-- Metadata de sync por view
CREATE TABLE mirror.sync_metadata (
    id              serial PRIMARY KEY,
    view_name       text UNIQUE NOT NULL,
    last_watermark  text,
    last_sync_at    timestamptz,
    strategy        text NOT NULL DEFAULT 'full'
        CHECK (strategy IN ('incremental', 'full')),
    row_count       integer DEFAULT 0
);

-- Log de execucoes
CREATE TABLE mirror.sync_log (
    id              bigserial PRIMARY KEY,
    view_name       text NOT NULL,
    started_at      timestamptz NOT NULL DEFAULT now(),
    finished_at     timestamptz,
    status          text NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'success', 'error')),
    rows_affected   integer DEFAULT 0,
    duration_ms     integer,
    error_message   text,
    strategy_used   text
);

CREATE INDEX idx_sync_log_view_started ON mirror.sync_log(view_name, started_at DESC);
CREATE INDEX idx_sync_log_status ON mirror.sync_log(status) WHERE status = 'error';

-- =============================================================================
-- 3. BUSINESS TABLES
-- =============================================================================

-- 3.1 crm_negocios (source: VW_Ceres_CRM_Negocios)
CREATE TABLE mirror.crm_negocios (
    ngo_numero            text NOT NULL,
    ngo_conclusao         text,
    ngo_etapa             text,
    ngo_funil             text,
    ngo_vlr_total         numeric(15,2),
    ngo_forma_entrada     text,
    ngo_motivo_perda      text,
    ngo_motivo_ganho      text,
    ngo_ciclo_vendas      integer,
    ngo_qtd_acoes         integer,
    ngo_probabilidade     integer,
    ngo_vendedores        text,
    ngo_data_cadastro     timestamptz,
    ngo_data_fechamento   timestamptz,
    synced_at             timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (ngo_numero)
);

CREATE INDEX idx_negocios_data_cadastro ON mirror.crm_negocios(ngo_data_cadastro);
CREATE INDEX idx_negocios_data_fechamento ON mirror.crm_negocios(ngo_data_fechamento);
CREATE INDEX idx_negocios_vendedores ON mirror.crm_negocios(ngo_vendedores);
CREATE INDEX idx_negocios_conclusao ON mirror.crm_negocios(ngo_conclusao);
CREATE INDEX idx_negocios_funil ON mirror.crm_negocios(ngo_funil);

-- 3.2 crm_pedidos (source: VW_Ceres_CRM_Pedidos)
CREATE TABLE mirror.crm_pedidos (
    ngo_numero            text NOT NULL,
    pdo_situacao          text,
    pdo_vlr_pedido        numeric(15,2),
    pdo_vlr_financiado    numeric(15,2),
    pdo_vlr_recurso_proprio numeric(15,2),
    pdo_cidade_uf_entrega text,
    pdo_vendedor          text,
    pdo_dth_pedido        timestamptz,
    synced_at             timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (ngo_numero, pdo_dth_pedido)
);

CREATE INDEX idx_pedidos_situacao ON mirror.crm_pedidos(pdo_situacao);
CREATE INDEX idx_pedidos_dth ON mirror.crm_pedidos(pdo_dth_pedido);
CREATE INDEX idx_pedidos_vendedor ON mirror.crm_pedidos(pdo_vendedor);

-- 3.3 crm_pedidos_item (source: VW_Ceres_CRM_PedidosItem)
CREATE TABLE mirror.crm_pedidos_item (
    id                    bigserial PRIMARY KEY,
    pdo_item_grupo        text,
    pdo_item_marca        text,
    pdo_item_modelo       text,
    pdo_item_qtde         integer,
    pdo_item_vlr_unitario numeric(15,2),
    synced_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pedidos_item_grupo ON mirror.crm_pedidos_item(pdo_item_grupo);
CREATE INDEX idx_pedidos_item_marca ON mirror.crm_pedidos_item(pdo_item_marca);

-- 3.4 crm_carteira_clientes (source: VW_Ceres_CRM_CarteiraClientes)
CREATE TABLE mirror.crm_carteira_clientes (
    cli_id_cliente        text NOT NULL,
    cli_tipo_cliente      text,
    cli_prospect          text,
    cli_uf                text,
    cli_cidade            text,
    usr_nome_usuario      text,
    synced_at             timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (cli_id_cliente)
);

CREATE INDEX idx_carteira_tipo ON mirror.crm_carteira_clientes(cli_tipo_cliente);
CREATE INDEX idx_carteira_uf ON mirror.crm_carteira_clientes(cli_uf);
CREATE INDEX idx_carteira_usuario ON mirror.crm_carteira_clientes(usr_nome_usuario);

-- 3.5 crm_acoes (source: VW_Ceres_CRM_Acoes, strategy: incremental)
CREATE TABLE mirror.crm_acoes (
    id                    bigserial PRIMARY KEY,
    emp_cidade            text,
    cli_nome              text,
    aco_tipo_contato      text,
    aco_tipo_acao         text,
    aco_vendedor          text,
    aco_atividade_executada text,
    aco_lat               numeric(10,7),
    aco_lon               numeric(10,7),
    aco_dth_conclusao     timestamptz,
    synced_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_acoes_dth ON mirror.crm_acoes(aco_dth_conclusao);
CREATE INDEX idx_acoes_vendedor ON mirror.crm_acoes(aco_vendedor);
CREATE INDEX idx_acoes_tipo ON mirror.crm_acoes(aco_tipo_acao);
CREATE INDEX idx_acoes_cidade ON mirror.crm_acoes(emp_cidade);

-- 3.6 crm_funil_etapa (source: VW_Ceres_CRM_Negocios_Etapas)
CREATE TABLE mirror.crm_funil_etapa (
    id                    bigserial PRIMARY KEY,
    ngo_numero            text NOT NULL,
    funil_dsc             text,
    etapa_dsc_status      text,
    fne_duracao_dias      integer,
    synced_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_funil_ngo ON mirror.crm_funil_etapa(ngo_numero);
CREATE INDEX idx_funil_dsc ON mirror.crm_funil_etapa(funil_dsc);
CREATE INDEX idx_funil_etapa_status ON mirror.crm_funil_etapa(etapa_dsc_status);

-- 3.7 usuarios (source: VW_Ceres_Usuario)
CREATE TABLE mirror.usuarios (
    usr_cod_usuario       text NOT NULL,
    usr_id_usuario        text,
    usr_nome_usuario      text,
    synced_at             timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (usr_cod_usuario)
);

CREATE INDEX idx_usuarios_id ON mirror.usuarios(usr_id_usuario);

-- 3.8 ordens_servico (source: VW_Ceres_OrdemServico, strategy: incremental)
CREATE TABLE mirror.ordens_servico (
    os_nr_os              text NOT NULL,
    os_f_status           text,
    sit_dsc_situacao_os   text,
    os_dth_abertura       timestamptz,
    os_dth_encerramento   timestamptz,
    synced_at             timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (os_nr_os)
);

CREATE INDEX idx_os_status ON mirror.ordens_servico(os_f_status);
CREATE INDEX idx_os_abertura ON mirror.ordens_servico(os_dth_abertura);
CREATE INDEX idx_os_encerramento ON mirror.ordens_servico(os_dth_encerramento);

-- 3.9 cliente_parque_maquinas (source: VW_Ceres_CRM_ClienteParqueMaquinas)
CREATE TABLE mirror.cliente_parque_maquinas (
    id                    bigserial PRIMARY KEY,
    cli_id_cliente        text,
    pqm_grupo             text,
    pqm_marca             text,
    pqm_modelo            text,
    pqm_qtd_maquinas      integer,
    synced_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_parque_cliente ON mirror.cliente_parque_maquinas(cli_id_cliente);
CREATE INDEX idx_parque_grupo ON mirror.cliente_parque_maquinas(pqm_grupo);
CREATE INDEX idx_parque_marca ON mirror.cliente_parque_maquinas(pqm_marca);

-- =============================================================================
-- 4. TRUNCATE HELPER (RPC via public schema for PostgREST access)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.truncate_mirror_table(table_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Whitelist: only mirror schema tables allowed
  IF table_name NOT LIKE 'mirror.%' THEN
    RAISE EXCEPTION 'Only mirror schema tables allowed, got: %', table_name;
  END IF;
  EXECUTE format('TRUNCATE %I.%I', split_part(table_name, '.', 1), split_part(table_name, '.', 2));
END;
$$;

-- =============================================================================
-- 5. ROW LEVEL SECURITY
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE mirror.sync_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE mirror.sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE mirror.crm_negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE mirror.crm_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE mirror.crm_pedidos_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE mirror.crm_carteira_clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mirror.crm_acoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE mirror.crm_funil_etapa ENABLE ROW LEVEL SECURITY;
ALTER TABLE mirror.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE mirror.ordens_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE mirror.cliente_parque_maquinas ENABLE ROW LEVEL SECURITY;

-- Policies: anon/authenticated = SELECT only; service_role = ALL
CREATE POLICY "anon_read" ON mirror.crm_negocios FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_write" ON mirror.crm_negocios FOR ALL TO service_role USING (true);

CREATE POLICY "anon_read" ON mirror.crm_pedidos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_write" ON mirror.crm_pedidos FOR ALL TO service_role USING (true);

CREATE POLICY "anon_read" ON mirror.crm_pedidos_item FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_write" ON mirror.crm_pedidos_item FOR ALL TO service_role USING (true);

CREATE POLICY "anon_read" ON mirror.crm_carteira_clientes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_write" ON mirror.crm_carteira_clientes FOR ALL TO service_role USING (true);

CREATE POLICY "anon_read" ON mirror.crm_acoes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_write" ON mirror.crm_acoes FOR ALL TO service_role USING (true);

CREATE POLICY "anon_read" ON mirror.crm_funil_etapa FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_write" ON mirror.crm_funil_etapa FOR ALL TO service_role USING (true);

CREATE POLICY "anon_read" ON mirror.usuarios FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_write" ON mirror.usuarios FOR ALL TO service_role USING (true);

CREATE POLICY "anon_read" ON mirror.ordens_servico FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_write" ON mirror.ordens_servico FOR ALL TO service_role USING (true);

CREATE POLICY "anon_read" ON mirror.cliente_parque_maquinas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_write" ON mirror.cliente_parque_maquinas FOR ALL TO service_role USING (true);

CREATE POLICY "anon_read_meta" ON mirror.sync_metadata FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_write_meta" ON mirror.sync_metadata FOR ALL TO service_role USING (true);

CREATE POLICY "anon_read_log" ON mirror.sync_log FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_write_log" ON mirror.sync_log FOR ALL TO service_role USING (true);

-- =============================================================================
-- 6. SEED DATA (sync_metadata initial config)
-- =============================================================================

INSERT INTO mirror.sync_metadata (view_name, strategy) VALUES
    ('VW_Ceres_CRM_Negocios',              'full'),
    ('VW_Ceres_CRM_Pedidos',               'full'),
    ('VW_Ceres_CRM_PedidosItem',           'full'),
    ('VW_Ceres_CRM_CarteiraClientes',      'full'),
    ('VW_Ceres_CRM_Acoes',                 'incremental'),
    ('VW_Ceres_CRM_Negocios_Etapas',       'full'),
    ('VW_Ceres_Usuario',                   'full'),
    ('VW_Ceres_OrdemServico',              'incremental'),
    ('VW_Ceres_CRM_ClienteParqueMaquinas', 'full');

-- =============================================================================
-- 7. GRANT USAGE on schema to roles
-- =============================================================================

GRANT USAGE ON SCHEMA mirror TO anon, authenticated, service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA mirror TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA mirror TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA mirror TO service_role;
