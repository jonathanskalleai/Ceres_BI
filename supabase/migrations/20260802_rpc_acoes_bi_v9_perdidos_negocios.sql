-------------------------------------------------------------------------------
-- rpc_acoes_bi v9  (supersede 20260731_rpc_acoes_bi_v8_pedidos_repassse.sql)
--
-- PROPOSITO
--   Separar os tres indicadores de /bi/acoes em fontes proprias, e canonizar
--   mirror.crm_negocios por ngo_numero antes de qualquer join.
--
--     Indicador      | Fonte                | Data de competencia  | Unidade
--     ---------------|----------------------|----------------------|------------------------
--     Oportunidades  | mirror.crm_acoes     | aco_dthconclusao     | negocio distinto
--     Ganhos         | mirror.crm_pedidos   | pdo_dthaprovacao     | pedido / pdo_vlrpedido
--     Perdidos       | mirror.crm_negocios  | ngo_datafechamento   | negocio / ngo_vlrtotalnegociado
--
--   Os tres excluem EXCLUSIVAMENTE ngo_funil = 'REPASSE DE MAQUINA'.
--   Ganhos e Perdidos sao desfechos PARALELOS (reguas de valor diferentes:
--   R$ de pedido vs R$ negociado). Nao existe taxa ganho/(ganho+perdido).
--
-- MUDANCAS EM RELACAO A v8
--
-- 1) CTE NOVA negocios_canonicos — UMA linha por ngo_numero
--      DISTINCT ON (ngo_numero)
--      ORDER BY ngo_numero, ngo_dataatualizacao DESC NULLS LAST,
--               dthregistro DESC NULLS LAST
--
--    crm_negocios e denormalizada por LINHA DE PRODUTO: um negocio com 5
--    produtos aparece em 5 linhas, todas com o mesmo ngo_vlrtotalnegociado
--    (que e o total do NEGOCIO, nao do produto). Canonizar NAO subconta
--    negocio multi-produto.
--
--    ngo_dataatualizacao e usada AQUI e SOMENTE aqui, como ordenacao tecnica
--    para escolher a versao vigente do registro. Ela NUNCA define janela de
--    indicador. ngo_datacadastro nao e mais referenciada nesta funcao.
--
-- 2) pedidos_periodo passa a fazer JOIN com negocios_canonicos (v8 fazia JOIN
--    CRU com mirror.crm_negocios e produzia fan-out real). Medido no banco
--    vivo em 2026-08-02T23:00Z, janela 2026-01-01..2026-12-31:
--
--      join cru (v8):    125 linhas / 121 pedidos -> R$ 16.689.847,18
--      join canonico:    121 linhas / 121 pedidos -> R$ 15.130.847,18
--                                     delta: -4 linhas e -R$ 1.559.000,00
--
--    Julho/2026 nao muda (26 ganhos / R$ 2.753.425,30, fan-out zero no mes).
--    A definicao de ganho NAO mudou; o que mudou foi parar de contar a mesma
--    venda uma vez por linha de produto do negocio.
--
-- 3) CTE NOVA negocios_perdidos_periodo — Perdido deixa de ser derivado de
--    pedido Cancelado (que a v8 zerava) e passa a vir do NEGOCIO:
--      ngo_conclusao = 'Perdido'
--      AND ngo_datafechamento::date na janela
--      AND ngo_funil <> 'REPASSE DE MAQUINA'
--    Valor = SUM(ngo_vlrtotalnegociado). Nenhum pedido alimenta Perdido.
--
-- 4) FILTROS (fim do desfecho global)
--    p_vendedor  -> ganhos e perdidos por DONO DO NEGOCIO
--                   (ngo_vendedores -> usuarios.usr_codusuario -> usr_nomeusuario).
--                   v8 usava pdo_vendedor (dono do PEDIDO) — regua diferente.
--    p_cidade    -> ganhos e perdidos por mirror.fn_cli_cidade(cli_idcliente),
--                   a mesma regua do resto da tela. v8 usava pdo_cidadeufentrega.
--    p_tipo_acao -> aplica-se SOMENTE a acoes. Pedido e negocio nao tem tipo de
--                   acao; aplicar ali seria inventar filtro.
--    Oportunidades/visitas continuam por aco_vendedor (quem EXECUTOU a acao).
--
-- 5) CONTRATO JSON (kpis) — o @dev precisa acompanhar
--    REMOVIDOS: valorTocado, negociosTocados, valorAberto, negociosAberto
--               O bucket "aberto" sai INTEIRO: o card "Valor em Aberto" deixa o
--               grid nesta entrega, e negociosAberto so existia como hint dele.
--               Manter meio bucket (valor fora, contagem em 0) reproduziria o
--               proprio defeito que originou esta demanda — numero plausivel
--               que nao representa nada. "Pipeline aberto atual" e contrato de
--               ESTOQUE, com data de competencia propria, e volta como campo
--               novo quando for especificado, nao como resto de v8.
--    MANTIDO:   negociosOutrosStatus, agora REALIMENTADO (v8 devolvia 0 fixo).
--               Universo novo: negocio canonico que FECHOU na janela
--               (ngo_datafechamento) com ngo_conclusao fora de
--               'Em Andamento' / 'Ganho' / 'Perdido' (inclusive NULL).
--               Motivo de manter o detector: Perdido agora depende inteiramente
--               de ngo_conclusao — um 4o status do ERP encolheria a tela em
--               silencio. Hoje o ERP so tem 3 status (verificado 2026-08-02),
--               entao o esperado e 0. Zero aqui e sinal de saude, nao de campo
--               morto.
--
-- CTEs NOVAS:     negocios_base, negocios_canonicos, negocios_perdidos_periodo,
--                 negocios_outros_status_periodo
-- CTEs ALTERADAS: pedidos_periodo (join canonico + filtros por negocio),
--                 valores_status (perdido real, tocado/aberto fora), kpis
-- CTEs INALTERADAS: filtered, pedidos_dedup, kpi_agg, tempo_medio, por_vendedor,
--   por_cidade, por_mes, por_dia, por_tipo_acao, por_tipo_contato, lista_anos,
--   por_vendedor_cidade, clientes_atendidos
--
-- FOTOGRAFIA DE VALIDACAO (dado vivo, 2026-08-02T23:00Z — NAO virar fixture)
--   julho/2026: 26 ganhos / R$ 2.753.425,30
--               7 perdidos / R$ 1.060.000,00 (VENDAS 5 / R$ 450.000 +
--                                             ADM 2 / R$ 610.000)
--   2026:       121 linhas = 121 pedidos distintos (fan-out zerado)
-------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_acoes_bi(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_vendedor text DEFAULT NULL,
  p_tipo_acao text DEFAULT NULL,
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
  WITH filtered AS (
    SELECT
      a.aco_vendedor,
      a.emp_cidade,
      COALESCE(cc.cli_cidade, a.emp_cidade) AS cidade,
      a.aco_tipocontato,
      a.aco_tipoacao,
      a.cli_nome,
      a.cli_idcliente,
      a.aco_dthconclusao,
      a.aco_dthabertura,
      a.ngo_nronegocio
    FROM mirror.crm_acoes a
    LEFT JOIN LATERAL (
      SELECT c.cli_cidade
      FROM mirror.crm_carteira_clientes c
      WHERE c.cli_idcliente = a.cli_idcliente
        AND c.cli_cidade IS NOT NULL
        AND c.cli_cidade <> ''
      LIMIT 1
    ) cc ON TRUE
    WHERE (p_from IS NULL OR a.aco_dthconclusao::date >= p_from)
      AND (p_to IS NULL OR a.aco_dthconclusao::date <= p_to)
      AND a.aco_dthconclusao IS NOT NULL
      AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
      AND (p_tipo_acao IS NULL OR a.aco_tipoacao = p_tipo_acao)
      AND (p_cidade IS NULL OR COALESCE(cc.cli_cidade, a.emp_cidade) = p_cidade)
  ),
  -- ---------------------------------------------------------------------------
  -- CTE NOVA v9: negocios_base — 1 linha por ngo_numero.
  -- ngo_dataatualizacao aqui e ORDENACAO TECNICA (escolher a versao vigente do
  -- registro), NUNCA janela de indicador. Empates residuais sao linhas de
  -- produto do MESMO negocio: qualquer uma devolve a mesma resposta de negocio
  -- (conclusao / fechamento / valor / funil / vendedor identicos).
  -- ---------------------------------------------------------------------------
  negocios_base AS MATERIALIZED (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_conclusao,
      n.ngo_funil,
      n.ngo_datafechamento,
      n.ngo_vlrtotalnegociado,
      n.ngo_vendedores,
      n.cli_idcliente
    FROM mirror.crm_negocios n
    WHERE n.ngo_numero IS NOT NULL
    ORDER BY n.ngo_numero,
             n.ngo_dataatualizacao DESC NULLS LAST,
             n.dthregistro DESC NULLS LAST
  ),
  -- ---------------------------------------------------------------------------
  -- CTE NOVA v9: negocios_canonicos — base + atribuicao resolvida (consultor
  -- dono do negocio e cidade do cliente), para ganhos e perdidos usarem a MESMA
  -- regua de filtro. usr_codusuario nao tem duplicata nao-nula (verificado
  -- 2026-08-02: 64 codigos distintos, 0 duplicados) — o LEFT JOIN nao refaz
  -- fan-out.
  -- ---------------------------------------------------------------------------
  negocios_canonicos AS MATERIALIZED (
    SELECT
      b.ngo_numero,
      b.ngo_conclusao,
      b.ngo_funil,
      b.ngo_datafechamento,
      b.ngo_vlrtotalnegociado,
      b.ngo_vendedores,
      b.cli_idcliente,
      NULLIF(u.usr_nomeusuario, '') AS consultor_negocio,
      mirror.fn_cli_cidade(b.cli_idcliente) AS cidade_negocio
    FROM negocios_base b
    LEFT JOIN mirror.usuarios u
      ON u.usr_codusuario = NULLIF(b.ngo_vendedores, '')
  ),
  pedidos_dedup AS (
    SELECT DISTINCT ON (p.pdo_codigointerno)
      p.pdo_codigointerno,
      p.pdo_situacaopedido,
      p.pdo_vlrpedido,
      p.pdo_dthaprovacao,
      p.ngo_numero
    FROM mirror.crm_pedidos p
    ORDER BY p.pdo_codigointerno, p.pdo_dthaprovacao DESC NULLS LAST
  ),
  -- ---------------------------------------------------------------------------
  -- CTE ALTERADA v9: pedidos_periodo — GANHOS.
  -- Regra de ganho inalterada (pedido Aprovado + negocio Ganho + sem REPASSE +
  -- aprovacao na janela); o join agora e canonico, entao cada venda conta UMA
  -- vez. p_vendedor/p_cidade passam a olhar o NEGOCIO, nao o pedido.
  -- ---------------------------------------------------------------------------
  pedidos_periodo AS MATERIALIZED (
    SELECT
      pd.pdo_codigointerno,
      pd.pdo_vlrpedido,
      pd.pdo_dthaprovacao,
      pd.ngo_numero
    FROM pedidos_dedup pd
    JOIN negocios_canonicos nc ON nc.ngo_numero = pd.ngo_numero
    WHERE pd.pdo_dthaprovacao::date BETWEEN p_from AND p_to
      AND pd.pdo_situacaopedido = 'Aprovado'
      AND nc.ngo_conclusao = 'Ganho'
      AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
      AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
      AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
  ),
  -- ---------------------------------------------------------------------------
  -- CTE NOVA v9: negocios_perdidos_periodo — PERDIDOS.
  -- Fonte NEGOCIO, data ngo_datafechamento, valor ngo_vlrtotalnegociado.
  -- Nenhum pedido (nem Cancelado) alimenta este conjunto.
  -- ---------------------------------------------------------------------------
  negocios_perdidos_periodo AS MATERIALIZED (
    SELECT
      nc.ngo_numero,
      nc.ngo_vlrtotalnegociado
    FROM negocios_canonicos nc
    WHERE nc.ngo_conclusao = 'Perdido'
      AND nc.ngo_funil <> 'REPASSE DE MAQUINA'
      AND nc.ngo_datafechamento::date BETWEEN p_from AND p_to
      AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
      AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
  ),
  -- ---------------------------------------------------------------------------
  -- CTE NOVA v9: negocios_outros_status_periodo — DETECTOR.
  -- Mesmo universo dos perdidos, menos o filtro de status: negocio que fechou
  -- na janela e cujo ngo_conclusao nao e nenhum dos 3 conhecidos. Alimenta
  -- kpis.negociosOutrosStatus (StatusDesconhecidoAlert). Esperado 0 hoje.
  -- ---------------------------------------------------------------------------
  negocios_outros_status_periodo AS MATERIALIZED (
    SELECT nc.ngo_numero
    FROM negocios_canonicos nc
    WHERE nc.ngo_funil <> 'REPASSE DE MAQUINA'
      AND nc.ngo_datafechamento::date BETWEEN p_from AND p_to
      AND (nc.ngo_conclusao IS NULL
           OR nc.ngo_conclusao NOT IN ('Em Andamento', 'Ganho', 'Perdido'))
      AND (p_vendedor IS NULL OR nc.consultor_negocio = p_vendedor)
      AND (p_cidade IS NULL OR nc.cidade_negocio = p_cidade)
  ),
  -- ---------------------------------------------------------------------------
  -- CTE REESCRITA v9: valores_status.
  -- Os cards deixam de ser particoes do mesmo universo: Ganho vem de PEDIDO,
  -- Perdido vem de NEGOCIO. Somar os dois seria somar reguas diferentes — por
  -- isso valor_total/neg_total (valorTocado/negociosTocados) sairam.
  -- ---------------------------------------------------------------------------
  valores_status AS (
    SELECT
      (SELECT COALESCE(SUM(pdo_vlrpedido), 0) FROM pedidos_periodo)                  AS valor_ganho,
      (SELECT COUNT(*) FROM pedidos_periodo)                                         AS neg_ganho,
      (SELECT COALESCE(SUM(ngo_vlrtotalnegociado), 0)
         FROM negocios_perdidos_periodo)                                             AS valor_perdido,
      (SELECT COUNT(*) FROM negocios_perdidos_periodo)                               AS neg_perdido,
      (SELECT COUNT(*) FROM negocios_outros_status_periodo)                          AS neg_outros
  ),
  kpi_agg AS (
    SELECT
      COUNT(*) AS total_acoes,
      COUNT(DISTINCT cidade) FILTER (WHERE cidade IS NOT NULL AND cidade <> '') AS cidades,
      COUNT(DISTINCT aco_vendedor) FILTER (WHERE aco_vendedor IS NOT NULL) AS consultores,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(aco_tipocontato, '')) LIKE '%visita%') AS visitas,
      COUNT(DISTINCT cli_nome) FILTER (WHERE cli_nome IS NOT NULL) AS clientes,
      COUNT(DISTINCT aco_tipoacao) FILTER (WHERE aco_tipoacao IS NOT NULL) AS tipos_acao_distintos
    FROM filtered
  ),
  tempo_medio AS (
    SELECT COALESCE(
      AVG(EXTRACT(EPOCH FROM (aco_dthconclusao - aco_dthabertura)) / 86400)::int,
      0
    ) AS dias
    FROM filtered
    WHERE aco_dthabertura IS NOT NULL
      AND aco_dthconclusao IS NOT NULL
      AND aco_dthconclusao > aco_dthabertura
  ),
  kpis AS (
    SELECT json_build_object(
      'totalAcoes', (SELECT total_acoes FROM kpi_agg),
      'cidades', (SELECT cidades FROM kpi_agg),
      'consultores', (SELECT consultores FROM kpi_agg),
      'visitas', (SELECT visitas FROM kpi_agg),
      'clientes', (SELECT clientes FROM kpi_agg),
      'tiposAcaoDistintos', (SELECT tipos_acao_distintos FROM kpi_agg),
      'valorGanho', (SELECT valor_ganho FROM valores_status),
      'negociosGanho', (SELECT neg_ganho FROM valores_status),
      'valorPerdido', (SELECT valor_perdido FROM valores_status),
      'negociosPerdido', (SELECT neg_perdido FROM valores_status),
      'negociosOutrosStatus', (SELECT neg_outros FROM valores_status),
      'tempoMedioContato', (SELECT dias FROM tempo_medio)
    ) AS val
  ),
  por_vendedor AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT aco_vendedor AS name, COUNT(*) AS acoes
      FROM filtered
      WHERE aco_vendedor IS NOT NULL
      GROUP BY aco_vendedor
      ORDER BY COUNT(*) DESC
      LIMIT 15
    ) sub
  ),
  por_cidade AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT f.cidade AS name, COUNT(*) AS acoes
      FROM filtered f
      WHERE f.cidade IS NOT NULL AND f.cidade <> ''
      GROUP BY f.cidade
      ORDER BY COUNT(*) DESC
      LIMIT 15
    ) sub
  ),
  por_mes AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.name), '[]'::json) AS val
    FROM (
      SELECT TO_CHAR(a.aco_dthconclusao::date, 'YYYY-MM') AS name, COUNT(*) AS acoes
      FROM mirror.crm_acoes a
      LEFT JOIN LATERAL (
        SELECT c.cli_cidade
        FROM mirror.crm_carteira_clientes c
        WHERE c.cli_idcliente = a.cli_idcliente
          AND c.cli_cidade IS NOT NULL
          AND c.cli_cidade <> ''
        LIMIT 1
      ) cc ON TRUE
      WHERE a.aco_dthconclusao IS NOT NULL
        AND EXTRACT(YEAR FROM a.aco_dthconclusao) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
        AND (p_tipo_acao IS NULL OR a.aco_tipoacao = p_tipo_acao)
        AND (p_cidade IS NULL OR COALESCE(cc.cli_cidade, a.emp_cidade) = p_cidade)
      GROUP BY TO_CHAR(a.aco_dthconclusao::date, 'YYYY-MM')
    ) sub
  ),
  por_dia AS (
    SELECT json_build_array(
      json_build_object('name', 'Seg', 'acoes', COUNT(*) FILTER (WHERE EXTRACT(DOW FROM aco_dthconclusao::date) = 1)),
      json_build_object('name', 'Ter', 'acoes', COUNT(*) FILTER (WHERE EXTRACT(DOW FROM aco_dthconclusao::date) = 2)),
      json_build_object('name', 'Qua', 'acoes', COUNT(*) FILTER (WHERE EXTRACT(DOW FROM aco_dthconclusao::date) = 3)),
      json_build_object('name', 'Qui', 'acoes', COUNT(*) FILTER (WHERE EXTRACT(DOW FROM aco_dthconclusao::date) = 4)),
      json_build_object('name', 'Sex', 'acoes', COUNT(*) FILTER (WHERE EXTRACT(DOW FROM aco_dthconclusao::date) = 5)),
      json_build_object('name', 'Sab', 'acoes', COUNT(*) FILTER (WHERE EXTRACT(DOW FROM aco_dthconclusao::date) = 6)),
      json_build_object('name', 'Dom', 'acoes', COUNT(*) FILTER (WHERE EXTRACT(DOW FROM aco_dthconclusao::date) = 0))
    ) AS val
    FROM filtered
  ),
  por_tipo_acao AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT aco_tipoacao AS id, aco_tipoacao AS name, COUNT(*) AS value
      FROM filtered
      WHERE aco_tipoacao IS NOT NULL
      GROUP BY aco_tipoacao
      ORDER BY COUNT(*) DESC
    ) sub
  ),
  por_tipo_contato AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT aco_tipocontato AS id, aco_tipocontato AS name, COUNT(*) AS value
      FROM filtered
      WHERE aco_tipocontato IS NOT NULL
      GROUP BY aco_tipocontato
      ORDER BY COUNT(*) DESC
    ) sub
  ),
  lista_anos AS (
    SELECT COALESCE(json_agg(sub.ano ORDER BY sub.ano DESC), '[]'::json) AS val
    FROM (
      SELECT DISTINCT TO_CHAR(aco_dthconclusao::date, 'YYYY') AS ano
      FROM filtered
    ) sub
  ),
  por_vendedor_cidade AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        f.aco_vendedor AS vendedor,
        f.cidade AS cidade,
        COUNT(*) AS acoes,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(f.aco_tipocontato, '')) LIKE '%visita%') AS visitas
      FROM filtered f
      WHERE f.aco_vendedor IS NOT NULL AND f.cidade IS NOT NULL AND f.cidade <> ''
      GROUP BY f.aco_vendedor, f.cidade
      ORDER BY COUNT(*) DESC
      LIMIT 50
    ) sub
  ),
  clientes_atendidos AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        a.cli_nome AS cliente,
        COALESCE(cc.cli_cidade, a.emp_cidade) AS cidade,
        COUNT(*) AS acoes,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.aco_tipocontato, '')) LIKE '%visita%') AS visitas
      FROM mirror.crm_acoes a
      LEFT JOIN LATERAL (
        SELECT c.cli_cidade
        FROM mirror.crm_carteira_clientes c
        WHERE c.cli_idcliente = a.cli_idcliente
          AND c.cli_cidade IS NOT NULL
          AND c.cli_cidade <> ''
        LIMIT 1
      ) cc ON TRUE
      WHERE a.aco_dthconclusao IS NOT NULL
        AND EXTRACT(YEAR FROM a.aco_dthconclusao) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND a.cli_nome IS NOT NULL AND a.cli_nome <> ''
        AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
        AND (p_tipo_acao IS NULL OR a.aco_tipoacao = p_tipo_acao)
        AND (p_cidade IS NULL OR COALESCE(cc.cli_cidade, a.emp_cidade) = p_cidade)
      GROUP BY a.cli_nome, COALESCE(cc.cli_cidade, a.emp_cidade)
      ORDER BY COUNT(*) DESC
      LIMIT 15
    ) sub
  )
  SELECT json_build_object(
    'kpis', (SELECT val FROM kpis),
    'porVendedor', (SELECT val FROM por_vendedor),
    'porCidade', (SELECT val FROM por_cidade),
    'porMes', (SELECT val FROM por_mes),
    'porDiaSemana', (SELECT val FROM por_dia),
    'porTipoAcao', (SELECT val FROM por_tipo_acao),
    'porTipoContato', (SELECT val FROM por_tipo_contato),
    'listaAnos', (SELECT val FROM lista_anos),
    'porVendedorCidade', (SELECT val FROM por_vendedor_cidade),
    'clientesMaisAtendidos', (SELECT val FROM clientes_atendidos)
  ) INTO result;

  RETURN result;
END;
$$;

COMMENT ON FUNCTION public.rpc_acoes_bi(date, date, text, text, text) IS
  'KPIs e graficos de /bi/acoes v9. Tres fontes separadas: oportunidades/visitas de crm_acoes (aco_dthconclusao), GANHOS de crm_pedidos Aprovado com negocio canonico Ganho (pdo_dthaprovacao, pdo_vlrpedido), PERDIDOS de crm_negocios canonico (ngo_datafechamento, ngo_vlrtotalnegociado). Todos excluem ngo_funil=REPASSE DE MAQUINA. crm_negocios canonizado por DISTINCT ON (ngo_numero) ORDER BY ngo_dataatualizacao DESC, dthregistro DESC — elimina fan-out de linha de produto. p_vendedor/p_cidade nos desfechos usam dono do negocio e fn_cli_cidade; p_tipo_acao so afeta acoes. kpis: bucket "aberto" REMOVIDO por inteiro (valorTocado, negociosTocados, valorAberto, negociosAberto); negociosOutrosStatus realimentado (detector de 4o status do ERP).';

GRANT EXECUTE ON FUNCTION public.rpc_acoes_bi(date, date, text, text, text) TO anon, authenticated, service_role;
