-- Narrativa semanal de sinais de campo. A classificação por texto continua
-- estruturada nas tabelas existentes; este JSON guarda apenas a leitura
-- consolidada da IA para a linha totalizadora de cada semana.

ALTER TABLE public.ai_sentimento_semanal
  ADD COLUMN IF NOT EXISTS analise_ia jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.ai_sentimento_semanal.analise_ia IS
  'Análise narrativa semanal de sentimento, demanda, objeções e próximos passos. Preenchida somente para consultor __TOTAL__.';
