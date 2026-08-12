-------------------------------------------------------------------------------
-- Acelera as consultas de negocio que localizam o pedido pelo numero do
-- negocio, especialmente rpc_negocios_crm (serie anual do painel comercial).
--
-- Sem este indice, o LEFT JOIN LATERAL da RPC fazia uma varredura inteira de
-- crm_pedidos para cada negocio da serie. O indice nao altera dados nem a
-- selecao do pedido; apenas viabiliza a busca direta pela chave de relacao.
-------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_crm_pedidos_ngo_numero
  ON mirror.crm_pedidos (ngo_numero);
