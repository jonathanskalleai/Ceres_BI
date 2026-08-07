-- Migration: Create 4 operational mirror tables for field-service views
-- Author: @data-engineer (Dara)
-- Date: 2026-06-24
-- Description: Creates mirror tables for VW_Ceres_TecnicoTempo,
--              VW_Ceres_Agenda, VW_Ceres_AtendimentoOS, VW_Ceres_Ocorrencias.
--              All use CREATE TABLE IF NOT EXISTS for idempotency.
--              Includes indexes, RLS policies, and sync_metadata seed.

-- =============================================================================
-- 1. mirror.tecnico_tempo (VW_Ceres_TecnicoTempo) — 18 columns
--    PK: composite (usr_id_usuario, tmp_dia)
-- =============================================================================

CREATE TABLE IF NOT EXISTS mirror.tecnico_tempo (
    emp_cod_filial              text,
    emp_cnpj                    text,
    emp_nome                    text,
    emp_cidade                  text,
    emp_uf                      text,
    usr_id_usuario              integer NOT NULL,
    usr_cod_usuario             text,
    usr_nome_usuario            text,
    tmp_dia                     timestamptz NOT NULL,
    tmp_dia_semana              text,
    tmp_tempo_disponivel        integer DEFAULT 0,
    tmp_duracao_atendimento     integer DEFAULT 0,
    tmp_duracao_deslocamento    integer DEFAULT 0,
    tmp_km_rodado               integer DEFAULT 0,
    tmp_tempo_ocioso            integer DEFAULT 0,
    tmp_tempo_extra             integer DEFAULT 0,
    tmp_dth_processamento       timestamptz,
    dth_registro                timestamptz,
    synced_at                   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (usr_id_usuario, tmp_dia)
);

-- Unique constraint for upsert conflict target
ALTER TABLE mirror.tecnico_tempo
    DROP CONSTRAINT IF EXISTS uq_tecnico_tempo_usuario_dia;
ALTER TABLE mirror.tecnico_tempo
    ADD CONSTRAINT uq_tecnico_tempo_usuario_dia UNIQUE (usr_id_usuario, tmp_dia);

CREATE INDEX IF NOT EXISTS idx_tecnico_tempo_dth_registro
    ON mirror.tecnico_tempo(dth_registro);
CREATE INDEX IF NOT EXISTS idx_tecnico_tempo_filial
    ON mirror.tecnico_tempo(emp_cod_filial);
CREATE INDEX IF NOT EXISTS idx_tecnico_tempo_usuario
    ON mirror.tecnico_tempo(usr_nome_usuario);
CREATE INDEX IF NOT EXISTS idx_tecnico_tempo_dia
    ON mirror.tecnico_tempo(tmp_dia);

ALTER TABLE mirror.tecnico_tempo ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "anon_read" ON mirror.tecnico_tempo
        FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE POLICY "service_write" ON mirror.tecnico_tempo
        FOR ALL TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 2. mirror.agenda_servico (VW_Ceres_Agenda) — 22 columns
--    PK: age_id_agenda
-- =============================================================================

CREATE TABLE IF NOT EXISTS mirror.agenda_servico (
    emp_cod_filial                      text,
    emp_id_empresa                      integer,
    os_id_os                            integer,
    os_nr_os                            text,
    os_f_status                         text,
    os_id_cliente                       integer,
    cli_codigo_cliente                  text,
    cli_nome                            text,
    cli_cnpj_cpf                        text,
    atd_id_atendimento                  integer,
    usr_id_usuario                      integer,
    usr_cod_usuario                     text,
    usr_nome_usuario                    text,
    age_id_agenda                       integer NOT NULL PRIMARY KEY,
    age_f_status                        text,
    age_dth_previsao_inicio             timestamptz,
    age_dth_previsao_fim                timestamptz,
    tps_cod_servico_deslocamento        text,
    tps_dsc_tipo_servico_deslocamento   text,
    tps_cod_servico_atendimento         text,
    tps_dsc_tipo_servico_atendimento    text,
    dth_registro                        timestamptz,
    synced_at                           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agenda_dth_registro
    ON mirror.agenda_servico(dth_registro);
CREATE INDEX IF NOT EXISTS idx_agenda_filial
    ON mirror.agenda_servico(emp_cod_filial);
CREATE INDEX IF NOT EXISTS idx_agenda_usuario
    ON mirror.agenda_servico(usr_nome_usuario);
CREATE INDEX IF NOT EXISTS idx_agenda_status
    ON mirror.agenda_servico(age_f_status);
CREATE INDEX IF NOT EXISTS idx_agenda_previsao_inicio
    ON mirror.agenda_servico(age_dth_previsao_inicio);
CREATE INDEX IF NOT EXISTS idx_agenda_os
    ON mirror.agenda_servico(os_id_os);

ALTER TABLE mirror.agenda_servico ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "anon_read" ON mirror.agenda_servico
        FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE POLICY "service_write" ON mirror.agenda_servico
        FOR ALL TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 3. mirror.atendimentos_os (VW_Ceres_AtendimentoOS) — 30 columns
--    PK: atd_id_atendimento
-- =============================================================================

CREATE TABLE IF NOT EXISTS mirror.atendimentos_os (
    emp_cod_filial              text,
    emp_cnpj                    text,
    emp_nome                    text,
    emp_cidade                  text,
    emp_uf                      text,
    os_id_os                    integer,
    os_nr_os                    text,
    os_f_status                 integer,
    os_id_cliente               integer,
    cli_codigo_cliente          text,
    cli_nome                    text,
    cli_cnpj_cpf                text,
    atd_id_atendimento          integer NOT NULL PRIMARY KEY,
    usr_cod_usuario             text,
    usr_nome_usuario            text,
    atd_dsc_causa               text,
    atd_part_number_causadora   text,
    atd_dsc_solucao             text,
    atd_contado_cliente         text,
    atd_contato_telefone        text,
    atd_dth_registro            timestamptz,
    atd_f_status                integer,
    atd_ano                     integer,
    atd_mes                     integer,
    atd_horimetro               numeric,
    atd_dsc_opcional            text,
    atd_duracao_atendimento     numeric,
    atd_dth_primeiro_ocorrencia timestamptz,
    atd_dth_ultima_ocorrencia   timestamptz,
    dth_registro                timestamptz,
    synced_at                   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_atendimentos_dth_registro
    ON mirror.atendimentos_os(dth_registro);
CREATE INDEX IF NOT EXISTS idx_atendimentos_filial
    ON mirror.atendimentos_os(emp_cod_filial);
CREATE INDEX IF NOT EXISTS idx_atendimentos_os_id
    ON mirror.atendimentos_os(os_id_os);
CREATE INDEX IF NOT EXISTS idx_atendimentos_usuario
    ON mirror.atendimentos_os(usr_nome_usuario);
CREATE INDEX IF NOT EXISTS idx_atendimentos_status
    ON mirror.atendimentos_os(atd_f_status);
CREATE INDEX IF NOT EXISTS idx_atendimentos_ano_mes
    ON mirror.atendimentos_os(atd_ano, atd_mes);

ALTER TABLE mirror.atendimentos_os ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "anon_read" ON mirror.atendimentos_os
        FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE POLICY "service_write" ON mirror.atendimentos_os
        FOR ALL TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 4. mirror.ocorrencias_os (VW_Ceres_Ocorrencias) — 22 columns
--    PK: ose_id_os_ocr
-- =============================================================================

CREATE TABLE IF NOT EXISTS mirror.ocorrencias_os (
    ose_id_os_ocr                   integer NOT NULL PRIMARY KEY,
    ose_id_os                       integer,
    os_nr_os                        text,
    ose_id_ocorrencia               integer,
    ose_dsc_ocorrencia              text,
    ose_id_usuario                  integer,
    ose_dth_ocorrencia              timestamptz,
    ose_observacao                  text,
    ose_latitude                    numeric,
    ose_longitude                   numeric,
    os_km                           integer,
    ose_id_agenda                   integer,
    ose_id_situacao_ocorrencia      integer,
    ose_dsc_situacao_ocorrencia     text,
    ose_id_tipo_origem              integer,
    ose_dth_original                timestamptz,
    ose_id_motivo_pausa             integer,
    ose_dsc_motivo_pausa            text,
    usr_nome_usuario                text,
    usr_cod_usuario                 text,
    emp_cod_filial                  text,
    dth_registro                    timestamptz,
    synced_at                       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ocorrencias_dth_registro
    ON mirror.ocorrencias_os(dth_registro);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_os_id
    ON mirror.ocorrencias_os(ose_id_os);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_agenda
    ON mirror.ocorrencias_os(ose_id_agenda);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_usuario
    ON mirror.ocorrencias_os(usr_nome_usuario);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_filial
    ON mirror.ocorrencias_os(emp_cod_filial);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_dth_ocorrencia
    ON mirror.ocorrencias_os(ose_dth_ocorrencia);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_situacao
    ON mirror.ocorrencias_os(ose_id_situacao_ocorrencia);

ALTER TABLE mirror.ocorrencias_os ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "anon_read" ON mirror.ocorrencias_os
        FOR SELECT TO anon, authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
    CREATE POLICY "service_write" ON mirror.ocorrencias_os
        FOR ALL TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 5. GRANTS (para as novas tabelas)
-- =============================================================================

GRANT SELECT ON mirror.tecnico_tempo TO anon, authenticated;
GRANT ALL ON mirror.tecnico_tempo TO service_role;

GRANT SELECT ON mirror.agenda_servico TO anon, authenticated;
GRANT ALL ON mirror.agenda_servico TO service_role;

GRANT SELECT ON mirror.atendimentos_os TO anon, authenticated;
GRANT ALL ON mirror.atendimentos_os TO service_role;

GRANT SELECT ON mirror.ocorrencias_os TO anon, authenticated;
GRANT ALL ON mirror.ocorrencias_os TO service_role;

-- =============================================================================
-- 6. SYNC METADATA (registros para o ETL)
-- =============================================================================

INSERT INTO mirror.sync_metadata (view_name, strategy)
VALUES
    ('VW_Ceres_TecnicoTempo',    'incremental'),
    ('VW_Ceres_Agenda',          'incremental'),
    ('VW_Ceres_AtendimentoOS',   'incremental'),
    ('VW_Ceres_Ocorrencias',     'incremental')
ON CONFLICT (view_name) DO NOTHING;

-- =============================================================================
-- 7. RELOAD SCHEMA CACHE (PostgREST)
-- =============================================================================

NOTIFY pgrst, 'reload schema';
