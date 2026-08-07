-------------------------------------------------------------------------------
-- rpc_acoes_detalhe — tabela "Acoes do Periodo" da tela /bi/acoes
--
-- Extraida de `rpc_acoes_bi` v3 (chave `tabelaAcoes`, removida na v4) para RPC
-- propria e PAGINADA. Motivo: rpc_acoes_bi roda 4x no app (2x para o comparativo
-- de trend em AcoesSection + 2x em usePainelKPIsRpc, que le SOMENTE `kpis`) —
-- manter ~660 linhas com observacao de ~208 chars no payload monolitico fazia
-- esse peso viajar 4 vezes, 2 delas para uma tela que nem renderiza tabela.
--
-- DIFERENCAS EM RELACAO AO `tabelaAcoes` DA v3
--
-- 1) `observacao` = `aco_atividadeexecutada` (o que FOI executado).
--    Confirmado no banco vivo: 100% preenchida no mes atual, media 208 chars,
--    max 878. NAO existe coluna `aco_observacao`. NAO confundir com
--    `aco_atividadeaserexecutada`, que e o PLANEJADO, nao o executado.
--
-- 2) FAN-OUT CORRIGIDO. A v3 fazia
--      LEFT JOIN mirror.crm_carteira_clientes c ON f.cli_idcliente = c.cli_idcliente
--    e a PK dessa tabela e (cli_idcliente, usr_idusuario): o mesmo cliente
--    aparece uma vez POR VENDEDOR, entao o JOIN MULTIPLICA as linhas. Medido no
--    banco vivo (julho/2026): 664 acoes viravam 1.472 linhas (2,22x). O LIMIT 50
--    da v3 mascarava o defeito — sem esta correcao, tirar o limite mostraria
--    cada acao repetida e a tabela divergiria do KPI totalAcoes.
--    Correcao: LEFT JOIN LATERAL (... LIMIT 1) ON TRUE.
--
-- 3) `total` = COUNT REAL do periodo (sem limit), para a UI dizer "100 de 664"
--    em vez de mentir por omissao quando a pagina trunca.
--
-- 4) ORDER BY (aco_dthconclusao DESC, aco_idacao DESC): o desempate por PK torna
--    a ordenacao TOTAL. Sem ele, paginacao por OFFSET pode repetir ou pular linha
--    entre paginas quando ha empate de data (ha: varias acoes por dia).
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
      -- cidade do CLIENTE com fallback na filial (mesma regra da rpc_acoes_bi v4)
      COALESCE(cc.cli_cidade, a.emp_cidade) AS cidade,
      a.aco_tipoacao,
      a.aco_tipocontato,
      a.aco_atividadeexecutada
    FROM mirror.crm_acoes a
    -- LATERAL + LIMIT 1: 1 linha de carteira por acao (anti fan-out, vide cabecalho)
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
