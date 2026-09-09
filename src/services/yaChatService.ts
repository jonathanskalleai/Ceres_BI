import { fetchAI } from "@/lib/fetchAI";

export interface YaChatFilters {
  from?: string;
  to?: string;
  categoria?: string;
  funil?: string;
  funis?: string[];
  vendedor?: string;
  cidade?: string;
  produto?: string;
  condicao?: string;
  origem?: string;
  banco?: string;
  motivoPerda?: string;
  cliente?: string;
  status?: string;
}

export interface YaChatRequest {
  message: string;
  conversation_id?: string;
  context: {
    route: string;
    filters: YaChatFilters;
  };
}

export interface YaChatSource {
  id: string;
  label: string;
  filters: YaChatFilters & { cliente?: string };
  requested_filters?: YaChatFilters;
  refreshed_at?: string;
  intent?: string;
  metric_definitions?: YaMetricDefinition[];
  applied_scope?: YaAppliedScope;
  freshness?: YaFreshness;
  lineage?: Record<string, unknown>;
  warnings?: string[];
  drilldown_ref?: string;
  execution_metrics?: YaExecutionMetrics;
  preview?: unknown;
}

export interface YaMetricDefinition {
  id: string;
  label: string;
  domain: string;
  definition: string;
  unit: string;
  entity: string;
  grain: string;
  competence: string;
  deduplication: string;
  executor?: string;
  dimensions: string[];
  filters: string[];
  dimension_paths?: Record<string, string[]>;
  status: string;
  drilldown?: string;
  exclusions?: string;
}

export interface YaAppliedScope {
  period?: { from: string; to: string };
  snapshot?: boolean;
  filters?: YaChatFilters;
  filter_origins?: Record<string, string>;
  timezone?: string;
  comparacao?: { atual?: { from?: string; to?: string }; base?: { from?: string; to?: string } };
}

export interface YaFreshness {
  refreshed_at?: string | null;
  status?: string;
  [key: string]: unknown;
}

export interface YaExecutionMetrics {
  elapsed_ms?: number;
  row_count?: number;
  cache_hit?: boolean;
  period_label?: string;
  comparison?: unknown;
  [key: string]: unknown;
}

export interface YaArtifactColumn {
  key: string;
  label: string;
}

export interface YaArtifact {
  type: "table" | "bar" | "line" | "kpi_group" | "choices";
  title: string;
  columns?: YaArtifactColumn[];
  rows?: Record<string, unknown>[];
  x_key?: string | null;
  series?: { key: string; label: string }[];
  source_ids?: string[];
}

export interface YaChoice {
  label: string;
  value: string;
}

export interface YaUserMemory {
  key: string;
  category: string;
  content: string;
}

export interface YaChatResponse {
  conversation_id: string;
  assistant_message_id: string;
  answer: string;
  sources: YaChatSource[];
  evidence: YaChatSource[];
  query_spec: Record<string, unknown>;
  artifacts?: YaArtifact[];
  choices?: YaChoice[];
  stats?: Record<string, unknown>;
  generated_at: string;
}

export interface AIConversationPreview {
  id: string;
  title: string;
  status: "active" | "closed";
  updated_at: string;
  last_message_at?: string;
}

export interface AIConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: YaChatSource[];
  evidence: YaChatSource[];
  query_spec: Record<string, unknown>;
  artifacts?: YaArtifact[];
  choices?: YaChoice[];
  created_at: string;
}

export interface AIConversationDetail {
  id: string;
  title: string;
  status: "active" | "closed";
  summary: string;
  conversation_state: Record<string, unknown>;
  updated_at: string;
  messages: AIConversationMessage[];
}

export interface AIChatStreamHandlers {
  onStatus?: (message: string) => void;
  onThread?: (conversationId: string) => void;
  onPlan?: (querySpec: Record<string, unknown>) => void;
  onSources?: (sources: YaChatSource[], metrics: { dbMs: number; cacheHits: number }) => void;
  onDelta?: (text: string) => void;
  onToolStart?: (payload: { label: string; position: number }) => void;
  onToolResult?: (payload: { label: string; status: string; source?: YaChatSource; artifacts: YaArtifact[]; warnings: string[] }) => void;
  onDone?: (payload: {
    conversationId: string;
    assistantMessageId: string;
    sources: YaChatSource[];
    evidence: YaChatSource[];
    querySpec: Record<string, unknown>;
    answer: string;
    artifacts: YaArtifact[];
    choices: YaChoice[];
    generatedAt: string;
  }) => void;
}

export type YaFeedbackType = "useful" | "incorrect_number" | "insufficient_source";

export async function sendYaChat(request: YaChatRequest): Promise<YaChatResponse> {
  const v2Enabled = import.meta.env.VITE_YA_AGENT_V2_ENABLED === "true";
  const response = await fetchAI(v2Enabled ? "/api/ai/v2/chat" : "/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string; error?: string } | null;
    throw new Error(body?.detail ?? body?.error ?? "Não foi possível conversar com a AI agora.");
  }
  return response.json() as Promise<YaChatResponse>;
}

export async function listAIConversations(): Promise<AIConversationPreview[]> {
  const response = await fetchAI("/api/ai/conversations");
  if (!response.ok) throw new Error("Não foi possível carregar as conversas.");
  return response.json() as Promise<AIConversationPreview[]>;
}

export async function getAIConversation(conversationId: string): Promise<AIConversationDetail> {
  const response = await fetchAI(`/api/ai/conversations/${conversationId}`);
  if (!response.ok) throw new Error("Não foi possível carregar esta conversa.");
  return response.json() as Promise<AIConversationDetail>;
}

export async function closeAIConversation(conversationId: string): Promise<void> {
  const response = await fetchAI(`/api/ai/conversations/${conversationId}/close`, { method: "POST" });
  if (!response.ok) throw new Error("Não foi possível encerrar esta conversa.");
}

export async function sendAIMessageFeedback(conversationId: string, messageId: string, feedbackType: YaFeedbackType): Promise<void> {
  const response = await fetchAI(`/api/ai/conversations/${conversationId}/messages/${messageId}/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feedback_type: feedbackType }),
  });
  if (!response.ok) throw new Error("Não foi possível registrar o feedback.");
}

export async function listAIUserMemories(): Promise<YaUserMemory[]> {
  const response = await fetchAI("/api/ai/v2/memories");
  if (!response.ok) throw new Error("Não foi possível carregar as memórias.");
  return response.json() as Promise<YaUserMemory[]>;
}

export async function forgetAIUserMemory(key: string): Promise<void> {
  const response = await fetchAI(`/api/ai/v2/memories/${encodeURIComponent(key)}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Não foi possível esquecer essa memória.");
}

export function readEvent(block: string): { event: string; data: unknown } | null {
  const event = block.match(/^event:\s*([^\r\n]+)$/m)?.[1]?.trim();
  const rawData = block.match(/^data:\s*([^\r\n]+)$/m)?.[1];
  if (!event || !rawData) return null;
  try {
    return { event, data: JSON.parse(rawData) };
  } catch {
    return null;
  }
}

export async function streamAIChat(request: YaChatRequest, handlers: AIChatStreamHandlers, signal?: AbortSignal): Promise<void> {
  const v2Enabled = import.meta.env.VITE_YA_AGENT_V2_ENABLED === "true";
  const response = await fetchAI(v2Enabled ? "/api/ai/v2/chat/stream" : "/api/ai/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(request),
    signal,
  });

  if (!response.ok || !response.body) {
    const body = await response.json().catch(() => null) as { detail?: string; error?: string } | null;
    throw new Error(body?.detail ?? body?.error ?? "Não foi possível conversar com a AI agora.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamError: Error | null = null;

  const dispatch = (block: string) => {
    const parsed = readEvent(block);
    if (!parsed || !parsed.data || typeof parsed.data !== "object") return;
    const data = parsed.data as Record<string, unknown>;
    if (parsed.event === "status" && typeof data.message === "string") handlers.onStatus?.(data.message);
    if (parsed.event === "thread" && typeof data.conversation_id === "string") handlers.onThread?.(data.conversation_id);
    if (parsed.event === "plan" && data.query_spec && typeof data.query_spec === "object") {
      handlers.onPlan?.(data.query_spec as Record<string, unknown>);
    }
    if (parsed.event === "sources" && Array.isArray(data.sources)) {
      handlers.onSources?.(data.sources as YaChatSource[], {
        dbMs: typeof data.db_ms === "number" ? data.db_ms : 0,
        cacheHits: typeof data.cache_hits === "number" ? data.cache_hits : 0,
      });
    }
    if (parsed.event === "delta" && typeof data.text === "string") handlers.onDelta?.(data.text);
    if (parsed.event === "tool_start" && typeof data.label === "string") {
      handlers.onToolStart?.({ label: data.label, position: typeof data.position === "number" ? data.position : 0 });
    }
    if (parsed.event === "tool_result" && typeof data.label === "string") {
      handlers.onToolResult?.({
        label: data.label,
        status: typeof data.status === "string" ? data.status : "ok",
        source: data.source && typeof data.source === "object" ? data.source as YaChatSource : undefined,
        artifacts: Array.isArray(data.artifacts) ? data.artifacts as YaArtifact[] : [],
        warnings: Array.isArray(data.warnings) ? data.warnings.filter((item): item is string => typeof item === "string") : [],
      });
    }
    if (parsed.event === "done" && typeof data.conversation_id === "string") {
      handlers.onDone?.({
        conversationId: data.conversation_id,
        assistantMessageId: typeof data.assistant_message_id === "string" ? data.assistant_message_id : "",
        sources: Array.isArray(data.sources) ? data.sources as YaChatSource[] : [],
        evidence: Array.isArray(data.evidence) ? data.evidence as YaChatSource[] : [],
        querySpec: data.query_spec && typeof data.query_spec === "object"
          ? data.query_spec as Record<string, unknown>
          : {},
        answer: typeof data.answer === "string" ? data.answer : "Não encontrei dados suficientes para responder com segurança.",
        artifacts: Array.isArray(data.artifacts) ? data.artifacts as YaArtifact[] : [],
        choices: Array.isArray(data.choices) ? data.choices as YaChoice[] : [],
        generatedAt: typeof data.generated_at === "string" ? data.generated_at : new Date().toISOString(),
      });
    }
    if (parsed.event === "error") {
      streamError = new Error(typeof data.detail === "string" ? data.detail : "Não consegui concluir esta consulta. Tente reformular a pergunta ou indicar o período e o assunto que quer investigar.");
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() ?? "";
    blocks.forEach(dispatch);
    if (done) break;
  }
  if (buffer.trim()) dispatch(buffer);
  if (streamError) throw streamError;
}
