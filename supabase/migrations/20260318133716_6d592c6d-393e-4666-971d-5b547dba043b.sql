CREATE TABLE public.negocios_mensais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  tipo text,
  recebido numeric,
  emp_nome text,
  unidade text,
  cliente text,
  relacao text,
  cli_tipo_cliente text,
  cli_cnpj_cpf text,
  pdo_nro_pedido text,
  pdo_situacao_pedido text,
  pdo_status text,
  ngo_numero text,
  ngo_funil text,
  ngo_etapa text,
  ngo_conclusao text,
  ngo_motivo_ganho text,
  consultor text,
  valor_pedido numeric,
  pdo_obs_pedido text,
  pdo_aprovador text,
  pdo_dth_aprovacao date,
  pdo_motivo_cancelamento text,
  pdo_frete text,
  pdo_cidade_entrega text,
  pdo_cidade_uf_faturamento text,
  pdo_financiamento_banco text,
  pdo_vlr_recurso_proprio numeric,
  pdo_vlr_financiado numeric,
  pdo_dth_abertura date,
  pdo_dth_registro date,
  ngo_dth_abertura date,
  ngo_atualizacao date,
  cod_consultor text,
  etiqueta text
);

ALTER TABLE public.negocios_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read negocios" ON public.negocios_mensais FOR SELECT TO public USING (true);
CREATE POLICY "Allow service role delete negocios" ON public.negocios_mensais FOR DELETE TO service_role USING (true);
CREATE POLICY "Allow service role insert negocios" ON public.negocios_mensais FOR INSERT TO service_role WITH CHECK (true);