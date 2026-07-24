-------------------------------------------------------------------------------
-- fn_cli_cidade + rpc_acoes_bi v5 + rpc_acoes_detalhe v2
--
-- Correcao de review sobre 20260724_rpc_acoes_bi_v4.sql / 20260724_rpc_acoes_detalhe.sql
-- (ambas JA APLICADAS no banco vivo — por isso esta migration e NOVA, aditiva,
-- e nao uma edicao das anteriores).
--
-- 1) DRY: o bloco `LEFT JOIN LATERAL (SELECT cli_cidade ... LIMIT 1)` estava
--    COPIADO 4x (v4 nas CTEs filtered / por_mes / clientes_atendidos, e mais uma
--    em rpc_acoes_detalhe). Regra dos 3x: virou `mirror.fn_cli_cidade()`.
--    E o pior lugar possivel para duplicar — o fan-out dessa mesma tabela ja
--    produziu um ranking de cidade ERRADO (Faxinal dos Guedes em 1o com 114
--    acoes, quando o correto e Mafra com 61). Corrigir em 4 lugares significa
--    esquecer um dia.
--
-- 2) DETERMINISMO: o `LIMIT 1` estava SEM `ORDER BY`. O comentario da v4 dizia
--    que era "deterministico na pratica" porque hoje ha 0 clientes com >1 cidade
--    distinta na carteira — mas isso e uma afirmacao sobre o DADO DE HOJE, nao
--    sobre o SQL. No dia em que um cliente ganhar 2 cidades, `porCidade` e o
--    heatmap passam a oscilar entre execucoes, em silencio, sem nada mudar no
--    codigo. O `ORDER BY c.usr_idusuario` fecha isso de vez: a escolha passa a
--    ser uma REGRA (a carteira do menor usr_idusuario vence) em vez de um
--    acidente do plano de execucao.
--
-- 3) LANGUAGE sql (nao plpgsql) + STABLE + single SELECT de proposito: assim o
--    planner INLINA a funcao e o plano continua sendo o mesmo LATERAL de antes.
--    Em plpgsql ela viraria uma caixa-preta chamada por linha e a leitura da
--    tabela (664 linhas/mes, ~5,5k/ano) ficaria mais lenta que a v4.
--
-- 4) Limpeza: colunas `emp_cidade` e `cli_idcliente` mortas no SELECT da CTE
--    `filtered` da v4 (nenhuma CTE a jusante le as duas — a cidade usada e a ja
--    resolvida em `filtered.cidade`).
--
-- NENHUMA MUDANCA DE SEMANTICA. Baseline que precisa continuar identico:
--   mes atual -> valorAberto 16.835.875,30/111 · valorGanho 754.500,00/6
--                valorPerdido 135.000,00/2 · totalAcoes 664 · cidades 90
--   rpc_acoes_detalhe mes atual -> rows 664, total 664 (nao 1.472)
-------------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Cidade do CLIENTE, uma linha por cliente.
--
-- A PK de mirror.crm_carteira_clientes e (cli_idcliente, usr_idusuario): o mesmo
-- cliente aparece uma vez POR VENDEDOR. Sem esta funcao (ou um LATERAL LIMIT 1),
-- um JOIN direto MULTIPLICA as acoes — medido: 664 acoes viravam 1.472 (2,22x).
--
-- ORDER BY usr_idusuario: desempate ESTAVEL quando o mesmo cliente estiver com
-- cidades diferentes em carteiras diferentes. Hoje isso nao ocorre (0 casos),
-- mas a funcao nao pode depender disso para dar sempre a mesma resposta.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mirror.fn_cli_cidade(p_cli_idcliente text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT c.cli_cidade
  FROM mirror.crm_carteira_clientes c
  WHERE c.cli_idcliente = p_cli_idcliente
    AND c.cli_cidade IS NOT NULL
    AND c.cli_cidade <> ''
  ORDER BY c.usr_idusuario
  LIMIT 1
$$;

COMMENT ON FUNCTION mirror.fn_cli_cidade(text) IS
  'Cidade do CLIENTE (crm_carteira_clientes), 1 linha por cliente. Existe para evitar o fan-out da PK (cli_idcliente, usr_idusuario). ORDER BY usr_idusuario garante resposta estavel se um cliente tiver cidades divergentes entre carteiras.';

GRANT EXECUTE ON FUNCTION mirror.fn_cli_cidade(text) TO anon, authenticated, service_role;

-------------------------------------------------------------------------------
-- rpc_acoes_bi v5 — identica a v4, exceto pelos 3 LATERAL -> fn_cli_cidade
-- e pela remocao das 2 colunas mortas em `filtered`.
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

  -- ---------------------------------------------------------------------------
  -- FUNIS COMERCIAIS — lista fechada usada nos 3 cards de valor.
  --
  -- Somente estes funis representam VENDA. Os demais funis existentes hoje
  -- (MARKETING, BANCOS, OFICINA, ADM, Adm AP, Logistica AP) sao excluidos porque:
  --
  --   a) "Ganho" neles NAO significa venda: em MARKETING significa NPS
  --      respondido, em BANCOS significa financiamento aprovado, em OFICINA
  --      significa OS concluida. Somar isso como receita infla o card de Ganho
  --      (medido em julho/2026: +R$ 1,56 M de MARKETING, +R$ 1,55 M de BANCOS,
  --      +R$ 0,71 M de OFICINA).
  --
  --   b) DUPLA CONTAGEM: o MESMO negocio aparece com ngo_numero DIFERENTE em
  --      funis paralelos, com o MESMO valor. Exemplos verificados no banco vivo:
  --      DIEGO LUIZ BADIA R$ 2.000.000 em MARKETING e em VENDAS; ANTON HERING
  --      R$ 250.000 em 3 negocios. Sem o filtro, o valor e contado 2-3x.
  --
  -- RISCO CONHECIDO (registrado na doc da feature): se o ERP criar um funil
  -- comercial NOVO (ex: "Vendas Pecas"), ele fica invisivel nos 3 cards em
  -- silencio. Query de auditoria para detectar isso (rodar periodicamente):
  --   SELECT ngo_funil, SUM(ngo_vlrtotalnegociado) FROM mirror.crm_negocios
  --   WHERE ngo_funil <> ALL (ARRAY['VENDAS','Vendas AP','REPASSE DE MAQUINA'])
  --   GROUP BY 1;
  -- ---------------------------------------------------------------------------
  c_funis_comerciais CONSTANT text[] := ARRAY['VENDAS', 'Vendas AP', 'REPASSE DE MAQUINA'];
BEGIN
  WITH filtered AS (
    SELECT
      a.aco_vendedor,
      -- cidade unificada da tela: cidade do CLIENTE, com fallback na filial
      -- (fallback e inerte hoje: 0 acoes do mes sem match na carteira)
      COALESCE(mirror.fn_cli_cidade(a.cli_idcliente), a.emp_cidade) AS cidade,
      a.aco_tipocontato,
      a.aco_tipoacao,
      a.cli_nome,
      a.aco_dthconclusao,
      a.aco_dthabertura,
      a.ngo_nronegocio
    FROM mirror.crm_acoes a
    WHERE (p_from IS NULL OR a.aco_dthconclusao::date >= p_from)
      AND (p_to IS NULL OR a.aco_dthconclusao::date <= p_to)
      AND a.aco_dthconclusao IS NOT NULL
      AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
      AND (p_tipo_acao IS NULL OR a.aco_tipoacao = p_tipo_acao)
      -- p_cidade casa com a cidade do CLIENTE (era emp_cidade ate a v3)
      AND (p_cidade IS NULL OR COALESCE(mirror.fn_cli_cidade(a.cli_idcliente), a.emp_cidade) = p_cidade)
  ),
  -- Negocios deduplicados por ngo_numero (a tabela esta no grao negocio x produto).
  negocios_dedup AS (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.ngo_vlrtotalnegociado,
      n.ngo_conclusao,
      n.ngo_funil
    FROM mirror.crm_negocios n
    WHERE n.ngo_numero IS NOT NULL
    ORDER BY n.ngo_numero, n.ngo_datacadastro DESC NULLS LAST
  ),
  -- Negocios COMERCIAIS tocados por alguma acao do periodo.
  -- Valor SEMPRE de ngo_vlrtotalnegociado (cabecalho do negocio) — NUNCA
  -- prd_vlrunitario * prd_qtde: so 69% dos negocios reconciliam por produto e ha
  -- caso real de negocio de R$ 66.000 com produto 0.00 (MARCELO FERNANDES,
  -- negocio 25062710152718485), que sumiria do card de Perdido.
  negocios_tocados AS (
    SELECT nd.ngo_numero, nd.ngo_vlrtotalnegociado, nd.ngo_conclusao
    FROM (
      SELECT DISTINCT f.ngo_nronegocio
      FROM filtered f
      WHERE f.ngo_nronegocio IS NOT NULL
        AND f.ngo_nronegocio <> ''
    ) distinct_ngo
    JOIN negocios_dedup nd ON nd.ngo_numero = distinct_ngo.ngo_nronegocio
    WHERE nd.ngo_funil = ANY (c_funis_comerciais)
  ),
  -- Recorte por status com CASE EXPLICITO nos 3 valores conhecidos hoje
  -- (Em Andamento / Ganho / Perdido). `neg_outros` existe de proposito: se o ERP
  -- introduzir um 4o status, ele NAO some em silencio — o frontend renderiza um
  -- aviso quando negociosOutrosStatus > 0 (AcoesKpiGrid). Falha por omissao e a
  -- pior falha possivel em BI.
  valores_status AS (
    SELECT
      COALESCE(SUM(ngo_vlrtotalnegociado) FILTER (WHERE ngo_conclusao = 'Em Andamento'), 0) AS valor_aberto,
      COUNT(*) FILTER (WHERE ngo_conclusao = 'Em Andamento') AS neg_aberto,
      COALESCE(SUM(ngo_vlrtotalnegociado) FILTER (WHERE ngo_conclusao = 'Ganho'), 0) AS valor_ganho,
      COUNT(*) FILTER (WHERE ngo_conclusao = 'Ganho') AS neg_ganho,
      COALESCE(SUM(ngo_vlrtotalnegociado) FILTER (WHERE ngo_conclusao = 'Perdido'), 0) AS valor_perdido,
      COUNT(*) FILTER (WHERE ngo_conclusao = 'Perdido') AS neg_perdido,
      COUNT(*) AS neg_total,
      COALESCE(SUM(ngo_vlrtotalnegociado), 0) AS valor_total,
      COUNT(*) FILTER (
        WHERE ngo_conclusao IS NULL
           OR ngo_conclusao NOT IN ('Em Andamento', 'Ganho', 'Perdido')
      ) AS neg_outros
    FROM negocios_tocados
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
  -- Tempo medio: AVG(conclusao - abertura) em dias. E a DURACAO da acao,
  -- nao o tempo ate o 1o contato (rotulo corrigido no frontend).
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
      'valorAberto', (SELECT valor_aberto FROM valores_status),
      'negociosAberto', (SELECT neg_aberto FROM valores_status),
      'valorGanho', (SELECT valor_ganho FROM valores_status),
      'negociosGanho', (SELECT neg_ganho FROM valores_status),
      'valorPerdido', (SELECT valor_perdido FROM valores_status),
      'negociosPerdido', (SELECT neg_perdido FROM valores_status),
      -- controle: total dos negocios comerciais tocados e sobra fora dos 3 status.
      -- negociosTocados = negociosAberto+negociosGanho+negociosPerdido+negociosOutros.
      'negociosTocados', (SELECT neg_total FROM valores_status),
      'valorTocado', (SELECT valor_total FROM valores_status),
      'negociosOutrosStatus', (SELECT neg_outros FROM valores_status),
      'tempoMedioContato', (SELECT dias FROM tempo_medio)
    ) AS val
  ),
  -- Por vendedor (top 15)
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
  -- Por cidade do CLIENTE (top 15) — usa a cidade ja resolvida em filtered
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
  -- Por mes — ANO ATUAL fixo (ignora p_from/p_to de proposito)
  por_mes AS (
    SELECT COALESCE(json_agg(row_to_json(sub) ORDER BY sub.name), '[]'::json) AS val
    FROM (
      SELECT TO_CHAR(a.aco_dthconclusao::date, 'YYYY-MM') AS name, COUNT(*) AS acoes
      FROM mirror.crm_acoes a
      WHERE a.aco_dthconclusao IS NOT NULL
        AND EXTRACT(YEAR FROM a.aco_dthconclusao) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
        AND (p_tipo_acao IS NULL OR a.aco_tipoacao = p_tipo_acao)
        AND (p_cidade IS NULL OR COALESCE(mirror.fn_cli_cidade(a.cli_idcliente), a.emp_cidade) = p_cidade)
      GROUP BY TO_CHAR(a.aco_dthconclusao::date, 'YYYY-MM')
    ) sub
  ),
  -- Por dia da semana
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
  -- Por tipo acao
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
  -- Por tipo contato
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
  -- Lista de anos disponiveis
  lista_anos AS (
    SELECT COALESCE(json_agg(sub.ano ORDER BY sub.ano DESC), '[]'::json) AS val
    FROM (
      SELECT DISTINCT TO_CHAR(aco_dthconclusao::date, 'YYYY') AS ano
      FROM filtered
    ) sub
  ),
  -- Heatmap consultor x cidade do CLIENTE (top 50)
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
  -- Clientes mais atendidos — ANO ATUAL fixo (ignora p_from/p_to), top 15.
  clientes_atendidos AS (
    SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json) AS val
    FROM (
      SELECT
        a.cli_nome AS cliente,
        COALESCE(mirror.fn_cli_cidade(a.cli_idcliente), a.emp_cidade) AS cidade,
        COUNT(*) AS acoes,
        COUNT(*) FILTER (WHERE LOWER(COALESCE(a.aco_tipocontato, '')) LIKE '%visita%') AS visitas
      FROM mirror.crm_acoes a
      WHERE a.aco_dthconclusao IS NOT NULL
        AND EXTRACT(YEAR FROM a.aco_dthconclusao) = EXTRACT(YEAR FROM CURRENT_DATE)
        AND a.cli_nome IS NOT NULL AND a.cli_nome <> ''
        AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
        AND (p_tipo_acao IS NULL OR a.aco_tipoacao = p_tipo_acao)
        AND (p_cidade IS NULL OR COALESCE(mirror.fn_cli_cidade(a.cli_idcliente), a.emp_cidade) = p_cidade)
      GROUP BY a.cli_nome, COALESCE(mirror.fn_cli_cidade(a.cli_idcliente), a.emp_cidade)
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

GRANT EXECUTE ON FUNCTION public.rpc_acoes_bi(date, date, text, text, text) TO anon, authenticated, service_role;

-------------------------------------------------------------------------------
-- rpc_acoes_detalhe v2 — identica a v1, exceto pelo LATERAL -> fn_cli_cidade.
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_acoes_detalhe(
  p_from date DEFAULT NULL,
  p_to date DEFAULT NULL,
  p_vendedor text DEFAULT NULL,
  p_tipo_acao text DEFAULT NULL,
  p_cidade text DEFAULT NULL,
  p_limit int DEFAULT 2000,
  p_offset int DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  result json;
  -- teto duro: pior mes observado no historico = 1.240 acoes; 5.000 cobre folga
  -- sem permitir que um cliente peca a tabela inteira de uma vez.
  v_limit int := LEAST(GREATEST(COALESCE(p_limit, 2000), 1), 5000);
  v_offset int := GREATEST(COALESCE(p_offset, 0), 0);
BEGIN
  WITH filtered AS (
    SELECT
      a.aco_idacao,
      a.aco_dthconclusao,
      a.aco_vendedor,
      a.cli_nome,
      -- cidade do CLIENTE com fallback na filial (mesma regra da rpc_acoes_bi)
      COALESCE(mirror.fn_cli_cidade(a.cli_idcliente), a.emp_cidade) AS cidade,
      a.aco_tipoacao,
      a.aco_tipocontato,
      a.aco_atividadeexecutada
    FROM mirror.crm_acoes a
    WHERE (p_from IS NULL OR a.aco_dthconclusao::date >= p_from)
      AND (p_to IS NULL OR a.aco_dthconclusao::date <= p_to)
      AND a.aco_dthconclusao IS NOT NULL
      AND (p_vendedor IS NULL OR a.aco_vendedor = p_vendedor)
      AND (p_tipo_acao IS NULL OR a.aco_tipoacao = p_tipo_acao)
      AND (p_cidade IS NULL OR COALESCE(mirror.fn_cli_cidade(a.cli_idcliente), a.emp_cidade) = p_cidade)
  ),
  paginado AS (
    SELECT
      f.aco_dthconclusao,
      f.aco_idacao,
      json_build_object(
        'data', TO_CHAR(f.aco_dthconclusao::date, 'DD/MM/YYYY'),
        'dataIso', TO_CHAR(f.aco_dthconclusao, 'YYYY-MM-DD"T"HH24:MI:SS'),
        'consultor', f.aco_vendedor,
        'cliente', f.cli_nome,
        'cidade', f.cidade,
        'tipoAcao', f.aco_tipoacao,
        'tipoContato', f.aco_tipocontato,
        'observacao', f.aco_atividadeexecutada
      ) AS row_json
    FROM filtered f
    -- desempate por PK torna a ordenacao TOTAL: sem ele, paginacao por OFFSET
    -- pode repetir ou pular linha entre paginas quando ha empate de data (ha).
    ORDER BY f.aco_dthconclusao DESC, f.aco_idacao DESC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT json_build_object(
    -- ORDER BY explicito no json_agg: ordenacao dentro da CTE nao e garantida
    -- pelo agregado. Repetido aqui para a ordem chegar estavel no cliente.
    'rows', COALESCE(
      (SELECT json_agg(p.row_json ORDER BY p.aco_dthconclusao DESC, p.aco_idacao DESC) FROM paginado p),
      '[]'::json
    ),
    'total', (SELECT COUNT(*) FROM filtered)
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_acoes_detalhe(date, date, text, text, text, int, int) TO anon, authenticated, service_role;
