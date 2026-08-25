-- Complementa a tabela mensal da Equipe com o mesmo contrato já validado em
-- CRM > Ações e nos cards anteriores de Consultores:
--
--   negócios             = oportunidades geradas (primeira entrada em VENDAS)
--   oportunidades_abertas = parte dessa coorte que permanece Em Andamento
--   quantidade_vendas     = pedidos Aprovados de negócios Ganhos
--   taxa_conversao_negocios = quantidade_vendas / negócios gerados
--
-- A RPC anterior permanece disponível para compatibilidade. A nova versão
-- reaproveita seus agregados financeiros e substitui apenas os indicadores de
-- quantidade/conversão que tinham semântica ambígua.

CREATE OR REPLACE FUNCTION public.rpc_equipe_desempenho_mensal_v2(
  p_ano integer,
  p_consultor text DEFAULT NULL,
  p_cidade text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, mirror
SET statement_timeout = '20s'
SET enable_nestloop = off
AS $$
  WITH
  base AS MATERIALIZED (
    SELECT public.rpc_equipe_desempenho_mensal(
      p_ano,
      p_consultor,
      p_cidade
    ) AS dados
  ),
  limites AS (
    SELECT make_date(p_ano, 1, 1) AS inicio,
           make_date(p_ano + 1, 1, 1) AS fim
  ),
  -- crm_negocios tem uma linha por produto. A primeira versão de cada negócio
  -- nunca deve entrar no cálculo; o dono e o status vêm sempre da versão mais
  -- atual, exatamente como em rpc_consultores_resumo_acoes.
  negocios_base AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_funil,
      n.ngo_vendedores,
      n.cli_idcliente
    FROM mirror.crm_negocios n
    WHERE n.ngo_numero IS NOT NULL
      AND n.ngo_numero <> ''
    ORDER BY n.ngo_numero,
      n.ngo_dataatualizacao DESC NULLS LAST,
      n.dthregistro DESC NULLS LAST
  ),
  negocios_com_consultor AS MATERIALIZED (
    SELECT
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_funil,
      NULLIF(BTRIM(u.usr_nomeusuario), '') AS consultor,
      mirror.fn_cli_cidade(n.cli_idcliente) AS cidade
    FROM negocios_base n
    LEFT JOIN mirror.usuarios u
      ON u.usr_codusuario = NULLIF(BTRIM(n.ngo_vendedores), '')
  ),
  -- "Oportunidade gerada" é a primeira entrada histórica no funil VENDAS;
  -- não é a quantidade de ações, nem o estágio atual do negócio.
  primeira_entrada_vendas AS MATERIALIZED (
    SELECT
      f.ngo_numero,
      MIN(f.fne_dthinicioetapa::date) AS data_entrada_vendas
    FROM mirror.crm_funil_etapa f
    WHERE UPPER(BTRIM(COALESCE(f.funil_dsc, ''))) = 'VENDAS'
      AND f.fne_dthinicioetapa IS NOT NULL
    GROUP BY f.ngo_numero
  ),
  oportunidades_base AS MATERIALIZED (
    SELECT
      date_trunc('month', e.data_entrada_vendas)::date AS competencia,
      n.consultor,
      n.ngo_conclusao
    FROM primeira_entrada_vendas e
    JOIN negocios_com_consultor n ON n.ngo_numero = e.ngo_numero
    JOIN limites l ON true
    WHERE e.data_entrada_vendas >= l.inicio
      AND e.data_entrada_vendas < l.fim
      AND n.ngo_funil <> 'REPASSE DE MAQUINA'
      AND (p_consultor IS NULL OR n.consultor = p_consultor)
      AND (p_cidade IS NULL OR n.cidade = p_cidade)
  ),
  oportunidades_por_consultor AS MATERIALIZED (
    SELECT
      competencia,
      consultor,
      COUNT(*)::bigint AS negocios,
      COUNT(*) FILTER (WHERE ngo_conclusao = 'Em Andamento')::bigint
        AS oportunidades_abertas
    FROM oportunidades_base
    WHERE consultor IS NOT NULL
      AND consultor <> ''
    GROUP BY competencia, consultor
  ),
  oportunidades_equipe AS MATERIALIZED (
    SELECT
      competencia,
      COUNT(*)::bigint AS negocios,
      COUNT(*) FILTER (WHERE ngo_conclusao = 'Em Andamento')::bigint
        AS oportunidades_abertas
    FROM oportunidades_base
    GROUP BY competencia
  ),
  linhas_base AS MATERIALIZED (
    SELECT
      item AS dados,
      (item ->> 'competencia')::date AS competencia,
      item ->> 'consultor' AS consultor,
      COALESCE((item ->> 'negocios')::bigint, 0) AS quantidade_vendas
    FROM base b
    CROSS JOIN LATERAL jsonb_array_elements(b.dados -> 'rows') AS item
  ),
  linhas AS MATERIALIZED (
    SELECT
      lb.competencia,
      lb.consultor,
      lb.dados || jsonb_build_object(
        'negocios', COALESCE(o.negocios, 0),
        'oportunidades_abertas', COALESCE(o.oportunidades_abertas, 0),
        'quantidade_vendas', lb.quantidade_vendas,
        'taxa_conversao_negocios', CASE
          WHEN COALESCE(o.negocios, 0) = 0 THEN NULL
          ELSE ROUND(lb.quantidade_vendas::numeric * 100 / o.negocios, 1)
        END
      ) AS dados
    FROM linhas_base lb
    LEFT JOIN oportunidades_por_consultor o
      ON o.competencia = lb.competencia
      AND o.consultor = lb.consultor
  ),
  equipe_base AS MATERIALIZED (
    SELECT
      item AS dados,
      (item ->> 'competencia')::date AS competencia,
      COALESCE((item ->> 'negocios')::bigint, 0) AS quantidade_vendas
    FROM base b
    CROSS JOIN LATERAL jsonb_array_elements(b.dados -> 'team') AS item
  ),
  equipe AS MATERIALIZED (
    SELECT
      eb.competencia,
      eb.dados || jsonb_build_object(
        'negocios', COALESCE(o.negocios, 0),
        'oportunidades_abertas', COALESCE(o.oportunidades_abertas, 0),
        'quantidade_vendas', eb.quantidade_vendas,
        'taxa_conversao_negocios', CASE
          WHEN COALESCE(o.negocios, 0) = 0 THEN NULL
          ELSE ROUND(eb.quantidade_vendas::numeric * 100 / o.negocios, 1)
        END
      ) AS dados
    FROM equipe_base eb
    LEFT JOIN oportunidades_equipe o ON o.competencia = eb.competencia
  )
  SELECT jsonb_build_object(
    'rows', COALESCE((
      SELECT jsonb_agg(l.dados ORDER BY l.consultor, l.competencia)
      FROM linhas l
    ), '[]'::jsonb),
    'team', COALESCE((
      SELECT jsonb_agg(e.dados ORDER BY e.competencia)
      FROM equipe e
    ), '[]'::jsonb)
  );
$$;

COMMENT ON FUNCTION public.rpc_equipe_desempenho_mensal_v2(integer, text, text) IS
  'Tabela mensal da Equipe alinhada a CRM > Acoes. Negocios = oportunidades geradas pela primeira entrada no funil VENDAS; quantidade_vendas = pedidos Aprovados de negocios Ganhos; conversao = quantidade_vendas / negocios gerados; oportunidades_abertas = coorte do mes ainda Em Andamento.';

REVOKE EXECUTE ON FUNCTION public.rpc_equipe_desempenho_mensal_v2(integer, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_equipe_desempenho_mensal_v2(integer, text, text)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
