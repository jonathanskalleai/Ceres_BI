import { fetchAI } from "@/lib/fetchAI";

export interface YaChatFilters {
  from?: string;
  to?: string;
  categoria?: string;
  funil?: string;
  vendedor?: string;
  cidade?: string;
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
  refreshed_at?: string;
}

export interface YaChatResponse {
  conversation_id: string;
  answer: string;
  sources: YaChatSource[];
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
  created_at: string;
}

export interface AIConversationDetail {
  id: string;
  title: string;
  status: "active" | "closed";
  summary: string;
  updated_at: string;
  messages: AIConversationMessage[];
}

export interface AIChatStreamHandlers {
  onStatus?: (message: string) => void;
  onThread?: (conversationId: string) => void;
  onSources?: (sources: YaChatSource[], metrics: { dbMs: number; cacheHits: number }) => void;
  onDelta?: (text: string) => void;
  onDone?: (payload: { conversationId: string; sources: YaChatSource[]; generatedAt: string }) => void;
}

export async function sendYaChat(request: YaChatRequest): Promise<YaChatResponse> {
  const response = await fetchAI("/api/ai/chat", {
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

function readEvent(block: string): { event: string; data: unknown } | null {
  const event = block.match(/^event:\s*(.+)$/m)?.[1]?.trim();
  const rawData = block.match(/^data:\s*(.+)$/m)?.[1];
  if (!event || !rawData) return null;
  try {
    return { event, data: JSON.parse(rawData) };
  } catch {
    return null;
  }
}

export async function streamAIChat(request: YaChatRequest, handlers: AIChatStreamHandlers): Promise<void> {
  const response = await fetchAI("/api/ai/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(request),
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
    if (parsed.event === "sources" && Array.isArray(data.sources)) {
      handlers.onSources?.(data.sources as YaChatSource[], {
        dbMs: typeof data.db_ms === "number" ? data.db_ms : 0,
        cacheHits: typeof data.cache_hits === "number" ? data.cache_hits : 0,
      });
    }
    if (parsed.event === "delta" && typeof data.text === "string") handlers.onDelta?.(data.text);
    if (parsed.event === "done" && typeof data.conversation_id === "string") {
      handlers.onDone?.({
        conversationId: data.conversation_id,
        sources: Array.isArray(data.sources) ? data.sources as YaChatSource[] : [],
        generatedAt: typeof data.generated_at === "string" ? data.generated_at : new Date().toISOString(),
      });
    }
    if (parsed.event === "error") {
      streamError = new Error(typeof data.detail === "string" ? data.detail : "Não foi possível concluir a análise agora.");
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    blocks.forEach(dispatch);
    if (done) break;
  }
  if (buffer.trim()) dispatch(buffer);
  if (streamError) throw streamError;
}
