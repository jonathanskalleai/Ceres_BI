-- Índices para os predicados reais usados pelos RPCs do BI.
--
-- As funções legadas filtram timestamps com `coluna::date`. Um índice btree
-- simples no timestamp não atende esse formato; estes índices de expressão
-- evitam varreduras completas sem alterar a semântica dos contratos atuais.
-- As tabelas são pequenas hoje, mas esses caminhos são executados várias vezes
-- em paralelo no Painel, Comercial e Ações.

CREATE INDEX IF NOT EXISTS idx_crm_acoes_dthconclusao_date
  ON mirror.crm_acoes ((aco_dthconclusao::date))
  INCLUDE (ngo_nronegocio, aco_vendedor, cli_idcliente, emp_cidade, aco_tipocontato)
  WHERE aco_dthconclusao IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_negocios_datafechamento_date
  ON mirror.crm_negocios ((ngo_datafechamento::date))
  INCLUDE (ngo_numero, ngo_conclusao, ngo_funil, ngo_vendedores, cli_idcliente, ngo_vlrtotalnegociado)
  WHERE ngo_datafechamento IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_negocios_dataprevisao_date
  ON mirror.crm_negocios ((ngo_dataprevisao::date))
  INCLUDE (ngo_numero, ngo_conclusao, ngo_funil, ngo_probabilidade, ngo_vlrtotalnegociado)
  WHERE ngo_dataprevisao IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_pedidos_dthpedido_date
  ON mirror.crm_pedidos ((pdo_dthpedido::date))
  INCLUDE (pdo_codigointerno, ngo_numero, pdo_situacaopedido, pdo_vlrpedido)
  WHERE pdo_dthpedido IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_pedidos_dthaprovacao_date_aprovados
  ON mirror.crm_pedidos ((pdo_dthaprovacao::date))
  INCLUDE (pdo_codigointerno, ngo_numero, pdo_vlrpedido)
  WHERE pdo_dthaprovacao IS NOT NULL
    AND pdo_situacaopedido = 'Aprovado';

ANALYZE mirror.crm_acoes;
ANALYZE mirror.crm_negocios;
ANALYZE mirror.crm_pedidos;

COMMENT ON INDEX mirror.idx_crm_acoes_dthconclusao_date IS
  'Acelera RPCs BI que filtram aco_dthconclusao::date por período.';
COMMENT ON INDEX mirror.idx_crm_negocios_datafechamento_date IS
  'Acelera ganhos/perdas por ngo_datafechamento::date.';
COMMENT ON INDEX mirror.idx_crm_negocios_dataprevisao_date IS
  'Acelera carteira e projeção por ngo_dataprevisao::date.';
COMMENT ON INDEX mirror.idx_crm_pedidos_dthpedido_date IS
  'Acelera análises de pedidos por pdo_dthpedido::date.';
COMMENT ON INDEX mirror.idx_crm_pedidos_dthaprovacao_date_aprovados IS
  'Acelera receita conciliada de pedidos aprovados por data.';
