-------------------------------------------------------------------------------
-- Gestao da Carteira: paginacao anual de "Muitas visitas, poucas oportunidades"
--
-- O LIMIT ja era aplicado no banco, mas a versao anterior chamava
-- mirror.fn_cli_cidade para milhares de acoes e convertia a data para `date`.
-- Isso custava ~6,5 s mesmo para devolver 10 linhas e impedia o uso direto do
-- indice idx_crm_acoes_dthconclusao. Cidade agora e resolvida uma vez por
-- cliente e a janela usa comparacao timestamp sargable.
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_acoes_desperdicio_ano_corrente(
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_search text DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, mirror
SET enable_nestloop = off
AS $$
  WITH params AS (
    SELECT
      date_trunc('year', CURRENT_DATE)::date AS ano_inicio,
      CURRENT_DATE AS hoje,
      LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100) AS limite,
      GREATEST(COALESCE(p_offset, 0), 0) AS deslocamento,
      NULLIF(BTRIM(COALESCE(p_search, '')), '') AS busca,
      p_vendedor AS vendedor,
      p_cidade AS cidade
  ),
  -- Espelho da regra de fn_cli_cidade, porem calculado uma unica vez para cada
  -- cliente em vez de uma chamada SQL para cada acao da janela.
  cidades_clientes AS MATERIALIZED (
    SELECT DISTINCT ON (c.cli_idcliente)
      c.cli_idcliente,
      c.cli_cidade
    FROM mirror.crm_carteira_clientes c
    WHERE c.cli_idcliente IS NOT NULL
      AND c.cli_idcliente <> ''
      AND c.cli_cidade IS NOT NULL
      AND c.cli_cidade <> ''
    ORDER BY c.cli_idcliente, c.usr_idusuario
  ),
  acoes_filtradas AS (
    SELECT
      a.cli_idcliente,
      a.cli_nome,
      a.aco_tipocontato,
      a.ngo_nronegocio,
      cc.cli_cidade
    FROM mirror.crm_acoes a
    CROSS JOIN params p
    LEFT JOIN cidades_clientes cc ON cc.cli_idcliente = a.cli_idcliente
    WHERE a.aco_dthconclusao >= p.ano_inicio
      AND a.aco_dthconclusao < p.hoje + 1
      AND (p.vendedor IS NULL OR a.aco_vendedor = p.vendedor)
      AND (p.cidade IS NULL OR COALESCE(cc.cli_cidade, a.emp_cidade) = p.cidade)
      AND (p.busca IS NULL OR a.cli_nome ILIKE '%' || p.busca || '%')
  ),
  negocios_canonicos AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_funil
    FROM mirror.crm_negocios n
    WHERE n.ngo_numero IS NOT NULL
    ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST
  ),
  por_cliente AS (
    SELECT
      a.cli_idcliente,
      MIN(a.cli_nome) AS cli_nome,
      MIN(a.cli_cidade) AS cli_cidade,
      COUNT(*) FILTER (WHERE a.aco_tipocontato = 'Visita') AS visitas,
      COUNT(*) AS acoes,
      COUNT(DISTINCT n.ngo_numero) AS oportunidades
    FROM acoes_filtradas a
    LEFT JOIN negocios_canonicos n
      ON n.ngo_numero = a.ngo_nronegocio
     AND a.ngo_nronegocio IS NOT NULL
     AND a.ngo_nronegocio <> ''
     AND n.ngo_funil = ANY (ARRAY['VENDAS', 'Vendas AP', 'REPASSE DE MAQUINA'])
    WHERE a.cli_idcliente IS NOT NULL
      AND a.cli_idcliente <> ''
    GROUP BY a.cli_idcliente
  ),
  elegiveis AS (
    SELECT *
    FROM por_cliente
    WHERE visitas >= 3
  ),
  paginado AS (
    SELECT
      json_build_object(
        'clienteId', f.cli_idcliente,
        'cliente', f.cli_nome,
        'cidade', f.cli_cidade,
        'visitas', f.visitas,
        'acoes', f.acoes,
        'oportunidades', f.oportunidades,
        'visitasPorOportunidade', ROUND(f.visitas::numeric / NULLIF(f.oportunidades, 0), 2)
      ) AS row_json,
      f.visitas,
      f.oportunidades,
      f.cli_nome,
      f.cli_idcliente
    FROM elegiveis f
    CROSS JOIN params p
    ORDER BY f.visitas DESC, f.oportunidades ASC, f.cli_nome ASC, f.cli_idcliente ASC
    LIMIT (SELECT limite FROM params)
    OFFSET (SELECT deslocamento FROM params)
  )
  SELECT json_build_object(
    'rows', COALESCE((
      SELECT json_agg(
        p.row_json
        ORDER BY p.visitas DESC, p.oportunidades ASC, p.cli_nome ASC, p.cli_idcliente ASC
      )
      FROM paginado p
    ), '[]'::json),
    'total', (SELECT COUNT(*) FROM elegiveis),
    'meta', json_build_object(
      'tipo', 'desperdicio',
      'minVisitas', 3,
      'semNenhumaOportunidade', (SELECT COUNT(*) FROM elegiveis WHERE oportunidades = 0),
      'ordem', 'visitas DESC, oportunidades ASC'
    )
  );
$$;

COMMENT ON FUNCTION public.rpc_acoes_desperdicio_ano_corrente(text, text, int, int, text) IS
  'Gestao da carteira /bi/acoes: clientes com 3+ visitas no ano corrente, paginada no servidor. Otimizada: usa idx_crm_acoes_dthconclusao por intervalo timestamp e resolve cidade em lote.';

REVOKE EXECUTE ON FUNCTION public.rpc_acoes_desperdicio_ano_corrente(text, text, int, int, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_desperdicio_ano_corrente(text, text, int, int, text)
  TO authenticated, service_role;
