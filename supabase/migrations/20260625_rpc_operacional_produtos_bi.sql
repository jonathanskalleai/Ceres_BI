-- Migration: RPCs para BI Operacional e Produtos (server-side aggregation)
-- Autor: @dev
-- Data: 2026-06-25
-- Objetivo: Eliminar fetch de 50K+ rows e agregacao client-side

-------------------------------------------------------------------------------
-- INDICES
-------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_tecnico_tempo_usuario
  ON mirror.tecnico_tempo (usr_nome_usuario);

CREATE INDEX IF NOT EXISTS idx_agenda_servico_status
  ON mirror.agenda_servico (age_f_status);

CREATE INDEX IF NOT EXISTS idx_parque_maquinas_grupo
  ON mirror.cliente_parque_maquinas (pqm_grupo);

CREATE INDEX IF NOT EXISTS idx_parque_maquinas_marca
  ON mirror.cliente_parque_maquinas (pqm_marca);

-------------------------------------------------------------------------------
-- RPC: rpc_operacional_bi
-- Retorna JSON com KPIs, km por tecnico, utilizacao, agenda por status/tipo
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_operacional_bi()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  WITH tecnico_agg AS (
    SELECT
      COALESCE(NULLIF(TRIM(usr_nome_usuario), ''), 'Sem tecnico') AS tecnico,
      -- Disponivel e Ocioso em segundos, converter para minutos
      SUM(COALESCE(tmp_tempo_disponivel, 0)) / 60.0 AS disponivel_min,
      SUM(COALESCE(tmp_duracao_atendimento, 0)) AS atendimento_min,
      SUM(COALESCE(tmp_duracao_deslocamento, 0)) AS deslocamento_min,
      SUM(COALESCE(tmp_tempo_ocioso, 0)) / 60.0 AS ocioso_min,
      SUM(COALESCE(tmp_km_rodado, 0)) AS km_total
    FROM mirror.tecnico_tempo
    GROUP BY 1
  ),
  kpis AS (
    SELECT
      COUNT(*) AS tecnicos_ativos,
      ROUND(SUM(km_total))::int AS km_total,
      CASE WHEN SUM(disponivel_min) > 0
        THEN ROUND(((SUM(atendimento_min) + SUM(deslocamento_min)) / SUM(disponivel_min)) * 100, 1)
        ELSE 0 END AS utilizacao_media,
      CASE WHEN SUM(disponivel_min) > 0
        THEN ROUND((SUM(ocioso_min) / SUM(disponivel_min)) * 100, 1)
        ELSE 0 END AS percent_ocioso
    FROM tecnico_agg
  ),
  km_por_tecnico AS (
    SELECT jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.value DESC)
    FROM (
      SELECT tecnico AS name, ROUND(km_total)::int AS value
      FROM tecnico_agg
      ORDER BY km_total DESC
      LIMIT 12
    ) sub
  ),
  utilizacao_por_tecnico AS (
    SELECT jsonb_agg(row_to_json(sub)::jsonb ORDER BY sub.atendimento DESC)
    FROM (
      SELECT
        tecnico AS name,
        CASE WHEN disponivel_min > 0 THEN ROUND((atendimento_min / disponivel_min) * 100, 1) ELSE 0 END AS atendimento,
        CASE WHEN disponivel_min > 0 THEN ROUND((deslocamento_min / disponivel_min) * 100, 1) ELSE 0 END AS deslocamento,
        CASE WHEN disponivel_min > 0 THEN ROUND((ocioso_min / disponivel_min) * 100, 1) ELSE 0 END AS ocioso
      FROM tecnico_agg
      ORDER BY atendimento_min DESC
    ) sub
  ),
  agenda_status AS (
    SELECT
      COALESCE(NULLIF(TRIM(age_f_status), ''), 'Sem status') AS name,
      COUNT(*) AS value
    FROM mirror.agenda_servico
    GROUP BY 1
    ORDER BY value DESC
    LIMIT 8
  ),
  agenda_tipo AS (
    SELECT
      COALESCE(NULLIF(TRIM(tps_dsc_tipo_servico_atendimento), ''), 'Sem tipo') AS name,
      COUNT(*) AS value
    FROM mirror.agenda_servico
    GROUP BY 1
    ORDER BY value DESC
    LIMIT 8
  ),
  agenda_totals AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(TRIM(age_f_status), '')) ~ '(conclu|finaliz|realizad|fechad|encerr)') AS concluidas
    FROM mirror.agenda_servico
  )
  SELECT json_build_object(
    'kpis', json_build_object(
      'tecnicosAtivos', (SELECT tecnicos_ativos FROM kpis),
      'kmTotal', (SELECT km_total FROM kpis),
      'utilizacaoMedia', (SELECT utilizacao_media FROM kpis),
      'percentOcioso', (SELECT percent_ocioso FROM kpis),
      'eventosAgenda', (SELECT total FROM agenda_totals),
      'taxaConclusaoAgenda', CASE WHEN (SELECT total FROM agenda_totals) > 0
        THEN ROUND(((SELECT concluidas FROM agenda_totals)::numeric / (SELECT total FROM agenda_totals)) * 100, 1)
        ELSE 0 END
    ),
    'kmPorTecnico', COALESCE((SELECT * FROM km_por_tecnico), '[]'::jsonb),
    'utilizacaoPorTecnico', COALESCE((SELECT * FROM utilizacao_por_tecnico), '[]'::jsonb),
    'agendaPorStatus', COALESCE((SELECT jsonb_agg(row_to_json(s)::jsonb) FROM agenda_status s), '[]'::jsonb),
    'agendaPorTipo', COALESCE((SELECT jsonb_agg(row_to_json(t)::jsonb) FROM agenda_tipo t), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

-------------------------------------------------------------------------------
-- RPC: rpc_produtos_bi
-- Retorna JSON com KPIs, top grupos, marcas e modelos
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_produtos_bi()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  WITH base AS (
    SELECT
      cli_idcliente,
      COALESCE(NULLIF(TRIM(pqm_grupo), ''), 'Sem grupo') AS grupo,
      COALESCE(NULLIF(TRIM(pqm_marca), ''), 'Sem marca') AS marca,
      COALESCE(NULLIF(TRIM(pqm_modelo), ''), 'Sem modelo') AS modelo,
      GREATEST(COALESCE(pqm_qtdmaquinas, 0), 1) AS qtd
    FROM mirror.cliente_parque_maquinas
  ),
  kpis AS (
    SELECT
      SUM(qtd)::int AS total_maquinas,
      COUNT(DISTINCT cli_idcliente) AS clientes_com_parque,
      COUNT(DISTINCT grupo) AS grupos_distintos,
      COUNT(DISTINCT marca) AS marcas_distintas
    FROM base
  ),
  por_grupo AS (
    SELECT grupo AS name, SUM(qtd)::int AS value
    FROM base GROUP BY 1 ORDER BY value DESC LIMIT 10
  ),
  por_marca AS (
    SELECT marca AS name, SUM(qtd)::int AS value
    FROM base GROUP BY 1 ORDER BY value DESC LIMIT 10
  ),
  top_modelos AS (
    SELECT modelo AS name, SUM(qtd)::int AS value
    FROM base GROUP BY 1 ORDER BY value DESC LIMIT 10
  )
  SELECT json_build_object(
    'kpis', json_build_object(
      'totalMaquinas', (SELECT total_maquinas FROM kpis),
      'clientesComParque', (SELECT clientes_com_parque FROM kpis),
      'gruposDistintos', (SELECT grupos_distintos FROM kpis),
      'marcasDistintas', (SELECT marcas_distintas FROM kpis)
    ),
    'porGrupo', COALESCE((SELECT jsonb_agg(row_to_json(g)::jsonb) FROM por_grupo g), '[]'::jsonb),
    'porMarca', COALESCE((SELECT jsonb_agg(row_to_json(m)::jsonb) FROM por_marca m), '[]'::jsonb),
    'topModelos', COALESCE((SELECT jsonb_agg(row_to_json(t)::jsonb) FROM top_modelos t), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

-- Permissoes
GRANT EXECUTE ON FUNCTION public.rpc_operacional_bi() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_produtos_bi() TO anon, authenticated, service_role;
