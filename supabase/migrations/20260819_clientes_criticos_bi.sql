-- Indicador aditivo de clientes críticos para /bi/acoes.
--
-- A função não altera rpc_acoes_clientes_risco: aquela ainda mede as faixas
-- do ano corrente e sustenta o drill-down existente. Esta responde a outra
-- pergunta: há quanto tempo existe uma ação registrada para o cliente?

CREATE OR REPLACE FUNCTION public.rpc_clientes_criticos_bi(
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_dias_min integer DEFAULT 365,
  p_limit integer DEFAULT 5
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, mirror
AS $$
DECLARE
  v_dias_min integer := GREATEST(COALESCE(p_dias_min, 365), 1);
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 5), 1), 25);
  result json;
BEGIN
  WITH carteira AS (
    SELECT DISTINCT ON (c.cli_idcliente)
      c.cli_idcliente,
      c.cli_nome,
      c.cli_cidade,
      c.usr_nomeusuario,
      c.cli_datacadastro::date AS data_cadastro
    FROM mirror.crm_carteira_clientes c
    WHERE c.cli_idcliente IS NOT NULL
      AND (p_vendedor IS NULL OR c.usr_nomeusuario = p_vendedor)
      AND (p_cidade IS NULL OR c.cli_cidade = p_cidade)
    ORDER BY c.cli_idcliente,
      c.cli_dataatualizacao DESC NULLS LAST,
      c.usr_idusuario NULLS LAST
  ),
  ultima_acao AS (
    SELECT a.cli_idcliente, MAX(a.aco_dthconclusao::date) AS ultima_acao
    FROM mirror.crm_acoes a
    WHERE a.cli_idcliente IS NOT NULL AND a.aco_dthconclusao IS NOT NULL
    GROUP BY a.cli_idcliente
  ),
  negocios_canonicos AS (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.cli_idcliente,
      n.ngo_conclusao,
      n.ngo_funil,
      n.ngo_vlrtotalnegociado
    FROM mirror.crm_negocios n
    WHERE n.ngo_numero IS NOT NULL
    ORDER BY n.ngo_numero,
      n.ngo_dataatualizacao DESC NULLS LAST,
      n.dthregistro DESC NULLS LAST
  ),
  valor_aberto AS (
    SELECT n.cli_idcliente, COALESCE(SUM(n.ngo_vlrtotalnegociado), 0)::numeric AS valor_em_risco
    FROM negocios_canonicos n
    WHERE n.ngo_conclusao = 'Em Andamento' AND n.ngo_funil <> 'REPASSE DE MAQUINA'
    GROUP BY n.cli_idcliente
  ),
  enriquecida AS (
    SELECT
      c.cli_idcliente,
      c.cli_nome,
      c.cli_cidade,
      c.usr_nomeusuario AS consultor,
      u.ultima_acao,
      CASE
        WHEN u.ultima_acao IS NOT NULL THEN current_date - u.ultima_acao
        WHEN c.data_cadastro IS NOT NULL THEN current_date - c.data_cadastro
        ELSE NULL
      END AS dias_sem_acao,
      u.ultima_acao IS NULL AS sem_acao_registrada,
      COALESCE(v.valor_em_risco, 0)::numeric AS valor_em_risco
    FROM carteira c
    LEFT JOIN ultima_acao u ON u.cli_idcliente = c.cli_idcliente
    LEFT JOIN valor_aberto v ON v.cli_idcliente = c.cli_idcliente
  ),
  criticos AS (
    SELECT * FROM enriquecida WHERE dias_sem_acao > v_dias_min
  ),
  resumo AS (
    SELECT
      COUNT(*)::integer AS total_criticos,
      COUNT(*) FILTER (WHERE sem_acao_registrada)::integer AS sem_acao_registrada,
      COALESCE(SUM(valor_em_risco), 0)::numeric AS valor_em_risco
    FROM criticos
  ),
  lista AS (
    SELECT COALESCE(json_agg(row_to_json(item) ORDER BY item."valorEmRisco" DESC, item."diasSemAcao" DESC), '[]'::json) AS rows
    FROM (
      SELECT
        cli_idcliente AS "clienteId",
        cli_nome AS cliente,
        cli_cidade AS cidade,
        consultor,
        ultima_acao AS "ultimaAcao",
        dias_sem_acao::integer AS "diasSemAcao",
        sem_acao_registrada AS "semAcaoRegistrada",
        valor_em_risco AS "valorEmRisco"
      FROM criticos
      ORDER BY valor_em_risco DESC, dias_sem_acao DESC
      LIMIT v_limit
    ) item
  )
  SELECT json_build_object(
    'totalCriticos', resumo.total_criticos,
    'semAcaoRegistrada', resumo.sem_acao_registrada,
    'valorEmRisco', resumo.valor_em_risco,
    'rows', lista.rows
  )
  INTO result
  FROM resumo CROSS JOIN lista;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.rpc_clientes_criticos_bi(text, text, integer, integer) IS
  'Clientes cuja última ação registrada, ou cadastro sem ação, supera p_dias_min. Retorna valor de negócios canônicos Em Andamento, sem REPASSE DE MAQUINA.';

REVOKE ALL ON FUNCTION public.rpc_clientes_criticos_bi(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_clientes_criticos_bi(text, text, integer, integer) TO authenticated, service_role;
