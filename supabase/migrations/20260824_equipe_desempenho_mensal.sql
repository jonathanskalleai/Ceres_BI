-- Análise mensal de desempenho da equipe.
--
-- O resultado é calculado inteiramente no PostgreSQL. O front recebe no máximo
-- 12 linhas por consultor, nunca ações/pedidos para reagregar no navegador.
--
-- Regras comerciais confirmadas com a planilha:
--   * venda/negócio = pedido Aprovado + negócio Ganho, sem Repasse de Máquina;
--   * conversão geral e de Prospecção Maq usam o MESMO numerador (negócios);
--   * Prospecção Maq = clientes distintos em ações "1 - Prospecção Maq".

-- Metas ficam na granularidade que a tabela precisa: consultor x mês.
-- A configuração anual é a soma/distribuição desses doze registros, evitando
-- conflito entre uma meta anual e metas mensais diferentes.
CREATE TABLE IF NOT EXISTS public.metas_consultor_mensal (
  consultor text NOT NULL,
  competencia date NOT NULL,
  meta numeric(15,2) NOT NULL CHECK (meta >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT metas_consultor_mensal_competencia_mes
    CHECK (competencia = date_trunc('month', competencia)::date),
  CONSTRAINT metas_consultor_mensal_unica UNIQUE (consultor, competencia)
);

COMMENT ON TABLE public.metas_consultor_mensal IS
  'Meta comercial mensal por consultor. A meta anual é a soma dos meses configurados.';

ALTER TABLE public.metas_consultor_mensal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "metas_consultor_mensal_select_authenticated" ON public.metas_consultor_mensal;
CREATE POLICY "metas_consultor_mensal_select_authenticated"
  ON public.metas_consultor_mensal
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "metas_consultor_mensal_manage_admin" ON public.metas_consultor_mensal;
CREATE POLICY "metas_consultor_mensal_manage_admin"
  ON public.metas_consultor_mensal
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles profile
      WHERE profile.id = auth.uid()
        AND profile.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles profile
      WHERE profile.id = auth.uid()
        AND profile.role = 'admin'
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.metas_consultor_mensal TO authenticated;
GRANT ALL ON public.metas_consultor_mensal TO service_role;

DROP TRIGGER IF EXISTS metas_consultor_mensal_updated_at ON public.metas_consultor_mensal;
CREATE TRIGGER metas_consultor_mensal_updated_at
  BEFORE UPDATE ON public.metas_consultor_mensal
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Índices específicos para o relatório anual por equipe. As tabelas de mirror
-- são pequenas hoje, mas esses acessos crescem com o histórico e não podem
-- voltar a depender de varredura + deduplicação no navegador.
CREATE INDEX IF NOT EXISTS idx_crm_negocios_canonico_equipe
  ON mirror.crm_negocios (
    ngo_numero,
    ngo_dataatualizacao DESC NULLS LAST,
    dthregistro DESC NULLS LAST
  )
  INCLUDE (
    ngo_vendedores,
    ngo_conclusao,
    ngo_funil,
    ngo_vlrtotalnegociado,
    cli_idcliente,
    emp_cidade
  );

CREATE INDEX IF NOT EXISTS idx_crm_funil_etapa_equipe_aberta
  ON mirror.crm_funil_etapa (
    fne_dthinicioetapa,
    fne_dthterminoetapa,
    ngo_numero
  )
  WHERE UPPER(BTRIM(funil_dsc)) = 'VENDAS'
    AND UPPER(BTRIM(etapa_dscstatusnegocio)) IN (
      'OPORTUNIDADE',
      'COTACAO',
      'PROPOSTA AO CLIENTE'
    );

CREATE INDEX IF NOT EXISTS idx_crm_acoes_equipe_mes_consultor_cliente
  ON mirror.crm_acoes (aco_dthconclusao, aco_vendedor, cli_idcliente)
  INCLUDE (aco_tipoacao, emp_cidade)
  WHERE aco_dthconclusao IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_pedidos_equipe_aprovados
  ON mirror.crm_pedidos (pdo_dthaprovacao, ngo_numero, pdo_codigointerno)
  INCLUDE (pdo_vlrpedido)
  WHERE pdo_situacaopedido = 'Aprovado';

CREATE OR REPLACE FUNCTION public.rpc_equipe_desempenho_mensal(
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
-- A função recebe filtros opcionais e, no plano genérico do Postgres, o
-- otimizador subestimava a CTE materializada de etapas como uma linha. Isso
-- produzia milhões de comparações em nested loop; hash joins são estáveis para
-- as dimensões anuais deste relatório.
SET enable_nestloop = off
AS $$
  WITH
  limites AS (
    SELECT make_date(p_ano, 1, 1) AS inicio,
           make_date(p_ano + 1, 1, 1) AS fim
  ),
  meses AS (
    SELECT periodo::date AS competencia,
           (periodo + interval '1 month - 1 day')::date AS fechamento
    FROM limites,
      generate_series(inicio, fim - interval '1 month', interval '1 month') AS periodo
  ),
  -- crm_negocios é desnormalizada por produto. Todas as métricas financeiras
  -- abaixo partem de uma única versão de cada NGO_Numero.
  negocios_base AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_funil,
      n.ngo_vendedores,
      n.ngo_vlrtotalnegociado,
      n.cli_idcliente,
      n.emp_cidade
    FROM mirror.crm_negocios n
    WHERE n.ngo_numero IS NOT NULL
      AND n.ngo_numero <> ''
    ORDER BY n.ngo_numero,
      n.ngo_dataatualizacao DESC NULLS LAST,
      n.dthregistro DESC NULLS LAST
  ),
  negocios_com_consultor AS MATERIALIZED (
    SELECT
      n.*,
      COALESCE(NULLIF(BTRIM(u.usr_nomeusuario), ''), NULLIF(BTRIM(n.ngo_vendedores), ''), 'Sem consultor') AS consultor,
      -- Cidade da empresa no próprio negócio. A resolução de cidade da
      -- carteira chama uma função por linha e tornava a consulta anual lenta;
      -- para a análise de equipe, esta dimensão é somente um filtro opcional.
      n.emp_cidade AS cidade
    FROM negocios_base n
    LEFT JOIN mirror.usuarios u
      ON u.usr_codusuario = NULLIF(BTRIM(n.ngo_vendedores), '')
  ),
  -- A fotografia mensal do funil usa a etapa que estava aberta no último dia
  -- do mês. A data de saída é essencial para que negócio já avançado não fique
  -- acumulado nas três colunas ao mesmo tempo.
  funil_aberto AS MATERIALIZED (
    SELECT
      m.competencia,
      nc.consultor,
      UPPER(BTRIM(f.etapa_dscstatusnegocio)) AS etapa,
      nc.ngo_vlrtotalnegociado AS valor
    FROM meses m
    JOIN mirror.crm_funil_etapa f
      ON f.fne_dthinicioetapa::date <= m.fechamento
      AND (f.fne_dthterminoetapa IS NULL OR f.fne_dthterminoetapa::date > m.fechamento)
    JOIN negocios_com_consultor nc ON nc.ngo_numero = f.ngo_numero
    WHERE UPPER(BTRIM(f.funil_dsc)) = 'VENDAS'
      AND UPPER(BTRIM(f.etapa_dscstatusnegocio)) IN (
        'OPORTUNIDADE',
        'COTACAO',
        'PROPOSTA AO CLIENTE'
      )
      AND (p_consultor IS NULL OR nc.consultor = p_consultor)
      AND (p_cidade IS NULL OR nc.cidade = p_cidade)
  ),
  funil_por_consultor AS MATERIALIZED (
    SELECT
      competencia,
      consultor,
      COALESCE(SUM(valor) FILTER (WHERE etapa = 'OPORTUNIDADE'), 0) AS oportunidade,
      COALESCE(SUM(valor) FILTER (WHERE etapa = 'COTACAO'), 0) AS cotacao,
      COALESCE(SUM(valor) FILTER (WHERE etapa = 'PROPOSTA AO CLIENTE'), 0) AS proposta
    FROM funil_aberto
    GROUP BY competencia, consultor
  ),
  pedidos_base AS MATERIALIZED (
    SELECT DISTINCT ON (p.pdo_codigointerno)
      p.pdo_codigointerno,
      p.pdo_situacaopedido,
      p.pdo_dthaprovacao,
      p.pdo_vlrpedido,
      p.ngo_numero
    FROM mirror.crm_pedidos p
    WHERE p.pdo_codigointerno IS NOT NULL
      AND p.pdo_codigointerno <> ''
    ORDER BY p.pdo_codigointerno,
      p.pdo_dthaprovacao DESC NULLS LAST,
      p.dthregistro DESC NULLS LAST
  ),
  vendas_por_consultor AS MATERIALIZED (
    SELECT
      date_trunc('month', p.pdo_dthaprovacao)::date AS competencia,
      nc.consultor,
      COUNT(*)::bigint AS negocios,
      COALESCE(SUM(p.pdo_vlrpedido), 0) AS total_venda
    FROM pedidos_base p
    JOIN negocios_com_consultor nc ON nc.ngo_numero = p.ngo_numero
    JOIN limites l ON true
    WHERE p.pdo_situacaopedido = 'Aprovado'
      AND p.pdo_dthaprovacao >= l.inicio
      AND p.pdo_dthaprovacao < l.fim
      AND nc.ngo_conclusao = 'Ganho'
      AND COALESCE(nc.ngo_funil, '') <> 'REPASSE DE MAQUINA'
      AND (p_consultor IS NULL OR nc.consultor = p_consultor)
      AND (p_cidade IS NULL OR nc.cidade = p_cidade)
    GROUP BY 1, 2
  ),
  acoes_por_consultor AS MATERIALIZED (
    SELECT
      date_trunc('month', a.aco_dthconclusao)::date AS competencia,
      COALESCE(NULLIF(BTRIM(a.aco_vendedor), ''), 'Sem consultor') AS consultor,
      COUNT(DISTINCT a.cli_idcliente)::bigint AS clientes,
      COUNT(DISTINCT a.cli_idcliente) FILTER (
        WHERE a.aco_tipoacao = '1 - Prospecção Maq'
      )::bigint AS prospeccao_maquina
    FROM mirror.crm_acoes a
    JOIN limites l ON true
    WHERE a.aco_dthconclusao >= l.inicio
      AND a.aco_dthconclusao < l.fim
      AND (p_consultor IS NULL OR a.aco_vendedor = p_consultor)
      AND (
        p_cidade IS NULL
        OR a.emp_cidade = p_cidade
      )
    GROUP BY 1, 2
  ),
  -- O total da equipe não pode somar os distintos de cada consultor: um mesmo
  -- cliente pode ter sido atendido por duas pessoas. Esta CTE preserva o
  -- distinto global que aparece na planilha de referência.
  acoes_equipe AS MATERIALIZED (
    SELECT
      date_trunc('month', a.aco_dthconclusao)::date AS competencia,
      COUNT(DISTINCT a.cli_idcliente)::bigint AS clientes,
      COUNT(DISTINCT a.cli_idcliente) FILTER (
        WHERE a.aco_tipoacao = '1 - Prospecção Maq'
      )::bigint AS prospeccao_maquina
    FROM mirror.crm_acoes a
    JOIN limites l ON true
    WHERE a.aco_dthconclusao >= l.inicio
      AND a.aco_dthconclusao < l.fim
      AND (p_consultor IS NULL OR a.aco_vendedor = p_consultor)
      AND (p_cidade IS NULL OR a.emp_cidade = p_cidade)
    GROUP BY 1
  ),
  consultores AS MATERIALIZED (
    SELECT DISTINCT consultor
    FROM (
      SELECT NULLIF(BTRIM(u.usr_nomeusuario), '') AS consultor
      FROM mirror.usuarios u
      WHERE u.usr_tipousuario = 'V'
        AND p_cidade IS NULL
      UNION ALL
      SELECT consultor FROM funil_aberto
      UNION ALL
      SELECT consultor FROM vendas_por_consultor
      UNION ALL
      SELECT consultor FROM acoes_por_consultor
      UNION ALL
      SELECT mc.consultor
      FROM public.metas_consultor_mensal mc
      JOIN limites l ON true
      WHERE mc.competencia >= l.inicio
        AND mc.competencia < l.fim
    ) origem
    WHERE consultor IS NOT NULL
      AND consultor <> ''
      AND (p_consultor IS NULL OR consultor = p_consultor)
  ),
  linhas_base AS MATERIALIZED (
    SELECT
      m.competencia,
      c.consultor,
      COALESCE(f.oportunidade, 0) AS oportunidade,
      COALESCE(f.cotacao, 0) AS cotacao,
      COALESCE(f.proposta, 0) AS proposta,
      COALESCE(meta.meta, 0) AS meta,
      COALESCE(v.total_venda, 0) AS total_venda,
      COALESCE(v.negocios, 0)::bigint AS negocios,
      COALESCE(a.clientes, 0)::bigint AS clientes,
      COALESCE(a.prospeccao_maquina, 0)::bigint AS prospeccao_maquina
    FROM meses m
    CROSS JOIN consultores c
    LEFT JOIN funil_por_consultor f
      ON f.competencia = m.competencia AND f.consultor = c.consultor
    LEFT JOIN vendas_por_consultor v
      ON v.competencia = m.competencia AND v.consultor = c.consultor
    LEFT JOIN acoes_por_consultor a
      ON a.competencia = m.competencia AND a.consultor = c.consultor
    LEFT JOIN public.metas_consultor_mensal meta
      ON meta.competencia = m.competencia AND meta.consultor = c.consultor
  ),
  linhas_com_total AS MATERIALIZED (
    SELECT
      *,
      oportunidade + cotacao + proposta AS total,
      LAG(oportunidade + cotacao + proposta) OVER (
        PARTITION BY consultor
        ORDER BY competencia
      ) AS total_mes_anterior
    FROM linhas_base
  ),
  linhas AS MATERIALIZED (
    SELECT
      competencia,
      consultor,
      oportunidade,
      cotacao,
      proposta,
      total,
      CASE
        WHEN total_mes_anterior IS NULL OR total_mes_anterior = 0 THEN NULL
        ELSE ROUND(((total / total_mes_anterior) - 1) * 100, 2)
      END AS crescimento_oportunidade,
      NULLIF(meta, 0) AS meta,
      total_venda,
      CASE
        WHEN meta = 0 THEN NULL
        ELSE ROUND((total_venda / meta) * 100, 2)
      END AS desempenho_meta,
      negocios,
      CASE
        WHEN negocios = 0 THEN NULL
        ELSE ROUND(total_venda / negocios, 2)
      END AS ticket_medio,
      clientes,
      CASE
        WHEN clientes = 0 THEN NULL
        ELSE ROUND((negocios::numeric / clientes) * 100, 2)
      END AS taxa_conversao_negocios,
      prospeccao_maquina,
      CASE
        WHEN prospeccao_maquina = 0 THEN NULL
        ELSE ROUND((negocios::numeric / prospeccao_maquina) * 100, 2)
      END AS taxa_conversao_maquina
    FROM linhas_com_total
  ),
  equipe_base AS MATERIALIZED (
    SELECT
      competencia,
      SUM(oportunidade) AS oportunidade,
      SUM(cotacao) AS cotacao,
      SUM(proposta) AS proposta,
      SUM(meta) AS meta,
      SUM(total_venda) AS total_venda,
      SUM(negocios)::bigint AS negocios,
      COALESCE(MAX(ae.clientes), 0)::bigint AS clientes,
      COALESCE(MAX(ae.prospeccao_maquina), 0)::bigint AS prospeccao_maquina
    FROM linhas_base
    LEFT JOIN acoes_equipe ae USING (competencia)
    GROUP BY competencia
  ),
  equipe_com_total AS MATERIALIZED (
    SELECT
      *,
      oportunidade + cotacao + proposta AS total,
      LAG(oportunidade + cotacao + proposta) OVER (ORDER BY competencia) AS total_mes_anterior
    FROM equipe_base
  ),
  equipe AS MATERIALIZED (
    SELECT
      competencia,
      oportunidade,
      cotacao,
      proposta,
      total,
      CASE
        WHEN total_mes_anterior IS NULL OR total_mes_anterior = 0 THEN NULL
        ELSE ROUND(((total / total_mes_anterior) - 1) * 100, 2)
      END AS crescimento_oportunidade,
      NULLIF(meta, 0) AS meta,
      total_venda,
      CASE WHEN meta = 0 THEN NULL ELSE ROUND((total_venda / meta) * 100, 2) END AS desempenho_meta,
      negocios,
      CASE WHEN negocios = 0 THEN NULL ELSE ROUND(total_venda / negocios, 2) END AS ticket_medio,
      clientes,
      CASE WHEN clientes = 0 THEN NULL ELSE ROUND((negocios::numeric / clientes) * 100, 2) END AS taxa_conversao_negocios,
      prospeccao_maquina,
      CASE WHEN prospeccao_maquina = 0 THEN NULL ELSE ROUND((negocios::numeric / prospeccao_maquina) * 100, 2) END AS taxa_conversao_maquina
    FROM equipe_com_total
  )
  SELECT jsonb_build_object(
    'rows', COALESCE((
      SELECT jsonb_agg(to_jsonb(l) ORDER BY l.consultor, l.competencia)
      FROM linhas l
    ), '[]'::jsonb),
    'team', COALESCE((
      SELECT jsonb_agg(to_jsonb(e) ORDER BY e.competencia)
      FROM equipe e
    ), '[]'::jsonb)
  );
$$;

COMMENT ON FUNCTION public.rpc_equipe_desempenho_mensal(integer, text, text) IS
  'Tabela mensal da Equipe. Funil: valor de negócios cuja etapa VENDAS estava aberta no último dia do mês. Vendas: pedido Aprovado com negócio Ganho, sem Repasse de Máquina. Conversões usam negócios / clientes atendidos e negócios / clientes de Prospecção Maq.';

REVOKE EXECUTE ON FUNCTION public.rpc_equipe_desempenho_mensal(integer, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_equipe_desempenho_mensal(integer, text, text)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
