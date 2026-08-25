BEGIN;

ALTER TABLE public.ya_chat_conversations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'closed')),
  ADD COLUMN IF NOT EXISTS summary text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS summary_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ya_chat_conversations_user_status_updated
  ON public.ya_chat_conversations (user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_chat_turn_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ya_chat_conversations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.ya_chat_messages(id) ON DELETE CASCADE,
  route text NOT NULL DEFAULT '',
  db_ms integer NOT NULL DEFAULT 0 CHECK (db_ms >= 0),
  model_ms integer NOT NULL DEFAULT 0 CHECK (model_ms >= 0),
  total_ms integer NOT NULL DEFAULT 0 CHECK (total_ms >= 0),
  cache_hits integer NOT NULL DEFAULT 0 CHECK (cache_hits >= 0),
  source_count integer NOT NULL DEFAULT 0 CHECK (source_count >= 0),
  answer_chars integer NOT NULL DEFAULT 0 CHECK (answer_chars >= 0),
  status text NOT NULL CHECK (status IN ('completed', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_chat_turn_metrics_conversation_created
  ON public.ai_chat_turn_metrics (conversation_id, created_at DESC);

ALTER TABLE public.ai_chat_turn_metrics ENABLE ROW LEVEL SECURITY;

COMMIT;
