CREATE TABLE IF NOT EXISTS public.ai_weekly_insights (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL CHECK (tipo IN ('equipe', 'individual')),
  consultor text,
  semana_inicio date NOT NULL,
  semana_fim date NOT NULL,
  dados jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ai_insights_tipo_semana ON public.ai_weekly_insights(tipo, semana_inicio DESC);
CREATE INDEX idx_ai_insights_consultor ON public.ai_weekly_insights(consultor, semana_inicio DESC);

ALTER TABLE public.ai_weekly_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated_read" ON public.ai_weekly_insights FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_all" ON public.ai_weekly_insights FOR ALL TO service_role USING (true);
