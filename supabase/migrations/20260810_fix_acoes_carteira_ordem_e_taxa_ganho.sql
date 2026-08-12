-------------------------------------------------------------------------------
-- Correcoes de BI Acoes: ordem da carteira e origem da taxa de ganho
--
-- 1) A lista anual de esforco deve priorizar quem recebeu mais visitas. Em
--    empate, quem teve menos oportunidades vem antes. A paginacao continua
--    integralmente no banco.
-- 2) O indicador de ganho deve reproduzir o contrato exibido na tela:
--    ganhos = pedidos Aprovados associados a negocio Ganho; perdidos =
--    negocios Perdido. Nao incluir ganhos de Oficina/ADM sem pedido aprovado.
-------------------------------------------------------------------------------

BEGIN;

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
AS $$
  WITH params AS (
    SELECT
      date_trunc('year', CURRENT_DATE)::date AS ano_inicio,
      CURRENT_DATE AS hoje,
      LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100) AS limite,
      GREATEST(COALESCE(p_offset, 0), 0) AS deslocamento,
      NULLIF(BTRIM(COALESCE(p_search, '')), '') AS busca
  ),
  acoes_filtradas AS (
    SELECT a.cli_idcliente, a.cli_nome, a.aco_tipocontato, a.ngo_nronegocio
    FROM mirror.crm_acoes a
    CROSS JOIN params p
    WHERE a.aco_dthconclusao IS NOT NULL
      AND a.aco_dthconclusao::date BETWEEN p.ano_inicio AND p.hoje
      AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
      AND (p_cidade IS NULL
           OR COALESCE(mirror.fn_cli_cidade(a.cli_idcliente), a.emp_cidade) = p_cidade)
      AND (p.busca IS NULL OR a.cli_nome ILIKE '%' || p.busca || '%')
  ),
  negocios_canonicos AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero) n.ngo_numero, n.ngo_funil
    FROM mirror.crm_negocios n
    WHERE n.ngo_numero IS NOT NULL
    ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST
  ),
  por_cliente AS (
    SELECT
      a.cli_idcliente,
      MIN(a.cli_nome) AS cli_nome,
      COUNT(*) FILTER (WHERE a.aco_tipocontato = 'Visita') AS visitas,
      COUNT(*) AS acoes,
      COUNT(DISTINCT n.ngo_numero) AS oportunidades
    FROM acoes_filtradas a
    LEFT JOIN negocios_canonicos n
      ON n.ngo_numero = a.ngo_nronegocio
     AND a.ngo_nronegocio IS NOT NULL AND a.ngo_nronegocio <> ''
     AND n.ngo_funil = ANY (ARRAY['VENDAS', 'Vendas AP', 'REPASSE DE MAQUINA'])
    WHERE a.cli_idcliente IS NOT NULL AND a.cli_idcliente <> ''
    GROUP BY a.cli_idcliente
  ),
  elegiveis AS (
    SELECT * FROM por_cliente WHERE visitas >= 3
  ),
  paginado AS (
    SELECT
      json_build_object(
        'clienteId', f.cli_idcliente,
        'cliente', f.cli_nome,
        'cidade', mirror.fn_cli_cidade(f.cli_idcliente),
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
  'Gestao da carteira /bi/acoes: clientes com 3+ visitas de 1 de janeiro ate hoje. Paginada no servidor e ordenada por visitas DESC, oportunidades ASC.';

CREATE OR REPLACE FUNCTION public.rpc_acoes_taxa_ganho_negocios(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, mirror
AS $$
  WITH negocios_canonicos AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_funil,
      n.ngo_datafechamento,
      n.ngo_vendedores,
      n.cli_idcliente,
      NULLIF(u.usr_nomeusuario, '') AS consultor_negocio,
      mirror.fn_cli_cidade(n.cli_idcliente) AS cidade_negocio
    FROM mirror.crm_negocios n
    LEFT JOIN mirror.usuarios u ON u.usr_codusuario = NULLIF(n.ngo_vendedores, '')
    WHERE n.ngo_numero IS NOT NULL
    ORDER BY n.ngo_numero, n.ngo_dataatualizacao DESC NULLS LAST, n.dthregistro DESC NULLS LAST
  ),
  pedidos_canonicos AS MATERIALIZED (
    SELECT DISTINCT ON (p.pdo_codigointerno)
      p.pdo_codigointerno,
      p.pdo_situacaopedido,
      p.pdo_dthaprovacao,
      p.ngo_numero
    FROM mirror.crm_pedidos p
    WHERE p.pdo_codigointerno IS NOT NULL
    ORDER BY p.pdo_codigointerno, p.pdo_dthaprovacao DESC NULLS LAST
  ),
  ganhos AS (
    SELECT COUNT(DISTINCT p.pdo_codigointerno) AS quantidade
    FROM pedidos_canonicos p
    JOIN negocios_canonicos n ON n.ngo_numero = p.ngo_numero
    WHERE p.pdo_situacaopedido = 'Aprovado'
      AND n.ngo_conclusao = 'Ganho'
      AND n.ngo_funil <> 'REPASSE DE MAQUINA'
      AND p.pdo_dthaprovacao IS NOT NULL
      AND (p_from IS NULL OR p.pdo_dthaprovacao::date >= p_from)
      AND (p_to IS NULL OR p.pdo_dthaprovacao::date <= p_to)
      AND (p_vendedor IS NULL OR n.consultor_negocio = p_vendedor)
      AND (p_cidade IS NULL OR n.cidade_negocio = p_cidade)
  ),
  perdidos AS (
    SELECT COUNT(*) AS quantidade
    FROM negocios_canonicos n
    WHERE n.ngo_conclusao = 'Perdido'
      AND n.ngo_funil <> 'REPASSE DE MAQUINA'
      AND n.ngo_datafechamento IS NOT NULL
      AND (p_from IS NULL OR n.ngo_datafechamento::date >= p_from)
      AND (p_to IS NULL OR n.ngo_datafechamento::date <= p_to)
      AND (p_vendedor IS NULL OR n.consultor_negocio = p_vendedor)
      AND (p_cidade IS NULL OR n.cidade_negocio = p_cidade)
  )
  SELECT json_build_object(
    'ganhos', g.quantidade,
    'perdidos', p.quantidade,
    'taxaGanho', CASE
      WHEN g.quantidade + p.quantidade = 0 THEN NULL
      ELSE ROUND(g.quantidade::numeric * 100 / (g.quantidade + p.quantidade), 1)
    END
  )
  FROM ganhos g CROSS JOIN perdidos p;
$$;

COMMENT ON FUNCTION public.rpc_acoes_taxa_ganho_negocios(date, date, text, text) IS
  'BI Acoes: pedidos Aprovados ligados a negocios Ganho / (pedidos ganhos + negocios Perdido), sem Repasse de Maquina. Ganhos por data de aprovacao; perdas por data de fechamento.';

REVOKE EXECUTE ON FUNCTION public.rpc_acoes_desperdicio_ano_corrente(text, text, int, int, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_desperdicio_ano_corrente(text, text, int, int, text)
  TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.rpc_acoes_taxa_ganho_negocios(date, date, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_taxa_ganho_negocios(date, date, text, text)
  TO authenticated, service_role;

COMMIT;
