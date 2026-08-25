-- Ya conversacional: conversas auditáveis, acesso explícito e uma visão Cliente 360.
-- A API da Ya executa esta função internamente; o frontend não recebe acesso direto.

BEGIN;

INSERT INTO public.app_modules (id, label, group_id, group_label, sort_order, icon_name)
VALUES ('bi.ya', 'Ya', 'bi', 'BI ANALYTICS', 11, 'MessageSquareText')
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  group_id = EXCLUDED.group_id,
  group_label = EXCLUDED.group_label,
  icon_name = EXCLUDED.icon_name;

-- Quem já tem acesso a algum módulo de BI passa a ter a Ya, sem criar uma
-- permissão implícita para usuários que não acessam o BI.
INSERT INTO public.user_permissions (user_id, module_id, is_visible, granted_by)
SELECT DISTINCT up.user_id, 'bi.ya', true, NULL::uuid
FROM public.user_permissions up
JOIN public.app_modules module ON module.id = up.module_id
WHERE module.group_id = 'bi'
  AND up.module_id <> 'bi.ya'
ON CONFLICT (user_id, module_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.ya_chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  last_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ya_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ya_chat_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 8000),
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ya_chat_tool_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ya_chat_conversations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL REFERENCES public.ya_chat_messages(id) ON DELETE CASCADE,
  tool_name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  elapsed_ms integer NOT NULL CHECK (elapsed_ms >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ya_chat_conversations_user_updated
  ON public.ya_chat_conversations (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ya_chat_messages_conversation_created
  ON public.ya_chat_messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ya_chat_tool_runs_conversation_created
  ON public.ya_chat_tool_runs (conversation_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_ya_chat_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ya_chat_conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ya_chat_message_touches_conversation ON public.ya_chat_messages;
CREATE TRIGGER ya_chat_message_touches_conversation
  AFTER INSERT ON public.ya_chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_ya_chat_conversation();

ALTER TABLE public.ya_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ya_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ya_chat_tool_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own Ya conversations" ON public.ya_chat_conversations;
CREATE POLICY "Users manage own Ya conversations"
  ON public.ya_chat_conversations
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users read own Ya messages" ON public.ya_chat_messages;
CREATE POLICY "Users read own Ya messages"
  ON public.ya_chat_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ya_chat_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users read own Ya tool runs" ON public.ya_chat_tool_runs;
CREATE POLICY "Users read own Ya tool runs"
  ON public.ya_chat_tool_runs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ya_chat_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.rpc_ya_cliente_360(
  p_cliente_nome text,
  p_from date,
  p_to date
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, mirror
AS $$
  WITH params AS (
    SELECT
      COALESCE(p_from, date_trunc('month', CURRENT_DATE)::date) AS date_from,
      COALESCE(p_to, CURRENT_DATE) AS date_to
  ),
  clientes AS (
    SELECT DISTINCT ON (c.cli_idcliente)
      c.cli_idcliente,
      c.cli_nome,
      c.cli_cidade,
      c.cli_uf,
      c.usr_nomeusuario AS consultor
    FROM mirror.crm_carteira_clientes c
    WHERE c.cli_idcliente IS NOT NULL
      AND c.cli_nome ILIKE '%' || BTRIM(COALESCE(p_cliente_nome, '')) || '%'
    ORDER BY c.cli_idcliente, c.cli_dataatualizacao DESC NULLS LAST, c.dthregistro DESC NULLS LAST
    LIMIT 5
  ),
  acoes AS (
    SELECT
      a.cli_idcliente,
      COUNT(*)::integer AS total_acoes,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(a.aco_tipocontato, '')) LIKE '%visita%')::integer AS visitas,
      MAX(a.aco_dthconclusao)::date AS ultima_acao
    FROM mirror.crm_acoes a
    CROSS JOIN params p
    WHERE a.cli_idcliente IN (SELECT cli_idcliente FROM clientes)
      AND a.aco_dthconclusao::date BETWEEN p.date_from AND p.date_to
    GROUP BY a.cli_idcliente
  ),
  negocios_canonicos AS (
    SELECT DISTINCT ON (n.ngo_numero)
      n.ngo_numero,
      n.cli_idcliente,
      n.ngo_conclusao,
      n.ngo_vlrtotalnegociado,
      n.ngo_datafechamento
    FROM mirror.crm_negocios n
    WHERE n.cli_idcliente IN (SELECT cli_idcliente FROM clientes)
    ORDER BY n.ngo_numero, n.ngo_dataatualizacao DESC NULLS LAST, n.dthregistro DESC NULLS LAST
  ),
  negocios AS (
    SELECT
      n.cli_idcliente,
      COUNT(*) FILTER (WHERE n.ngo_conclusao = 'Ganho' AND n.ngo_datafechamento::date BETWEEN p.date_from AND p.date_to)::integer AS ganhos,
      COALESCE(SUM(n.ngo_vlrtotalnegociado) FILTER (WHERE n.ngo_conclusao = 'Ganho' AND n.ngo_datafechamento::date BETWEEN p.date_from AND p.date_to), 0)::numeric AS valor_ganho,
      COUNT(*) FILTER (WHERE n.ngo_conclusao = 'Perdido' AND n.ngo_datafechamento::date BETWEEN p.date_from AND p.date_to)::integer AS perdidos,
      COALESCE(SUM(n.ngo_vlrtotalnegociado) FILTER (WHERE n.ngo_conclusao = 'Perdido' AND n.ngo_datafechamento::date BETWEEN p.date_from AND p.date_to), 0)::numeric AS valor_perdido,
      COUNT(*) FILTER (WHERE n.ngo_conclusao = 'Em Andamento')::integer AS abertos,
      COALESCE(SUM(n.ngo_vlrtotalnegociado) FILTER (WHERE n.ngo_conclusao = 'Em Andamento'), 0)::numeric AS pipeline_aberto
    FROM negocios_canonicos n
    CROSS JOIN params p
    GROUP BY n.cli_idcliente
  ),
  pedidos AS (
    SELECT
      pedido.cli_idcliente,
      COUNT(DISTINCT pedido.pdo_codigointerno) FILTER (WHERE LOWER(COALESCE(pedido.pdo_situacaopedido, '')) LIKE '%aprovado%')::integer AS pedidos_aprovados,
      COALESCE(SUM(pedido.pdo_vlrpedido) FILTER (WHERE LOWER(COALESCE(pedido.pdo_situacaopedido, '')) LIKE '%aprovado%'), 0)::numeric AS faturamento
    FROM mirror.crm_pedidos pedido
    CROSS JOIN params p
    WHERE pedido.cli_idcliente IN (SELECT cli_idcliente FROM clientes)
      AND COALESCE(pedido.pdo_dthaprovacao, pedido.pdo_dthpedido)::date BETWEEN p.date_from AND p.date_to
    GROUP BY pedido.cli_idcliente
  ),
  parque AS (
    SELECT
      maq.cli_idcliente,
      COALESCE(SUM(COALESCE(NULLIF(maq.pqm_qtdmaquinas, 0), 1)), 0)::numeric AS maquinas,
      COUNT(DISTINCT NULLIF(BTRIM(maq.pqm_marca), ''))::integer AS marcas,
      MIN(NULLIF(BTRIM(maq.pqm_ano), '')) AS ano_mais_antigo
    FROM mirror.cliente_parque_maquinas maq
    WHERE maq.cli_idcliente IN (SELECT cli_idcliente FROM clientes)
    GROUP BY maq.cli_idcliente
  ),
  servicos AS (
    SELECT
      os.os_idcliente AS cli_idcliente,
      COUNT(*)::integer AS total_os,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(os.os_fstatus, '')) LIKE '%abert%')::integer AS os_abertas,
      COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (os.os_dthencerramento - os.os_dthabertura)) / 86400.0)
        FILTER (WHERE os.os_dthencerramento IS NOT NULL)::numeric, 1), 0) AS dias_medio_resolucao
    FROM mirror.ordens_servico os
    CROSS JOIN params p
    WHERE os.os_idcliente IN (SELECT cli_idcliente FROM clientes)
      AND os.os_dthabertura::date BETWEEN p.date_from AND p.date_to
    GROUP BY os.os_idcliente
  )
  SELECT jsonb_build_object(
    'periodo', jsonb_build_object('from', (SELECT date_from FROM params), 'to', (SELECT date_to FROM params)),
    'clientes', COALESCE(jsonb_agg(
      jsonb_build_object(
        'clienteId', c.cli_idcliente,
        'cliente', c.cli_nome,
        'cidade', c.cli_cidade,
        'uf', c.cli_uf,
        'consultor', c.consultor,
        'acoes', jsonb_build_object('total', COALESCE(a.total_acoes, 0), 'visitas', COALESCE(a.visitas, 0), 'ultimaAcao', a.ultima_acao),
        'negocios', jsonb_build_object('ganhos', COALESCE(n.ganhos, 0), 'valorGanho', COALESCE(n.valor_ganho, 0), 'perdidos', COALESCE(n.perdidos, 0), 'valorPerdido', COALESCE(n.valor_perdido, 0), 'abertos', COALESCE(n.abertos, 0), 'pipelineAberto', COALESCE(n.pipeline_aberto, 0)),
        'pedidos', jsonb_build_object('aprovados', COALESCE(pe.pedidos_aprovados, 0), 'faturamento', COALESCE(pe.faturamento, 0)),
        'parque', jsonb_build_object('maquinas', COALESCE(pa.maquinas, 0), 'marcas', COALESCE(pa.marcas, 0), 'anoMaisAntigo', pa.ano_mais_antigo),
        'servicos', jsonb_build_object('totalOS', COALESCE(s.total_os, 0), 'abertas', COALESCE(s.os_abertas, 0), 'diasMedioResolucao', COALESCE(s.dias_medio_resolucao, 0))
      )
      ORDER BY c.cli_nome
    ), '[]'::jsonb)
  )
  FROM clientes c
  LEFT JOIN acoes a ON a.cli_idcliente = c.cli_idcliente
  LEFT JOIN negocios n ON n.cli_idcliente = c.cli_idcliente
  LEFT JOIN pedidos pe ON pe.cli_idcliente = c.cli_idcliente
  LEFT JOIN parque pa ON pa.cli_idcliente = c.cli_idcliente
  LEFT JOIN servicos s ON s.cli_idcliente = c.cli_idcliente;
$$;

COMMENT ON FUNCTION public.rpc_ya_cliente_360(text, date, date) IS
  'Ya: visão agregada de cliente por chaves oficiais, sem documentos de contato ou texto livre.';

REVOKE ALL ON FUNCTION public.rpc_ya_cliente_360(text, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_ya_cliente_360(text, date, date) TO service_role;

-- Migrations recentes recriaram algumas RPCs SECURITY DEFINER com o grant
-- implícito de PUBLIC. Elas são usadas pelo BI autenticado, nunca pelo anon.
REVOKE EXECUTE ON FUNCTION public.rpc_desempenho_vendas_bi(date, date, integer, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_desempenho_vendas_bi(date, date, integer, text, text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_negocios_bi_expandido(date, date, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rpc_clientes_criticos_bi(text, text, integer, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.rpc_desempenho_vendas_bi(date, date, integer, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_desempenho_vendas_bi(date, date, integer, text, text, text, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_negocios_bi_expandido(date, date, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_clientes_criticos_bi(text, text, integer, integer) TO authenticated, service_role;

COMMIT;
