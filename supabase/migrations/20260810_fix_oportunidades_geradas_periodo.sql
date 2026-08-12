-------------------------------------------------------------------------------
-- /bi/acoes: oportunidades por coorte do periodo
--
-- A metrica anterior contava negocios antigos que tiveram uma acao na janela e
-- ainda estavam Em Andamento. Para resultado mensal isso mistura estoque com
-- evento e faz, por exemplo, julho/2026 mostrar 112 em vez dos 141 negocios
-- efetivamente criados no mes. Esta RPC preserva os agregados historicos de
-- ranking/dias parados e substitui apenas o bloco `funil` da tela /bi/acoes.
-------------------------------------------------------------------------------

BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_acoes_funil_gestao_periodo(
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
  WITH base AS (
    SELECT public.rpc_acoes_funil_gestao(p_from, p_to, p_vendedor, p_cidade)::jsonb AS dados
  ),
  negocios_base AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_datacadastro,
      n.ngo_conclusao,
      n.ngo_funil,
      n.ngo_vlrtotalnegociado,
      n.ngo_vendedores,
      n.cli_idcliente
    FROM mirror.crm_negocios n
    WHERE n.ngo_numero IS NOT NULL
    ORDER BY n.ngo_numero,
             n.ngo_dataatualizacao DESC NULLS LAST,
             n.dthregistro DESC NULLS LAST
  ),
  negocios_canonicos AS MATERIALIZED (
    SELECT
      b.ngo_numero,
      b.ngo_datacadastro,
      b.ngo_conclusao,
      b.ngo_funil,
      b.ngo_vlrtotalnegociado,
      NULLIF(u.usr_nomeusuario, '') AS consultor_negocio,
      mirror.fn_cli_cidade(b.cli_idcliente) AS cidade_negocio
    FROM negocios_base b
    LEFT JOIN mirror.usuarios u
      ON u.usr_codusuario = NULLIF(b.ngo_vendedores, '')
  ),
  coorte AS MATERIALIZED (
    SELECT *
    FROM negocios_canonicos nc
    WHERE (p_from IS NULL OR nc.ngo_datacadastro::date >= p_from)
      AND (p_to IS NULL OR nc.ngo_datacadastro::date <= p_to)
      AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
      -- Oportunidade pertence ao dono do negocio, mesma atribuicao de ganhos.
      AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
      AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
  ),
  coorte_agg AS (
    SELECT
      COUNT(*)::int AS oportunidades,
      COALESCE(SUM(ngo_vlrtotalnegociado), 0) AS valor_oportunidades,
      COUNT(*) FILTER (WHERE ngo_conclusao = 'Em Andamento')::int AS oportunidades_abertas,
      COALESCE(SUM(ngo_vlrtotalnegociado) FILTER (WHERE ngo_conclusao = 'Em Andamento'), 0)
        AS valor_oportunidades_abertas
    FROM coorte
  )
  SELECT (
    b.dados || jsonb_build_object(
      'funil',
      COALESCE(b.dados->'funil', '{}'::jsonb) || jsonb_build_object(
        'oportunidades', ca.oportunidades,
        'valorOportunidades', ca.valor_oportunidades,
        'oportunidadesAbertas', ca.oportunidades_abertas,
        'valorOportunidadesAbertas', ca.valor_oportunidades_abertas,
        'visitasPorOportunidade', ROUND(
          COALESCE((b.dados->'funil'->>'visitas')::numeric, 0) / NULLIF(ca.oportunidades, 0), 2
        ),
        'oportPorFechamento', ROUND(
          ca.oportunidades::numeric / NULLIF(COALESCE((b.dados->'funil'->>'ganhos')::numeric, 0), 0), 2
        )
      )
    )
  )::json
  FROM base b
  CROSS JOIN coorte_agg ca;
$$;

COMMENT ON FUNCTION public.rpc_acoes_funil_gestao_periodo(date, date, text, text) IS
  'BI Acoes por resultado do periodo: oportunidades sao negocios canonicos cadastrados por ngo_datacadastro no intervalo, sem REPASSE DE MAQUINA. funil.oportunidadesAbertas e apenas o subconjunto atual Em Andamento da mesma coorte. Ganhos (pedido aprovado) e perdidos (fechamento de negocio) sao preservados da rpc_acoes_funil_gestao.';

REVOKE EXECUTE ON FUNCTION public.rpc_acoes_funil_gestao_periodo(date, date, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_acoes_funil_gestao_periodo(date, date, text, text)
  TO authenticated, service_role;

COMMIT;
