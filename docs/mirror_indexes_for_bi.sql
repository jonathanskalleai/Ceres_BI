-- Indices no schema mirror para acelerar filtros server-side aplicados pelo BI.
-- Os hooks agora empurram dateRange/funil/vendedor/cidade para o Postgres,
-- entao queremos varreduras por indice em vez de seq scans em tabelas grandes.
--
-- Rode UMA VEZ no Postgres do mirror (ceressupabasebi.vouxconsultoria.com.br).
-- E idempotente — pode rodar de novo sem efeito colateral.
--
-- Como aplicar:
--   sshpass -p '<senha>' ssh root@178.238.235.203 \
--     "docker exec -i \$(docker ps -q -f name=supabase_db) \
--      psql -U postgres -d postgres" < docs/mirror_indexes_for_bi.sql

CREATE INDEX IF NOT EXISTS idx_crm_acoes_dth_conclusao
  ON mirror.crm_acoes (aco_dth_conclusao);

CREATE INDEX IF NOT EXISTS idx_crm_acoes_vendedor
  ON mirror.crm_acoes (aco_vendedor);

CREATE INDEX IF NOT EXISTS idx_crm_acoes_emp_cidade
  ON mirror.crm_acoes (emp_cidade);

CREATE INDEX IF NOT EXISTS idx_crm_acoes_cli_nome
  ON mirror.crm_acoes (cli_nome);

CREATE INDEX IF NOT EXISTS idx_crm_negocios_data_fechamento
  ON mirror.crm_negocios (ngo_data_fechamento);

CREATE INDEX IF NOT EXISTS idx_crm_negocios_data_cadastro
  ON mirror.crm_negocios (ngo_data_cadastro);

CREATE INDEX IF NOT EXISTS idx_crm_negocios_funil
  ON mirror.crm_negocios (ngo_funil);

CREATE INDEX IF NOT EXISTS idx_crm_negocios_cli_nome
  ON mirror.crm_negocios (cli_nome);

CREATE INDEX IF NOT EXISTS idx_crm_pedidos_dth_pedido
  ON mirror.crm_pedidos (pdo_dth_pedido);

CREATE INDEX IF NOT EXISTS idx_crm_pedidos_ngo_numero
  ON mirror.crm_pedidos (ngo_numero);

CREATE INDEX IF NOT EXISTS idx_crm_pedidos_situacao
  ON mirror.crm_pedidos (pdo_situacao_pedido);

CREATE INDEX IF NOT EXISTS idx_crm_pedidos_vendedor
  ON mirror.crm_pedidos (pdo_vendedor);

-- Ordens de servico — filtros server-side por data de abertura
CREATE INDEX IF NOT EXISTS idx_ordens_servico_dth_abertura
  ON mirror.ordens_servico (os_dth_abertura);

CREATE INDEX IF NOT EXISTS idx_ordens_servico_dth_encerramento
  ON mirror.ordens_servico (os_dth_encerramento);

CREATE INDEX IF NOT EXISTS idx_ordens_servico_status
  ON mirror.ordens_servico (os_f_status);

ANALYZE mirror.crm_acoes;
ANALYZE mirror.crm_negocios;
ANALYZE mirror.crm_pedidos;
ANALYZE mirror.ordens_servico;
