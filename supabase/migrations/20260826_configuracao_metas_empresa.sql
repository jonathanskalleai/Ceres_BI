-- Configuração anual da meta comercial:
--   1. meta anual da empresa;
--   2. curva mensal da empresa (soma obrigatória de 100%);
--   3. meta anual manual de cada consultor;
--   4. metas mensais derivadas, usadas pelo relatório de desempenho.

CREATE TABLE IF NOT EXISTS public.metas_comerciais_mensais (
  ano integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  percentual numeric(7,4) NOT NULL CHECK (percentual >= 0 AND percentual <= 100),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT metas_comerciais_mensais_unica UNIQUE (ano, mes)
);

CREATE TABLE IF NOT EXISTS public.metas_consultor_anual (
  ano integer NOT NULL,
  consultor text NOT NULL,
  meta_anual numeric(15,2) NOT NULL CHECK (meta_anual >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT metas_consultor_anual_unica UNIQUE (ano, consultor)
);

COMMENT ON TABLE public.metas_comerciais_mensais IS
  'Curva mensal da meta anual da empresa. Os doze percentuais devem somar 100%.';
COMMENT ON TABLE public.metas_consultor_anual IS
  'Meta anual manual atribuída a cada consultor.';

ALTER TABLE public.metas_comerciais_mensais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metas_consultor_anual ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "metas_comerciais_mensais_select_authenticated" ON public.metas_comerciais_mensais;
CREATE POLICY "metas_comerciais_mensais_select_authenticated"
  ON public.metas_comerciais_mensais FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "metas_consultor_anual_select_authenticated" ON public.metas_consultor_anual;
CREATE POLICY "metas_consultor_anual_select_authenticated"
  ON public.metas_consultor_anual FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.metas_comerciais_mensais TO authenticated;
GRANT SELECT ON public.metas_consultor_anual TO authenticated;
GRANT ALL ON public.metas_comerciais_mensais TO service_role;
GRANT ALL ON public.metas_consultor_anual TO service_role;

-- Corrige a semente antiga que foi criada com R$ 30 milhões.
UPDATE public.metas_comerciais
SET meta_anual = 33000000.00, updated_at = now()
WHERE ano = 2026 AND meta_anual = 30000000.00;

INSERT INTO public.metas_comerciais (ano, meta_anual)
VALUES (2026, 33000000.00)
ON CONFLICT (ano) DO NOTHING;

INSERT INTO public.metas_comerciais_mensais (ano, mes, percentual)
SELECT 2026, mes, percentual
FROM (VALUES
  (1, 10.0), (2, 14.0), (3, 14.0), (4, 15.0), (5, 12.0),
  (6, 5.0), (7, 5.0), (8, 5.0), (9, 5.0), (10, 5.0),
  (11, 5.0), (12, 5.0)
) AS curva(mes, percentual)
ON CONFLICT (ano, mes) DO NOTHING;

CREATE OR REPLACE FUNCTION public.rpc_salvar_configuracao_metas(
  p_ano integer,
  p_meta_anual numeric,
  p_curva_mensal jsonb,
  p_consultores jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  soma_percentuais numeric;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Apenas administradores podem configurar metas';
  END IF;

  IF p_ano < 2020 OR p_ano > 2099 THEN
    RAISE EXCEPTION 'Ano inválido';
  END IF;
  IF p_meta_anual <= 0 THEN
    RAISE EXCEPTION 'A meta anual deve ser maior que zero';
  END IF;
  IF jsonb_typeof(p_curva_mensal) <> 'array'
     OR jsonb_array_length(p_curva_mensal) <> 12 THEN
    RAISE EXCEPTION 'Informe os percentuais dos 12 meses';
  END IF;
  IF jsonb_typeof(p_consultores) <> 'array' THEN
    RAISE EXCEPTION 'A lista de consultores é inválida';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_curva_mensal) AS c(mes integer, percentual numeric)
    WHERE c.mes IS NULL OR c.mes < 1 OR c.mes > 12
      OR c.percentual IS NULL OR c.percentual < 0
  ) OR (
    SELECT COUNT(DISTINCT c.mes)
    FROM jsonb_to_recordset(p_curva_mensal) AS c(mes integer, percentual numeric)
  ) <> 12 THEN
    RAISE EXCEPTION 'A curva mensal deve conter cada mês uma única vez';
  END IF;

  SELECT COALESCE(SUM(c.percentual), 0)
  INTO soma_percentuais
  FROM jsonb_to_recordset(p_curva_mensal) AS c(mes integer, percentual numeric);

  IF ABS(soma_percentuais - 100) > 0.01 THEN
    RAISE EXCEPTION 'A soma dos percentuais mensais deve ser 100%% (atual: %)', soma_percentuais;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(p_consultores) AS c(consultor text, meta_anual numeric)
    WHERE NULLIF(BTRIM(c.consultor), '') IS NULL
      OR c.meta_anual IS NULL OR c.meta_anual < 0
  ) THEN
    RAISE EXCEPTION 'Há consultor ou meta anual inválida';
  END IF;

  INSERT INTO public.metas_comerciais (ano, meta_anual, updated_at)
  VALUES (p_ano, p_meta_anual, now())
  ON CONFLICT (ano) DO UPDATE
    SET meta_anual = EXCLUDED.meta_anual, updated_at = now();

  DELETE FROM public.metas_comerciais_mensais WHERE ano = p_ano;
  INSERT INTO public.metas_comerciais_mensais (ano, mes, percentual)
  SELECT p_ano, c.mes, c.percentual
  FROM jsonb_to_recordset(p_curva_mensal) AS c(mes integer, percentual numeric);

  DELETE FROM public.metas_consultor_anual WHERE ano = p_ano;
  INSERT INTO public.metas_consultor_anual (ano, consultor, meta_anual)
  SELECT p_ano, BTRIM(c.consultor), c.meta_anual
  FROM jsonb_to_recordset(p_consultores) AS c(consultor text, meta_anual numeric);

  -- O relatório existente lê a granularidade consultor x mês. Ela é derivada
  -- automaticamente dos dois cadastros acima e não precisa mais ser editada.
  DELETE FROM public.metas_consultor_mensal
  WHERE competencia >= make_date(p_ano, 1, 1)
    AND competencia < make_date(p_ano + 1, 1, 1);

  INSERT INTO public.metas_consultor_mensal (consultor, competencia, meta)
  SELECT
    c.consultor,
    make_date(p_ano, curva.mes, 1),
    ROUND(c.meta_anual * curva.percentual / 100.0, 2)
  FROM public.metas_consultor_anual c
  CROSS JOIN public.metas_comerciais_mensais curva
  WHERE c.ano = p_ano AND curva.ano = p_ano;

  RETURN jsonb_build_object(
    'ano', p_ano,
    'meta_anual', p_meta_anual,
    'percentual_total', soma_percentuais,
    'total_consultores', (SELECT COALESCE(SUM(meta_anual), 0) FROM public.metas_consultor_anual WHERE ano = p_ano),
    'quantidade_consultores', (SELECT COUNT(*) FROM public.metas_consultor_anual WHERE ano = p_ano)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_salvar_configuracao_metas(integer, numeric, jsonb, jsonb)
  TO authenticated;
