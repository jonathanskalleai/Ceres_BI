-- Rebuild ALL mirror tables with complete columns from SQL Server views
-- Tables: crm_acoes, crm_negocios, crm_pedidos, crm_pedidos_item
-- This will lose existing data — a full re-sync is required after applying

-- =============================================================================
-- 1. crm_acoes (VW_Ceres_CRM_Acoes) — 31 columns
-- =============================================================================

DROP TABLE IF EXISTS mirror.crm_acoes CASCADE;

CREATE TABLE mirror.crm_acoes (
    id                        bigserial PRIMARY KEY,
    aco_id_acao               text NOT NULL UNIQUE,
    aco_codigo_acao           text,
    emp_cod_filial            text,
    emp_cnpj                  text,
    emp_nome                  text,
    emp_cidade                text,
    emp_uf                    text,
    cli_nome                  text,
    cli_cnpj_cpf              text,
    cli_codigo_cliente        text,
    cli_id_cliente            bigint,
    aco_tipo_contato          text,
    aco_tipo_acao             text,
    usr_id_usuario            bigint,
    usr_codigo_usuario        text,
    aco_vendedor              text,
    aco_dth_agenda_inicio     timestamptz,
    aco_dth_agenda_termino    timestamptz,
    aco_atividade_a_executar  text,
    aco_atividade_executada   text,
    aco_status                text,
    aco_dth_atualizacao       timestamptz,
    aco_lat                   numeric(10,7),
    aco_lon                   numeric(10,7),
    aco_contato               text,
    aco_dth_abertura          timestamptz,
    aco_dth_geolocalizacao    timestamptz,
    aco_acao_valida           text,
    aco_acao_reagendada       text,
    aco_dth_conclusao         timestamptz,
    ngo_nro_negocio           text,
    dth_registro              timestamptz,
    synced_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_acoes_id_acao ON mirror.crm_acoes(aco_id_acao);
CREATE INDEX idx_acoes_dth ON mirror.crm_acoes(aco_dth_conclusao);
CREATE INDEX idx_acoes_vendedor ON mirror.crm_acoes(aco_vendedor);
CREATE INDEX idx_acoes_tipo ON mirror.crm_acoes(aco_tipo_acao);
CREATE INDEX idx_acoes_cidade ON mirror.crm_acoes(emp_cidade);
CREATE INDEX idx_acoes_status ON mirror.crm_acoes(aco_status);
CREATE INDEX idx_acoes_valida ON mirror.crm_acoes(aco_acao_valida);
CREATE INDEX idx_acoes_cli_nome ON mirror.crm_acoes(cli_nome);

-- Re-enable RLS
ALTER TABLE mirror.crm_acoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON mirror.crm_acoes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_write" ON mirror.crm_acoes FOR ALL TO service_role USING (true);

-- =============================================================================
-- 2. crm_negocios (VW_Ceres_CRM_Negocios) — 91 columns, denormalized by product
-- =============================================================================

DROP TABLE IF EXISTS mirror.crm_negocios CASCADE;

CREATE TABLE mirror.crm_negocios (
    id                              bigserial PRIMARY KEY,
    -- Empresa
    emp_id_empresa                  bigint,
    emp_cod_filial                  text,
    emp_nome                        text,
    emp_cnpj                        text,
    emp_cidade                      text,
    emp_uf                          text,
    -- Negocio
    ngo_codigo_integracao           text,
    ngo_numero                      text,
    ngo_forma_entrada_cod_integracao text,
    ngo_forma_entrada               text,
    ngo_vlr_total_negociado         numeric(18,2),
    -- Produto (denormalized)
    prd_id_negocio_x_produto        bigint,
    prd_dth_registro_produto        timestamptz,
    prd_produto_codigo_integracao   text,
    prd_id_marca_produto            bigint,
    prd_marca_produto_cod_integracao text,
    prd_marca_produto               text,
    prd_id_produto                  bigint,
    prd_dsc_produto                 text,
    prd_codigo_produto              text,
    prd_id_grupo_produto            bigint,
    prd_grupo_produto_cod_integracao text,
    prd_grupo_produto               text,
    prd_id_modelo_produto           bigint,
    prd_modelo_produto_cod_integracao text,
    prd_modelo_produto              text,
    prd_condicao_produto            text,
    prd_qtde                        integer,
    prd_vlr_unitario                numeric(18,2),
    -- Negocio (cont.)
    ngo_probabilidade               integer,
    ngo_obs_negocio                 text,
    ngo_id_funil                    bigint,
    ngo_funil_cod_integracao        text,
    ngo_funil                       text,
    ngo_id_etapa                    bigint,
    ngo_etapa_cod_integracao        text,
    ngo_etapa                       text,
    ngo_evento                      text,
    ngo_conclusao                   text,
    ngo_motivo_ganho_cod_integracao  text,
    ngo_motivo_ganho                text,
    ngo_obs_motivo_ganho            text,
    ngo_motivo_perda_cod_integracao  text,
    ngo_prioridade                  text,
    ngo_data_previsao               timestamptz,
    ngo_campanha                    text,
    ngo_motivo_perda                text,
    ngo_obs_motivo_perda            text,
    -- Motivo Perda Resumo (MPR)
    mpr_dsc_motivo_perda            text,
    mpr_dsc_motivo_perda_detalhe    text,
    mpr_produto_perda_marca         text,
    mpr_produto_perda_grupo         text,
    mpr_produto_perda_modelo        text,
    mpr_produto_vlr_concorrencia    numeric(18,2),
    mpr_motivo_observacao           text,
    -- Motivo Perda Produto (MPP)
    mpp_dsc_motivo_perda            text,
    mpp_dsc_motivo_perda_detalhe    text,
    mpp_produto_perda_marca         text,
    mpp_produto_perda_grupo         text,
    mpp_produto_perda_modelo        text,
    mpp_produto_vlr_concorrencia    numeric(18,2),
    mpp_motivo_observacao           text,
    -- Orcamento
    orc_valor                       numeric(18,2),
    orc_tipo                        text,
    orc_banco                       text,
    orc_observacao                  text,
    -- Usado/Troca
    usa_maquina                     text,
    usa_valor                       numeric(18,2),
    usa_estado_cod_integracao       text,
    usa_estado_descricao            text,
    -- Cliente
    cli_id_cliente                  bigint,
    cli_codigo_cliente              text,
    cli_loja_cliente_cod_integracao  text,
    cli_cnpj_cpf                    text,
    cli_tipo_cliente                text,
    cli_nome                        text,
    cli_telefone                    text,
    cli_email                       text,
    cli_cidade                      text,
    cli_uf                          text,
    -- Vendedor / Acoes
    ngo_vendedores                  text,
    aco_data_agenda_ultima_acao     timestamptz,
    aco_obs_inicio_ultima_acao      text,
    aco_obs_fim_ultima_acao         text,
    aco_status_ultima_acao          text,
    -- Datas
    ngo_data_primeiro_contato       timestamptz,
    ngo_data_fechamento             timestamptz,
    ngo_data_cadastro               timestamptz,
    ngo_data_atualizacao            timestamptz,
    ngo_ciclo_vendas                integer,
    ngo_qtd_acoes                   integer,
    dth_registro                    timestamptz,
    synced_at                       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_negocios_numero ON mirror.crm_negocios(ngo_numero);
CREATE INDEX idx_negocios_conclusao ON mirror.crm_negocios(ngo_conclusao);
CREATE INDEX idx_negocios_etapa ON mirror.crm_negocios(ngo_etapa);
CREATE INDEX idx_negocios_funil ON mirror.crm_negocios(ngo_funil);
CREATE INDEX idx_negocios_vendedores ON mirror.crm_negocios(ngo_vendedores);
CREATE INDEX idx_negocios_data_cadastro ON mirror.crm_negocios(ngo_data_cadastro);
CREATE INDEX idx_negocios_data_fechamento ON mirror.crm_negocios(ngo_data_fechamento);
CREATE INDEX idx_negocios_cli_nome ON mirror.crm_negocios(cli_nome);
CREATE INDEX idx_negocios_emp_cod_filial ON mirror.crm_negocios(emp_cod_filial);
CREATE INDEX idx_negocios_forma_entrada ON mirror.crm_negocios(ngo_forma_entrada);

ALTER TABLE mirror.crm_negocios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON mirror.crm_negocios FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_write" ON mirror.crm_negocios FOR ALL TO service_role USING (true);

-- =============================================================================
-- 3. crm_pedidos (VW_Ceres_CRM_Pedidos) — 38 columns
-- =============================================================================

DROP TABLE IF EXISTS mirror.crm_pedidos CASCADE;

CREATE TABLE mirror.crm_pedidos (
    id                              bigserial PRIMARY KEY,
    -- Empresa
    emp_id_empresa                  bigint,
    emp_cod_filial                  text,
    emp_nome                        text,
    emp_cnpj                        text,
    emp_cidade                      text,
    emp_uf                          text,
    -- Negocio
    ngo_codigo_integracao           text,
    ngo_numero                      text,
    -- Cliente
    cli_id_cliente                  bigint,
    cli_codigo_cliente              text,
    cli_cnpj_cpf                    text,
    cli_nome                        text,
    cli_telefone                    text,
    cli_telefone2                   text,
    cli_email                       text,
    -- Pedido
    pdo_codigo_interno              text,
    pdo_nro_pedido                  text,
    pdo_situacao_pedido             text,
    pdo_dth_pedido                  timestamptz,
    pdo_vlr_pedido                  numeric(18,2),
    pdo_obs_pedido                  text,
    pdo_endereco_faturamento        text,
    pdo_cidade_uf_faturamento       text,
    pdo_frete                       numeric(18,2),
    pdo_endereco_entrega            text,
    pdo_cidade_uf_entrega           text,
    -- Vendedor
    usr_id_usuario_vendedor         bigint,
    usr_cod_usuario_vendedor        text,
    pdo_vendedor                    text,
    -- Financeiro
    pdo_vlr_recurso_proprio         numeric(18,2),
    pdo_vlr_financiado              numeric(18,2),
    pdo_financiamento_modalidade_nome text,
    pdo_financiamento_banco         text,
    pdo_dth_aprovacao               timestamptz,
    -- Aprovador
    usr_id_usuario_aprovador        bigint,
    usr_cod_usuario_aprovador       text,
    pdo_aprovador                   text,
    -- Datas
    pdo_dth_assinatura_cliente      timestamptz,
    dth_registro                    timestamptz,
    synced_at                       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pedidos_ngo_numero ON mirror.crm_pedidos(ngo_numero);
CREATE INDEX idx_pedidos_codigo_interno ON mirror.crm_pedidos(pdo_codigo_interno);
CREATE INDEX idx_pedidos_situacao ON mirror.crm_pedidos(pdo_situacao_pedido);
CREATE INDEX idx_pedidos_dth_pedido ON mirror.crm_pedidos(pdo_dth_pedido);
CREATE INDEX idx_pedidos_vendedor ON mirror.crm_pedidos(pdo_vendedor);
CREATE INDEX idx_pedidos_cli_nome ON mirror.crm_pedidos(cli_nome);
CREATE INDEX idx_pedidos_emp_cod_filial ON mirror.crm_pedidos(emp_cod_filial);

ALTER TABLE mirror.crm_pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON mirror.crm_pedidos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_write" ON mirror.crm_pedidos FOR ALL TO service_role USING (true);

-- =============================================================================
-- 4. crm_pedidos_item (VW_Ceres_CRM_PedidosItem) — 14 columns
-- =============================================================================

DROP TABLE IF EXISTS mirror.crm_pedidos_item CASCADE;

CREATE TABLE mirror.crm_pedidos_item (
    id                              bigserial PRIMARY KEY,
    pdo_codigo_interno              text,
    pdo_item_id                     text,
    pdo_item_id_grupo               bigint,
    pdo_item_grupo                  text,
    pdo_item_id_marca               bigint,
    pdo_item_marca                  text,
    pdo_item_id_modelo              bigint,
    pdo_item_modelo                 text,
    pdo_item_id_produto             bigint,
    pdo_item_descricao              text,
    pdo_item_obs                    text,
    pdo_item_qtde                   integer,
    pdo_item_vlr_unitario           numeric(18,2),
    dth_registro                    timestamptz,
    synced_at                       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pedidos_item_codigo ON mirror.crm_pedidos_item(pdo_codigo_interno);
CREATE INDEX idx_pedidos_item_id ON mirror.crm_pedidos_item(pdo_item_id);
CREATE INDEX idx_pedidos_item_grupo ON mirror.crm_pedidos_item(pdo_item_grupo);
CREATE INDEX idx_pedidos_item_marca ON mirror.crm_pedidos_item(pdo_item_marca);

ALTER TABLE mirror.crm_pedidos_item ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON mirror.crm_pedidos_item FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_write" ON mirror.crm_pedidos_item FOR ALL TO service_role USING (true);

-- =============================================================================
-- 5. crm_carteira_clientes (VW_Ceres_CRM_CarteiraClientes) — 27 columns
-- =============================================================================

DROP TABLE IF EXISTS mirror.crm_carteira_clientes CASCADE;

CREATE TABLE mirror.crm_carteira_clientes (
    id                        bigserial PRIMARY KEY,
    -- Empresa
    emp_cod_filial            text,
    emp_cnpj                  text,
    emp_nome                  text,
    emp_cidade                text,
    emp_uf                    text,
    -- Usuario (vendedor responsavel)
    usr_id_usuario            bigint,
    usr_nome_usuario          text,
    usr_codigo                text,
    -- Cliente
    cli_nome                  text,
    cli_cnpj_cpf              text,
    cli_codigo_cliente        text,
    cli_id_cliente            bigint NOT NULL UNIQUE,
    cli_segmento              text,
    cli_endereco              text,
    cli_cep                   text,
    cli_telefone              text,
    cli_telefone2             text,
    cli_email                 text,
    cli_cidade                text,
    cli_uf                    text,
    cli_lat                   numeric(10,7),
    cli_lon                   numeric(10,7),
    cli_prospect              text,
    cli_tipo_cliente          text,
    cli_data_cadastro         timestamptz,
    cli_data_atualizacao      timestamptz,
    dth_registro              timestamptz,
    synced_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_carteira_cli_id ON mirror.crm_carteira_clientes(cli_id_cliente);
CREATE INDEX idx_carteira_cli_nome ON mirror.crm_carteira_clientes(cli_nome);
CREATE INDEX idx_carteira_usr_nome ON mirror.crm_carteira_clientes(usr_nome_usuario);
CREATE INDEX idx_carteira_cidade ON mirror.crm_carteira_clientes(cli_cidade);
CREATE INDEX idx_carteira_uf ON mirror.crm_carteira_clientes(cli_uf);
CREATE INDEX idx_carteira_segmento ON mirror.crm_carteira_clientes(cli_segmento);
CREATE INDEX idx_carteira_tipo ON mirror.crm_carteira_clientes(cli_tipo_cliente);
CREATE INDEX idx_carteira_prospect ON mirror.crm_carteira_clientes(cli_prospect);

ALTER TABLE mirror.crm_carteira_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON mirror.crm_carteira_clientes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_write" ON mirror.crm_carteira_clientes FOR ALL TO service_role USING (true);

-- =============================================================================
-- 6. crm_funil_etapa (VW_Ceres_CRM_Negocios_Etapas) — 14 columns
-- =============================================================================

DROP TABLE IF EXISTS mirror.crm_funil_etapa CASCADE;

CREATE TABLE mirror.crm_funil_etapa (
    id                        bigserial PRIMARY KEY,
    -- Empresa
    emp_id_empresa            bigint,
    emp_cod_filial            text,
    emp_nome                  text,
    emp_cnpj                  text,
    emp_cidade                text,
    emp_uf                    text,
    -- Negocio
    ngo_codigo_integracao     text,
    ngo_numero                text,
    -- Funil / Etapa
    funil_dsc                 text,
    etapa_dsc_status_negocio  text,
    fne_dth_inicio_etapa      timestamptz,
    fne_dth_termino_etapa     timestamptz,
    fne_duracao_dias          integer,
    dth_registro              timestamptz,
    synced_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_funil_etapa_ngo ON mirror.crm_funil_etapa(ngo_numero);
CREATE INDEX idx_funil_etapa_funil ON mirror.crm_funil_etapa(funil_dsc);
CREATE INDEX idx_funil_etapa_etapa ON mirror.crm_funil_etapa(etapa_dsc_status_negocio);
CREATE INDEX idx_funil_etapa_inicio ON mirror.crm_funil_etapa(fne_dth_inicio_etapa);

ALTER TABLE mirror.crm_funil_etapa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON mirror.crm_funil_etapa FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_write" ON mirror.crm_funil_etapa FOR ALL TO service_role USING (true);

-- =============================================================================
-- 7. ordens_servico (VW_Ceres_OrdemServico) — 31 columns
-- =============================================================================

DROP TABLE IF EXISTS mirror.ordens_servico CASCADE;

CREATE TABLE mirror.ordens_servico (
    id                            bigserial PRIMARY KEY,
    -- Empresa
    emp_cod_filial                text,
    emp_cnpj                      text,
    emp_nome                      text,
    emp_cidade                    text,
    emp_uf                        text,
    -- OS
    os_id_os                      bigint,
    os_nr_os                      text NOT NULL UNIQUE,
    os_id_cliente                 bigint,
    os_id_equipamento             bigint,
    os_dt_avaria                  timestamptz,
    os_id_situacao_os             bigint,
    os_dth_encerramento           timestamptz,
    sit_cod_situacao_os           text,
    sit_dsc_situacao_os           text,
    os_dsc_problema               text,
    os_dth_abertura               timestamptz,
    os_f_status                   text,
    os_nr_os_geradora             text,
    os_tempo_estimado             text,
    os_id_area_operacao           bigint,
    are_cod_area_operacao         text,
    os_id_tipo_os                 bigint,
    tos_cod_tipo_os               text,
    os_dth_previsao_atendimento   timestamptz,
    os_contato_cliente            text,
    os_contato_telefone           text,
    -- Cliente
    cli_id_empresa                bigint,
    cli_nome                      text,
    cli_codigo_cliente            text,
    cli_cnpj_cpf                  text,
    dth_registro                  timestamptz,
    synced_at                     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_os_nr_os ON mirror.ordens_servico(os_nr_os);
CREATE INDEX idx_os_dth_abertura ON mirror.ordens_servico(os_dth_abertura);
CREATE INDEX idx_os_situacao ON mirror.ordens_servico(sit_dsc_situacao_os);
CREATE INDEX idx_os_status ON mirror.ordens_servico(os_f_status);
CREATE INDEX idx_os_cli_nome ON mirror.ordens_servico(cli_nome);
CREATE INDEX idx_os_emp_cod_filial ON mirror.ordens_servico(emp_cod_filial);
CREATE INDEX idx_os_tipo ON mirror.ordens_servico(tos_cod_tipo_os);

ALTER TABLE mirror.ordens_servico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON mirror.ordens_servico FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_write" ON mirror.ordens_servico FOR ALL TO service_role USING (true);

-- =============================================================================
-- 8. cliente_parque_maquinas (VW_Ceres_CRM_ClienteParqueMaquinas) — 23 columns
-- =============================================================================

DROP TABLE IF EXISTS mirror.cliente_parque_maquinas CASCADE;

CREATE TABLE mirror.cliente_parque_maquinas (
    id                            bigserial PRIMARY KEY,
    -- Cliente
    cli_nome                      text,
    cli_cnpj_cpf                  text,
    cli_codigo_cliente            text,
    cli_id_cliente                bigint,
    cli_prospect                  text,
    cli_segmento                  text,
    -- Parque de Maquinas
    pqm_id                        bigint,
    pqm_codigo_integracao         text,
    pqm_grupo                     text,
    pqm_codigo_produto_grupo      text,
    pqm_marca                     text,
    pqm_codigo_produto_marca      text,
    pqm_modelo                    text,
    pqm_codigo_produto_modelo     text,
    pqm_qtd_maquinas              integer,
    pqm_ano                       text,
    pqm_chassi                    text,
    pqm_serie                     text,
    pqm_horimetro                 text,
    pqm_descricao                 text,
    pqm_observacao                text,
    pqm_dth_registro              timestamptz,
    dth_registro                  timestamptz,
    synced_at                     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_parque_cli_id ON mirror.cliente_parque_maquinas(cli_id_cliente);
CREATE INDEX idx_parque_grupo ON mirror.cliente_parque_maquinas(pqm_grupo);
CREATE INDEX idx_parque_marca ON mirror.cliente_parque_maquinas(pqm_marca);
CREATE INDEX idx_parque_modelo ON mirror.cliente_parque_maquinas(pqm_modelo);
CREATE INDEX idx_parque_cli_nome ON mirror.cliente_parque_maquinas(cli_nome);

ALTER TABLE mirror.cliente_parque_maquinas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON mirror.cliente_parque_maquinas FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_write" ON mirror.cliente_parque_maquinas FOR ALL TO service_role USING (true);

-- =============================================================================
-- 9. usuarios (VW_Ceres_Usuario) — 16 columns
-- =============================================================================

DROP TABLE IF EXISTS mirror.usuarios CASCADE;

CREATE TABLE mirror.usuarios (
    id                        bigserial PRIMARY KEY,
    usr_id_usuario            bigint,
    usr_cpf                   text,
    usr_nome_usuario          text,
    usr_login                 text,
    usr_tipo_usuario          text,
    usr_dsc_tipo_usuario      text,
    usr_id_empresa            bigint,
    usr_email                 text,
    usr_id_licenca            bigint,
    usr_dth_registro          timestamptz,
    usr_cod_usuario           text NOT NULL UNIQUE,
    emp_id_empresa            bigint,
    emp_nome                  text,
    emp_cidade                text,
    emp_cod_filial            text,
    dth_registro              timestamptz,
    synced_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_usuarios_cod ON mirror.usuarios(usr_cod_usuario);
CREATE INDEX idx_usuarios_nome ON mirror.usuarios(usr_nome_usuario);
CREATE INDEX idx_usuarios_tipo ON mirror.usuarios(usr_tipo_usuario);
CREATE INDEX idx_usuarios_emp ON mirror.usuarios(emp_cod_filial);

ALTER TABLE mirror.usuarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_read" ON mirror.usuarios FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "service_write" ON mirror.usuarios FOR ALL TO service_role USING (true);
