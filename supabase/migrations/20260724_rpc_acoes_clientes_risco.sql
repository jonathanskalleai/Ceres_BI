-------------------------------------------------------------------------------
-- rpc_acoes_clientes_risco — distribuicao de clientes da carteira por faixa
-- de dias desde a ultima acao comercial no ano corrente.
--
-- Faixas: 0-15, 16-30, 31-60, 61-90, +90 dias.
-- Clientes SEM nenhuma acao no ano entram na faixa +90 (dias = 999).
--
-- Performance validada em banco vivo (2026-07-24): 125ms sem indice para
-- 8.731 clientes x 5.567 acoes/ano. Aceitavel para dashboard (< 200ms).
--
-- Distribuicao real medida:
--   0-15=343, 16-30=264, 31-60=312, 61-90=278, +90=7534 (total carteira)
--   Per vendedor (MAYCON): 0-15=58, 16-30=48, 31-60=49, 61-90=15, +90=164
--
-- Match confirmado: aco_vendedor = usr_nomeusuario na carteira (direto).
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_acoes_clientes_risco(
  p_vendedor text DEFAULT NULL,
  p_cidade text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  WITH ultima_acao AS (
    -- Ultima acao por cliente no ANO CORRENTE (apenas acoes com data de conclusao)
    SELECT
      a.cli_idcliente,
      MAX(a.aco_dthconclusao::date) AS ultima_data
    FROM mirror.crm_acoes a
    WHERE a.aco_dthconclusao IS NOT NULL
      AND EXTRACT(YEAR FROM a.aco_dthconclusao) = EXTRACT(YEAR FROM CURRENT_DATE)
    GROUP BY a.cli_idcliente
  ),
  carteira_base AS (
    -- Clientes distintos na carteira, filtrados por vendedor e/ou cidade
    SELECT DISTINCT c.cli_idcliente
    FROM mirror.crm_carteira_clientes c
    WHERE (p_vendedor IS NULL OR c.usr_nomeusuario = p_vendedor)
      AND (p_cidade IS NULL OR c.cli_cidade = p_cidade)
  ),
  dias_calc AS (
    -- Dias desde ultima acao; 999 para quem nao tem acao no ano
    SELECT
      cb.cli_idcliente,
      COALESCE(CURRENT_DATE - ua.ultima_data, 999) AS dias
    FROM carteira_base cb
    LEFT JOIN ultima_acao ua ON ua.cli_idcliente = cb.cli_idcliente
  ),
  contagens AS (
    SELECT
      COUNT(*) AS total_carteira,
      COUNT(*) FILTER (WHERE dias <= 365) AS com_acao,
      COUNT(*) FILTER (WHERE dias = 999) AS sem_acao,
      COUNT(*) FILTER (WHERE dias BETWEEN 0 AND 15) AS f_0_15,
      COUNT(*) FILTER (WHERE dias BETWEEN 16 AND 30) AS f_16_30,
      COUNT(*) FILTER (WHERE dias BETWEEN 31 AND 60) AS f_31_60,
      COUNT(*) FILTER (WHERE dias BETWEEN 61 AND 90) AS f_61_90,
      COUNT(*) FILTER (WHERE dias > 90) AS f_mais_90
    FROM dias_calc
  )
  SELECT json_build_object(
    'faixas', json_build_array(
      json_build_object(
        'faixa', '0-15',
        'clientes', (SELECT f_0_15 FROM contagens),
        'pct', CASE WHEN (SELECT total_carteira FROM contagens) > 0
          THEN ROUND((SELECT f_0_15 FROM contagens)::numeric / (SELECT total_carteira FROM contagens) * 100, 1)
          ELSE 0 END
      ),
      json_build_object(
        'faixa', '16-30',
        'clientes', (SELECT f_16_30 FROM contagens),
        'pct', CASE WHEN (SELECT total_carteira FROM contagens) > 0
          THEN ROUND((SELECT f_16_30 FROM contagens)::numeric / (SELECT total_carteira FROM contagens) * 100, 1)
          ELSE 0 END
      ),
      json_build_object(
        'faixa', '31-60',
        'clientes', (SELECT f_31_60 FROM contagens),
        'pct', CASE WHEN (SELECT total_carteira FROM contagens) > 0
          THEN ROUND((SELECT f_31_60 FROM contagens)::numeric / (SELECT total_carteira FROM contagens) * 100, 1)
          ELSE 0 END
      ),
      json_build_object(
        'faixa', '61-90',
        'clientes', (SELECT f_61_90 FROM contagens),
        'pct', CASE WHEN (SELECT total_carteira FROM contagens) > 0
          THEN ROUND((SELECT f_61_90 FROM contagens)::numeric / (SELECT total_carteira FROM contagens) * 100, 1)
          ELSE 0 END
      ),
      json_build_object(
        'faixa', '+90',
        'clientes', (SELECT f_mais_90 FROM contagens),
        'pct', CASE WHEN (SELECT total_carteira FROM contagens) > 0
          THEN ROUND((SELECT f_mais_90 FROM contagens)::numeric / (SELECT total_carteira FROM contagens) * 100, 1)
          ELSE 0 END
      )
    ),
    'totalCarteira', (SELECT total_carteira FROM contagens),
    'clientesComAcao', (SELECT com_acao FROM contagens),
    'clientesSemAcao', (SELECT sem_acao FROM contagens)
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.rpc_acoes_clientes_risco(text, text) IS
  'Distribuicao de clientes da carteira por faixa de dias desde ultima acao no ano corrente. Faixas: 0-15, 16-30, 31-60, 61-90, +90. Clientes sem acao no ano = faixa +90 (dias=999).';

GRANT EXECUTE ON FUNCTION public.rpc_acoes_clientes_risco(text, text) TO anon, authenticated, service_role;
