import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Archive, LoaderCircle, MessageSquareText, Plus, SendHorizontal, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { toISODate } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import {
  closeAIConversation,
  getAIConversation,
  listAIConversations,
  streamAIChat,
  type AIConversationPreview,
  type YaChatSource,
} from "@/services/yaChatService";

type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  sources?: YaChatSource[];
  streaming?: boolean;
};

const SUGGESTIONS = [
  "Quais são os maiores gargalos do funil neste período?",
  "Onde tivemos muitas visitas, mas pouca conversão?",
  "Quais perdas merecem atenção imediata?",
  "Resuma a situação comercial da empresa.",
];

function sourceFilterSummary(source: YaChatSource): string {
  const filters = source.filters;
  const period = filters.from && filters.to ? `${filters.from} a ${filters.to}` : "período da tela";
  const extra = [filters.vendedor, filters.cidade, filters.cliente].filter(Boolean).join(" · ");
  return extra ? `${period} · ${extra}` : period;
}

export function YaChat() {
  const location = useLocation();
  const { isAdmin, user } = useAuth();
  const { canAccess, isLoading: permissionsLoading } = usePermissions();
  const { dateRange, categoria, funil, vendedor, cidade } = useNegociosFilter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threads, setThreads] = useState<AIConversationPreview[]>([]);
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const loadedUserRef = useRef<string>();
  const hasAccess = isAdmin || canAccess("bi.ya");
  const activeThreadKey = user ? `ceres-bi-ai-thread:${user.id}` : "";

  const context = useMemo(() => ({
    route: location.pathname,
    filters: {
      from: toISODate(dateRange?.from),
      to: toISODate(dateRange?.to ?? dateRange?.from),
      categoria: categoria === "__all__" ? undefined : categoria,
      funil: funil === "__all__" ? undefined : funil,
      vendedor: vendedor || undefined,
      cidade: cidade || undefined,
    },
  }), [categoria, cidade, dateRange?.from, dateRange?.to, funil, location.pathname, vendedor]);

  const persistActiveThread = useCallback((id?: string) => {
    if (!activeThreadKey) return;
    if (id) localStorage.setItem(activeThreadKey, id);
    else localStorage.removeItem(activeThreadKey);
  }, [activeThreadKey]);

  const loadThread = useCallback(async (id: string) => {
    const conversation = await getAIConversation(id);
    setConversationId(conversation.id);
    persistActiveThread(conversation.id);
    setMessages(conversation.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      sources: message.sources,
    })));
  }, [persistActiveThread]);

  const refreshThreads = useCallback(async () => {
    const conversationList = await listAIConversations();
    setThreads(conversationList);
    return conversationList;
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  useEffect(() => {
    if (!open || !user?.id || loadedUserRef.current === user.id) return;
    let active = true;
    loadedUserRef.current = user.id;
    setIsLoadingThreads(true);
    void (async () => {
      try {
        const conversationList = await refreshThreads();
        const storedId = localStorage.getItem(`ceres-bi-ai-thread:${user.id}`);
        const selectedId = storedId && conversationList.some((thread) => thread.id === storedId)
          ? storedId
          : conversationList[0]?.id;
        if (active && selectedId) await loadThread(selectedId);
      } catch {
        // The chat can still begin a new thread if historical data is unavailable.
      } finally {
        if (active) setIsLoadingThreads(false);
      }
    })();
    return () => { active = false; };
  }, [loadThread, open, refreshThreads, user?.id]);

  if (permissionsLoading || !hasAccess) return null;

  const startNewThread = () => {
    setConversationId(undefined);
    setMessages([]);
    setStatus("");
    persistActiveThread();
  };

  const closeCurrentThread = async () => {
    if (!conversationId || isSending) return;
    try {
      await closeAIConversation(conversationId);
      startNewThread();
      await refreshThreads();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível encerrar a conversa.");
    }
  };

  const send = async (message: string) => {
    const normalized = message.trim();
    if (!normalized || isSending) return;

    setInput("");
    setStatus("Consultando os dados do BI…");
    setMessages((current) => [...current, { role: "user", content: normalized }]);
    setIsSending(true);
    let streamedSources: YaChatSource[] = [];
    let assistantStarted = false;

    try {
      await streamAIChat({
        message: normalized,
        conversation_id: conversationId,
        context,
      }, {
        onStatus: setStatus,
        onThread: (id) => {
          setConversationId(id);
          persistActiveThread(id);
        },
        onSources: (sources, metrics) => {
          streamedSources = sources;
          setStatus(metrics.cacheHits > 0 ? "Usando dados recentes da conversa…" : "Escrevendo a análise…");
        },
        onDelta: (text) => {
          assistantStarted = true;
          setMessages((current) => {
            const last = current[current.length - 1];
            if (last?.role === "assistant" && last.streaming) {
              return [...current.slice(0, -1), { ...last, content: last.content + text }];
            }
            return [...current, { role: "assistant", content: text, sources: streamedSources, streaming: true }];
          });
        },
        onDone: ({ conversationId: id, sources }) => {
          streamedSources = sources;
          setConversationId(id);
          persistActiveThread(id);
          setMessages((current) => {
            const last = current[current.length - 1];
            if (last?.role === "assistant" && last.streaming) {
              return [...current.slice(0, -1), { ...last, sources, streaming: false }];
            }
            return current;
          });
        },
      });
      if (!assistantStarted) {
        setMessages((current) => [...current, {
          role: "assistant",
          content: "Não encontrei dados suficientes para responder com segurança.",
          sources: streamedSources,
        }]);
      }
      setStatus("");
      await refreshThreads();
    } catch (error) {
      setMessages((current) => [...current, {
        role: "assistant",
        content: error instanceof Error ? error.message : "Não foi possível consultar os dados do BI agora.",
      }]);
      setStatus("");
    } finally {
      setIsSending(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void send(input);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void send(input);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-30 flex flex-col items-end">
      {open && (
        <section aria-label="Chat da AI do BI" className="mb-3 flex h-[min(72dvh,42rem)] w-[min(calc(100vw-2.5rem),31rem)] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
          <header className="border-b px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-semibold"><MessageSquareText className="h-5 w-5 text-primary" />AI do BI</h2>
                <p className="mt-1 text-sm text-muted-foreground">Uma conversa mantém o contexto até você iniciar ou encerrar outra.</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar chat da AI"><X className="h-4 w-4" /></Button>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <select
                className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm"
                value={conversationId ?? ""}
                disabled={isSending || isLoadingThreads}
                onChange={(event) => { if (!event.target.value) startNewThread(); else void loadThread(event.target.value); }}
                aria-label="Selecionar conversa"
              >
                <option value="">Nova conversa</option>
                {threads.map((thread) => <option key={thread.id} value={thread.id}>{thread.title || "Conversa sem título"}</option>)}
              </select>
              <Button type="button" variant="outline" size="sm" onClick={startNewThread} disabled={isSending}><Plus className="mr-1 h-3.5 w-3.5" />Nova</Button>
              {conversationId && <Button type="button" variant="ghost" size="icon" onClick={() => void closeCurrentThread()} disabled={isSending} aria-label="Encerrar conversa"><Archive className="h-4 w-4" /></Button>}
            </div>
          </header>

          <div className="border-b bg-muted/30 px-5 py-2.5">
            <Badge variant="outline" className="max-w-full truncate font-normal">
              Contexto: {context.filters.from && context.filters.to ? `${context.filters.from} a ${context.filters.to}` : "sem período"}
              {context.filters.vendedor ? ` · ${context.filters.vendedor}` : ""}{context.filters.cidade ? ` · ${context.filters.cidade}` : ""}
            </Badge>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {messages.length === 0 && !isLoadingThreads && (
              <div className="space-y-4 pt-3">
                <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Posso cruzar vendas, ações, funil, pedidos, clientes, máquinas instaladas e pós-venda. Esta conversa mantém seu contexto enquanto estiver ativa.</div>
                <div className="space-y-2">
                  {SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => void send(suggestion)} className="w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:border-primary/50 hover:bg-accent">{suggestion}</button>)}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <article key={message.id ?? `${message.role}-${index}`} className={cn("max-w-[92%] rounded-xl px-4 py-3 text-sm leading-6", message.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "border bg-card text-card-foreground")}>
                <p className="whitespace-pre-wrap">{message.content}</p>
                {message.sources && message.sources.length > 0 && !message.streaming && (
                  <div className="mt-3 space-y-1 border-t pt-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Fontes consultadas</span>
                    {message.sources.map((source) => <div key={source.id}>{source.label} · {sourceFilterSummary(source)}</div>)}
                  </div>
                )}
              </article>
            ))}

            {isSending && !messages.some((message) => message.streaming) && (
              <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground" aria-live="polite"><LoaderCircle className="h-4 w-4 animate-spin" />{status || "A AI está consultando os dados…"}</div>
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={onSubmit} className="border-t bg-background p-4">
            <Textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown} placeholder="Ex.: Onde estamos perdendo mais negócios e por quê?" className="min-h-[84px] resize-none" disabled={isSending} />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Ctrl/Cmd + Enter para enviar</span>
              <Button type="submit" size="sm" disabled={isSending || !input.trim()}>{isSending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}<span className="ml-2">Enviar</span></Button>
            </div>
          </form>
        </section>
      )}

      <Button type="button" onClick={() => setOpen((current) => !current)} className="h-12 rounded-full px-4 shadow-lg" aria-label="Abrir chat da AI"><Sparkles className="mr-2 h-4 w-4" />{open ? "Fechar AI" : "Chat com a AI"}</Button>
    </div>
  );
}
