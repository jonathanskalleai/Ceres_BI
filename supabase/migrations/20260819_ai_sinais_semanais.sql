-- Sinais de campo estruturados: sentimento e produtos extraídos de descrições
-- de ações concluídas e de observações/motivos de negócios. Estas tabelas
-- complementam ai_weekly_insights, que continua guardando o resumo narrativo.

CREATE TABLE IF NOT EXISTS public.ai_text_classifications (
  source_kind text NOT NULL CHECK (source_kind IN ('acao', 'negocio')),
  source_id text NOT NULL,
  source_text_hash text NOT NULL,
  event_date date NOT NULL,
  consultor text NOT NULL DEFAULT 'SEM CONSULTOR',
  sentimento text NOT NULL CHECK (sentimento IN ('positivo', 'negativo', 'neutro')),
  palavras_chave jsonb NOT NULL DEFAULT '[]'::jsonb,
  produtos jsonb NOT NULL DEFAULT '[]'::jsonb,
  confianca numeric(4,3) NOT NULL DEFAULT 0.5 CHECK (confianca BETWEEN 0 AND 1),
  model_version text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_kind, source_id, model_version)
);

CREATE INDEX IF NOT EXISTS idx_ai_text_classifications_periodo
  ON public.ai_text_classifications (model_version, event_date, consultor);

CREATE TABLE IF NOT EXISTS public.ai_sentimento_semanal (
  semana_inicio date NOT NULL,
  -- __TOTAL__ é a linha agregada da empresa; as demais linhas são por consultor.
  consultor text NOT NULL,
  total_textos integer NOT NULL DEFAULT 0 CHECK (total_textos >= 0),
  positivos integer NOT NULL DEFAULT 0 CHECK (positivos >= 0),
  negativos integer NOT NULL DEFAULT 0 CHECK (negativos >= 0),
  neutros integer NOT NULL DEFAULT 0 CHECK (neutros >= 0),
  score numeric(6,2) NOT NULL DEFAULT 0,
  top_termos jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (semana_inicio, consultor),
  CHECK (total_textos = positivos + negativos + neutros)
);

CREATE INDEX IF NOT EXISTS idx_ai_sentimento_semanal_consultor
  ON public.ai_sentimento_semanal (consultor, semana_inicio DESC);

CREATE TABLE IF NOT EXISTS public.ai_produtos_interesse_semanal (
  semana_inicio date NOT NULL,
  -- __TOTAL__ é a linha agregada da empresa; as demais linhas são por consultor.
  consultor text NOT NULL,
  produto text NOT NULL,
  mencoes integer NOT NULL CHECK (mencoes > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (semana_inicio, consultor, produto)
);

CREATE INDEX IF NOT EXISTS idx_ai_produtos_interesse_semana
  ON public.ai_produtos_interesse_semanal (semana_inicio DESC, consultor, mencoes DESC);

-- A rotina anterior inseria a mesma semana repetidamente. Mantemos o dado mais
-- recente de cada chave lógica antes de impor unicidade para que o UPSERT seja
-- seguro em reexecuções do agendamento.
DELETE FROM public.ai_weekly_insights target
USING (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY tipo, COALESCE(consultor, ''), semana_inicio
           ORDER BY created_at DESC NULLS LAST, id DESC
         ) AS row_number
  FROM public.ai_weekly_insights
) duplicate
WHERE target.id = duplicate.id
  AND duplicate.row_number > 1;

DROP INDEX IF EXISTS public.ux_ai_weekly_insights_equipe_semana;
DROP INDEX IF EXISTS public.ux_ai_weekly_insights_individual_semana;
ALTER TABLE public.ai_weekly_insights
  DROP CONSTRAINT IF EXISTS uq_ai_weekly_insights_tipo_consultor_semana;
ALTER TABLE public.ai_weekly_insights
  ADD CONSTRAINT uq_ai_weekly_insights_tipo_consultor_semana
  UNIQUE NULLS NOT DISTINCT (tipo, consultor, semana_inicio);

ALTER TABLE public.ai_text_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_sentimento_semanal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_produtos_interesse_semanal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_all_ai_text_classifications" ON public.ai_text_classifications;
CREATE POLICY "service_all_ai_text_classifications"
  ON public.ai_text_classifications FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_ai_sentimento_semanal" ON public.ai_sentimento_semanal;
CREATE POLICY "authenticated_read_ai_sentimento_semanal"
  ON public.ai_sentimento_semanal FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "service_all_ai_sentimento_semanal" ON public.ai_sentimento_semanal;
CREATE POLICY "service_all_ai_sentimento_semanal"
  ON public.ai_sentimento_semanal FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_ai_produtos_interesse_semanal" ON public.ai_produtos_interesse_semanal;
CREATE POLICY "authenticated_read_ai_produtos_interesse_semanal"
  ON public.ai_produtos_interesse_semanal FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "service_all_ai_produtos_interesse_semanal" ON public.ai_produtos_interesse_semanal;
CREATE POLICY "service_all_ai_produtos_interesse_semanal"
  ON public.ai_produtos_interesse_semanal FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON TABLE public.ai_text_classifications FROM PUBLIC;
REVOKE ALL ON TABLE public.ai_sentimento_semanal FROM PUBLIC;
REVOKE ALL ON TABLE public.ai_produtos_interesse_semanal FROM PUBLIC;
GRANT ALL ON TABLE public.ai_text_classifications TO service_role;
GRANT SELECT ON TABLE public.ai_sentimento_semanal TO authenticated, service_role;
GRANT SELECT ON TABLE public.ai_produtos_interesse_semanal TO authenticated, service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.ai_sentimento_semanal TO service_role;
GRANT INSERT, UPDATE, DELETE ON TABLE public.ai_produtos_interesse_semanal TO service_role;
