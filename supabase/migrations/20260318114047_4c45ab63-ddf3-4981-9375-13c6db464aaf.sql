
CREATE TABLE public.registros_comerciais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_cnpj TEXT,
  empresa TEXT,
  cidade_empresa TEXT,
  cliente_nome TEXT,
  cliente_cnpj TEXT,
  cliente_codigo TEXT,
  cidade_cliente TEXT,
  bairro TEXT,
  relacao TEXT,
  status TEXT,
  tipo_contato TEXT,
  tipo_acao TEXT,
  obs_inicial TEXT,
  obs_final TEXT,
  dt_agendamento_ini DATE,
  dt_agendamento_fim DATE,
  dt_conclusao DATE,
  contato TEXT,
  vendedor TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  nro_acao TEXT,
  dt_registro DATE,
  nro_negocio TEXT,
  negocio_valor NUMERIC,
  negocio_funil TEXT,
  negocio_etapa TEXT,
  etiqueta TEXT,
  cod_vendedor TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.registros_comerciais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.registros_comerciais
  FOR SELECT USING (true);
