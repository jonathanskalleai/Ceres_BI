-- Migration: RPC rpc_negocios_crm (server-side aggregation for CRM Negocios page)
-- Retorna JSON compatível com NegociosSummary do useNegociosData.ts
-- Diferença do rpc_negocios_bi: filtra por ngo_datacadastro (não ngo_datafechamento)
-- taxaConversao cruza com crm_acoes (clientes distintos no período)
-- Autor: @data-engineer (Dara)
-- Data: 2026-06-25

-------------------------------------------------------------------------------
-- INDICES (IF NOT EXISTS — idempotent)
-------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_crm_negocios_datacadastro
  ON mirror.crm_negocios (ngo_datacadastro);

CREATE INDEX IF NOT EXISTS idx_crm_negocios_datacadastro_vendedores
  ON mirror.crm_negocios (ngo_datacadastro, ngo_vendedores);

CREATE INDEX IF NOT EXISTS idx_crm_negocios_empcidade
  ON mirror.crm_negocios (emp_cidade);

-------------------------------------------------------------------------------
-- RPC: rpc_negocios_crm
-- Params: p_from date, p_to date, p_cidade text, p_vendedor text (all optional)
-- Returns: JSON matching NegociosSummary interface
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_negocios_crm(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_vendedor text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  WITH deduped AS (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_vlrtotalnegociado,
      n.ngo_vendedores,
      n.ngo_datacadastro,
      n.emp_cidade,
      n.emp_uf,
      n.cli_nome,
      n.prd_condicaoproduto,
      n.usa_valor,
      -- Join pedido inline for recebido/valor_pedido
      p.pdo_vlrpedido,
      p.pdo_vlrrecursoproprio,
      p.pdo_cidadeufentrega,
      p.pdo_vendedor,
      -- Resolve vendedor name
      COALESCE(u.usr_nomeusuario, n.ngo_vendedores) AS consultor_nome,
      -- Status classification
      CASE
        WHEN LOWER(COALESCE(n.ngo_conclusao, '')) = 'ganho' THEN 'ganho'
        WHEN LOWER(COALESCE(n.ngo_conclusao, '')) = 'perdido' THEN 'perdido'
        WHEN LOWER(COALESCE(n.ngo_conclusao, '')) LIKE '%perd%' THEN 'perdido'
        WHEN LOWER(COALESCE(n.ngo_conclusao, '')) LIKE '%ganh%' THEN 'ganho'
        ELSE 'andamento'
      END AS status_class,
      -- Computed valor (pedido takes priority)
      COALESCE(p.pdo_vlrpedido, n.ngo_vlrtotalnegociado, 0)::numeric AS valor_efetivo,
      COALESCE(p.pdo_vlrrecursoproprio, 0)::numeric AS recebido
    FROM mirror.crm_negocios n
    LEFT JOIN LATERAL (
      SELECT p2.pdo_vlrpedido, p2.pdo_vlrrecursoproprio, p2.pdo_cidadeufentrega, p2.pdo_vendedor
      FROM mirror.crm_pedidos p2
      WHERE p2.ngo_numero = n.ngo_numero
      LIMIT 1
    ) p ON true
    LEFT JOIN mirror.usuarios u ON TRIM(u.usr_codusuario) = TRIM(n.ngo_vendedores)
    WHERE (p_from IS NULL OR n.ngo_datacadastro::date >= p_from)
      AND (p_to IS NULL OR n.ngo_datacadastro::date <= p_to)
      AND (p_cidade IS NULL OR n.emp_cidade ILIKE '%' || p_cidade || '%'
           OR p.pdo_cidadeufentrega ILIKE '%' || p_cidade || '%')
      AND (p_vendedor IS NULL OR n.ngo_vendedores = p_vendedor)
    ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST
  ),
  -- -----------------------------------------------------------------------
  -- clientes atendidos no período (de crm_acoes, para taxaConversao)
  -- -----------------------------------------------------------------------
  clientes_atendidos AS (
    SELECT COUNT(DISTINCT a.cli_nome) AS total
    FROM mirror.crm_acoes a
    WHERE a.cli_nome IS NOT NULL
      AND (p_from IS NULL OR a.aco_dthconclusao::date >= p_from)
      AND (p_to IS NULL OR a.aco_dthconclusao::date <= p_to)
      AND (p_cidade IS NULL OR a.emp_cidade ILIKE '%' || p_cidade || '%')
      AND (p_vendedor IS NULL OR UPPER(TRIM(a.aco_vendedor)) = (
        SELECT UPPER(TRIM(u2.usr_nomeusuario))
        FROM mirror.usuarios u2
        WHERE TRIM(u2.usr_codusuario) = TRIM(p_vendedor)
        LIMIT 1
      ))
  ),
  -- -----------------------------------------------------------------------
  -- Summary KPIs
  -- -----------------------------------------------------------------------
  kpi_agg AS (
    SELECT
      COUNT(*) AS total_negocios,
      COALESCE(SUM(valor_efetivo), 0)::numeric AS total_valor,
      COUNT(*) FILTER (WHERE status_class = 'ganho') AS ganhos,
      COUNT(*) FILTER (WHERE status_class = 'andamento') AS em_andamento,
      COUNT(*) FILTER (WHERE status_class = 'perdido') AS perdidos,
      COALESCE(SUM(recebido), 0)::numeric AS total_recebido,
      COALESCE(SUM(GREATEST(valor_efetivo - recebido, 0)), 0)::numeric AS total_usado
    FROM deduped
  ),
  -- -----------------------------------------------------------------------
  -- Evolucao mensal: { mes, total, valor, ganhos }
  -- -----------------------------------------------------------------------
  evolucao AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.mes), '[]'::json) AS val
    FROM (
      SELECT
        TO_CHAR(ngo_datacadastro::date, 'YYYY-MM') AS mes,
        COUNT(*) AS total,
        COALESCE(SUM(valor_efetivo), 0)::numeric AS valor,
        COUNT(*) FILTER (WHERE status_class = 'ganho') AS ganhos
      FROM deduped
      WHERE ngo_datacadastro IS NOT NULL
      GROUP BY TO_CHAR(ngo_datacadastro::date, 'YYYY-MM')
      ORDER BY mes
    ) sub
  ),
  -- -----------------------------------------------------------------------
  -- Por consultor com lista de clientes
  -- porConsultor: { nome, total, valor, ganhos, conversao, ticketMedio,
  --                clientesAtendidos, recebido, usado, percentUsado, clientes[] }
  -- clientes[]: { cliente, valorTotal, recebido, valorUsado }
  -- -----------------------------------------------------------------------
  -- clientes atendidos por vendedor (NOME) no período — para conversao por consultor
  -- aco_vendedor usa NOME (ex: "DIEGO JOSE DO AMARAL"), ngo_vendedores usa CODIGO numerico
  clientes_por_vendedor AS (
    SELECT
      UPPER(TRIM(a.aco_vendedor)) AS nome_vendedor,
      COUNT(DISTINCT a.cli_nome) AS clientes_count
    FROM mirror.crm_acoes a
    WHERE a.cli_nome IS NOT NULL
      AND (p_from IS NULL OR a.aco_dthconclusao::date >= p_from)
      AND (p_to IS NULL OR a.aco_dthconclusao::date <= p_to)
      AND (p_cidade IS NULL OR a.emp_cidade ILIKE '%' || p_cidade || '%')
    GROUP BY UPPER(TRIM(a.aco_vendedor))
  ),
  por_consultor_base AS (
    SELECT
      COALESCE(NULLIF(TRIM(d.consultor_nome), ''), 'Sem consultor') AS nome,
      d.ngo_vendedores AS cod_vendedor,
      COUNT(*) AS total,
      COALESCE(SUM(d.valor_efetivo), 0)::numeric AS valor,
      COUNT(*) FILTER (WHERE d.status_class = 'ganho') AS ganhos,
      COALESCE(SUM(d.recebido), 0)::numeric AS total_recebido,
      COALESCE(SUM(GREATEST(d.valor_efetivo - d.recebido, 0)), 0)::numeric AS total_usado,
      -- clientes json array
      COALESCE(json_agg(
        json_build_object(
          'cliente', COALESCE(NULLIF(TRIM(d.cli_nome), ''), 'Sem cliente'),
          'valorTotal', ROUND(d.valor_efetivo, 2),
          'recebido', ROUND(d.recebido, 2),
          'valorUsado', ROUND(GREATEST(d.valor_efetivo - d.recebido, 0), 2)
        ) ORDER BY d.valor_efetivo DESC
      ), '[]'::json) AS clientes_raw
    FROM deduped d
    WHERE d.consultor_nome IS NOT NULL
    GROUP BY d.consultor_nome, d.ngo_vendedores
  ),
  por_consultor AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.valor DESC), '[]'::json) AS val
    FROM (
      SELECT
        pcb.nome,
        pcb.total,
        pcb.valor,
        pcb.ganhos,
        pcb.total_recebido AS recebido,
        pcb.total_usado AS usado,
        CASE WHEN pcb.valor > 0 THEN ROUND((pcb.total_usado / pcb.valor) * 100, 1) ELSE 0 END AS "percentUsado",
        CASE WHEN pcb.total > 0 THEN ROUND(pcb.valor / pcb.total, 2) ELSE 0 END AS "ticketMedio",
        COALESCE(cpv.clientes_count, 0)::int AS "clientesAtendidos",
        CASE WHEN COALESCE(cpv.clientes_count, 0) > 0
          THEN ROUND((pcb.total::numeric / cpv.clientes_count) * 100)
          ELSE 0
        END AS conversao,
        pcb.clientes_raw AS clientes
      FROM por_consultor_base pcb
      LEFT JOIN clientes_por_vendedor cpv ON cpv.nome_vendedor = UPPER(TRIM(pcb.nome))
    ) sub
  ),
  -- -----------------------------------------------------------------------
  -- Por regiao: { regiao, total, valor, ganhos }
  -- regiao = pdo_cidadeufentrega ?? emp_cidade/emp_uf
  -- -----------------------------------------------------------------------
  por_regiao AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.valor DESC), '[]'::json) AS val
    FROM (
      SELECT
        COALESCE(
          NULLIF(TRIM(pdo_cidadeufentrega), ''),
          NULLIF(TRIM(emp_cidade || CASE WHEN emp_uf IS NOT NULL THEN '/' || emp_uf ELSE '' END), '/'),
          'Sem região'
        ) AS regiao,
        COUNT(*) AS total,
        COALESCE(SUM(valor_efetivo), 0)::numeric AS valor,
        COUNT(*) FILTER (WHERE status_class = 'ganho') AS ganhos
      FROM deduped
      GROUP BY
        COALESCE(
          NULLIF(TRIM(pdo_cidadeufentrega), ''),
          NULLIF(TRIM(emp_cidade || CASE WHEN emp_uf IS NOT NULL THEN '/' || emp_uf ELSE '' END), '/'),
          'Sem região'
        )
      ORDER BY valor DESC
      LIMIT 30
    ) sub
  ),
  -- -----------------------------------------------------------------------
  -- Por tipo: { tipo, total, valor }
  -- tipo = prd_condicaoproduto
  -- -----------------------------------------------------------------------
  por_tipo AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.valor DESC), '[]'::json) AS val
    FROM (
      SELECT
        COALESCE(NULLIF(TRIM(prd_condicaoproduto), ''), 'Sem tipo') AS tipo,
        COUNT(*) AS total,
        COALESCE(SUM(valor_efetivo), 0)::numeric AS valor
      FROM deduped
      GROUP BY COALESCE(NULLIF(TRIM(prd_condicaoproduto), ''), 'Sem tipo')
      ORDER BY valor DESC
      LIMIT 20
    ) sub
  )
  -- -----------------------------------------------------------------------
  -- Final assembly (direct from kpi_agg — no double JSON decode)
  -- -----------------------------------------------------------------------
  SELECT json_build_object(
    'totalNegocios',    k.total_negocios,
    'totalValor',       k.total_valor,
    'ticketMedio',      CASE WHEN k.total_negocios > 0 THEN ROUND(k.total_valor / k.total_negocios, 2) ELSE 0 END,
    'ganhos',           k.ganhos,
    'emAndamento',      k.em_andamento,
    'perdidos',         k.perdidos,
    'taxaConversao',    CASE
                          WHEN (SELECT total FROM clientes_atendidos) > 0
                          THEN ROUND((k.total_negocios::numeric / (SELECT total FROM clientes_atendidos)) * 100)
                          ELSE 0
                        END,
    'clientesAtendidos',(SELECT total FROM clientes_atendidos),
    'totalRecebido',    k.total_recebido,
    'totalUsado',       k.total_usado,
    'percentUsado',     CASE WHEN k.total_valor > 0 THEN ROUND((k.total_usado / k.total_valor) * 100, 1) ELSE 0 END,
    'evolucaoMensal',   (SELECT val FROM evolucao),
    'porConsultor',     (SELECT val FROM por_consultor),
    'porRegiao',        (SELECT val FROM por_regiao),
    'porTipo',          (SELECT val FROM por_tipo),
    'registros',        '[]'::json
  ) INTO result
  FROM kpi_agg k;

  RETURN result;
END;
$$;

-------------------------------------------------------------------------------
-- Reload PostgREST schema cache
-------------------------------------------------------------------------------

NOTIFY pgrst, 'reload schema';
