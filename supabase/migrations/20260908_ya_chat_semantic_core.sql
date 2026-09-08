-- Assistente conversacional de dados: estado semântico e evidência auditável.
-- Migration aditiva e idempotente. A API continua sendo o único executor dos
-- contratos privados; nenhum acesso SQL é concedido ao navegador ou ao modelo.

BEGIN;

ALTER TABLE public.ya_chat_conversations
  ADD COLUMN IF NOT EXISTS conversation_state jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.ya_chat_messages
  ADD COLUMN IF NOT EXISTS query_spec jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS evidence jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.ya_chat_tool_runs
  ADD COLUMN IF NOT EXISTS intent text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tool_version text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS query_spec jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS applied_scope jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS metric_definitions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS freshness jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS lineage jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS drilldown_ref text,
  ADD COLUMN IF NOT EXISTS row_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cache_hit boolean NOT NULL DEFAULT false;

ALTER TABLE public.ai_chat_turn_metrics
  ADD COLUMN IF NOT EXISTS intent text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS query_spec jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS requested_filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS applied_filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS freshness jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS tool_names jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS warning_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS row_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS drilldown_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS feedback_type text;

CREATE INDEX IF NOT EXISTS idx_ya_chat_conversations_state_gin
  ON public.ya_chat_conversations USING gin (conversation_state);

CREATE INDEX IF NOT EXISTS idx_ya_chat_messages_query_spec_gin
  ON public.ya_chat_messages USING gin (query_spec);

CREATE INDEX IF NOT EXISTS idx_ya_chat_tool_runs_intent_created
  ON public.ya_chat_tool_runs (intent, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_chat_turn_metrics_intent_created
  ON public.ai_chat_turn_metrics (intent, created_at DESC);

COMMENT ON COLUMN public.ya_chat_conversations.conversation_state IS
  'Estado estruturado da investigação; não é fonte factual sem uma execução de ferramenta.';
COMMENT ON COLUMN public.ya_chat_messages.query_spec IS
  'QuerySpec validado que originou a mensagem; sem credenciais ou SQL.';
COMMENT ON COLUMN public.ya_chat_messages.evidence IS
  'Envelope de evidência das ferramentas executadas no turno.';

COMMIT;
