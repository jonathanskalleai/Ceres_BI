-- Agente analítico v2: memória duradoura por usuário e rastreio completo das tools.
-- Migration aditiva/idempotente. A escrita de memória é restrita à API/role de
-- estado; dados de negócio continuam read-only. Não aplicar sem preflight do
-- banco-alvo e sem validar as tabelas base das migrations de chat.
-- Rollback operacional: desligar YA_AGENT_V2_ENABLED e manter o histórico. Não
-- remover tabelas/colunas automaticamente; qualquer rollback estrutural exige
-- revisão explícita no banco de preview para preservar auditoria e memórias.

BEGIN;

CREATE TABLE IF NOT EXISTS public.ya_user_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_key text NOT NULL CHECK (char_length(memory_key) BETWEEN 1 AND 120),
  category text NOT NULL DEFAULT 'preference'
    CHECK (category IN ('identity', 'preference', 'business_choice', 'context')),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  source_conversation_id uuid REFERENCES public.ya_chat_conversations(id) ON DELETE SET NULL,
  source_message_id uuid REFERENCES public.ya_chat_messages(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'forgotten')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, memory_key)
);

ALTER TABLE public.ya_user_memories
  ADD COLUMN IF NOT EXISTS source_conversation_id uuid,
  ADD COLUMN IF NOT EXISTS source_message_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $foreign_keys$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ya_user_memories'::regclass
      AND conname = 'ya_user_memories_source_conversation_fkey'
  ) THEN
    ALTER TABLE public.ya_user_memories
      ADD CONSTRAINT ya_user_memories_source_conversation_fkey
      FOREIGN KEY (source_conversation_id)
      REFERENCES public.ya_chat_conversations(id)
      ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ya_user_memories'::regclass
      AND conname = 'ya_user_memories_source_message_fkey'
  ) THEN
    ALTER TABLE public.ya_user_memories
      ADD CONSTRAINT ya_user_memories_source_message_fkey
      FOREIGN KEY (source_message_id)
      REFERENCES public.ya_chat_messages(id)
      ON DELETE SET NULL;
  END IF;
END;
$foreign_keys$;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.ya_user_memories'::regclass
      AND conname = 'ya_user_memories_status_check'
  ) THEN
    ALTER TABLE public.ya_user_memories
      ADD CONSTRAINT ya_user_memories_status_check
      CHECK (status IN ('active', 'forgotten'));
  END IF;
END;
$constraints$;

CREATE INDEX IF NOT EXISTS idx_ya_user_memories_user_status_updated
  ON public.ya_user_memories (user_id, status, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_ya_user_memories_user_key
  ON public.ya_user_memories (user_id, memory_key);

ALTER TABLE public.ya_user_memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own Ya memories" ON public.ya_user_memories;
CREATE POLICY "Users read own Ya memories"
  ON public.ya_user_memories
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Não há INSERT/UPDATE/DELETE policy para authenticated: o endpoint privado
-- executa com a role de estado e aplica user_id server-side. O navegador pode
-- listar suas memórias, mas não pode gravar nem alterar diretamente.
REVOKE ALL ON TABLE public.ya_user_memories FROM anon;
GRANT SELECT ON TABLE public.ya_user_memories TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.ya_user_memories TO service_role;

CREATE OR REPLACE FUNCTION public.touch_ya_user_memory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ya_user_memory_touches_updated_at ON public.ya_user_memories;
CREATE TRIGGER ya_user_memory_touches_updated_at
  BEFORE UPDATE ON public.ya_user_memories
  FOR EACH ROW EXECUTE FUNCTION public.touch_ya_user_memory();

REVOKE ALL ON FUNCTION public.touch_ya_user_memory() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_ya_user_memory() TO service_role;

ALTER TABLE public.ya_chat_tool_runs
  ADD COLUMN IF NOT EXISTS tool_call_id text,
  ADD COLUMN IF NOT EXISTS tool_version text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tool_input jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS result_preview jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS presentation jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS error_category text,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE public.ya_chat_messages
  ADD COLUMN IF NOT EXISTS artifacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS choices jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS trace_id text,
  ADD COLUMN IF NOT EXISTS prompt_version text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT '';

ALTER TABLE public.ai_chat_turn_metrics
  ADD COLUMN IF NOT EXISTS trace_id text,
  ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS prompt_version text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS model_rounds integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tool_call_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS input_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS output_tokens integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost numeric,
  ADD COLUMN IF NOT EXISTS memory_context_chars integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS artifact_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failure_category text;

CREATE INDEX IF NOT EXISTS idx_ya_chat_tool_runs_call_id
  ON public.ya_chat_tool_runs (tool_call_id)
  WHERE tool_call_id IS NOT NULL;

COMMENT ON TABLE public.ya_user_memories IS
  'Memórias duradouras e não factuais do assistente, isoladas por usuário.';
COMMENT ON COLUMN public.ya_user_memories.content IS
  'Preferência ou fato declarado pelo usuário; nunca é fonte de número de negócio.';
COMMENT ON COLUMN public.ya_chat_tool_runs.tool_input IS
  'Argumentos sanitizados enviados à ferramenta, sem credenciais.';
COMMENT ON COLUMN public.ya_chat_tool_runs.result_preview IS
  'Resultado sanitizado e limitado usado pela agente no turno.';
COMMENT ON COLUMN public.ya_chat_messages.artifacts IS
  'Artefatos estruturados validados pelo backend, sem HTML ou código do modelo.';
COMMENT ON COLUMN public.ai_chat_turn_metrics.memory_context_chars IS
  'Tamanho do contexto de memória enviado ao modelo; não é o histórico integral.';

COMMIT;
