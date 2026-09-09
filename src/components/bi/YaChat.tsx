import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Archive, Brain, LoaderCircle, MessageSquareText, Plus, SendHorizontal, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDateBR, toISODate } from "@/lib/dateUtils";
import { logClientError, logClientWarning } from "@/lib/logger";
import { cn } from "@/lib/utils";
import {
  closeAIConversation,
  getAIConversation,
  listAIConversations,
  listAIUserMemories,
  forgetAIUserMemory,
  sendAIMessageFeedback,
  streamAIChat,
  type AIConversationPreview,
  type YaChatSource,
  type YaFeedbackType,
  type YaUserMemory,
} from "@/services/yaChatService";
import { YaChatMessage, type ChatMessageData } from "./ya-chat/YaChatMessage";

type ChatMessage = ChatMessageData;

const SUGGESTIONS = [
  "Como foi o resultado deste mês?",
  "Onde a equipe está perdendo desempenho?",
  "Investigue a relação entre visitas e vendas.",
];
const V2_ENABLED = import.meta.env.VITE_YA_AGENT_V2_ENABLED === "true";

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
  const [progress, setProgress] = useState("");
  const [toolStatus, setToolStatus] = useState("");
  const [memories, setMemories] = useState<YaUserMemory[]>([]);
  const [showMemories, setShowMemories] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const loadedUserRef = useRef<string>();
  const conversationIdRef = useRef<string>();
  const sendingRef = useRef(false);
  const abortRef = useRef<AbortController>();
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

  const setActiveConversation = useCallback((id?: string) => {
    conversationIdRef.current = id;
    setConversationId(id);
    persistActiveThread(id);
  }, [persistActiveThread]);

  const loadThread = useCallback(async (id: string) => {
    const conversation = await getAIConversation(id);
    setActiveConversation(conversation.id);
    setMessages(conversation.messages.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      sources: message.evidence.length > 0 ? message.evidence : message.sources,
      querySpec: message.query_spec,
      artifacts: message.artifacts,
      choices: message.choices,
    })));
  }, [setActiveConversation]);

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
      } catch (error) {
        logClientWarning("YaChat.load_history_failed", error);
        // The chat can still begin a new thread if historical data is unavailable.
      } finally {
        if (active) setIsLoadingThreads(false);
      }
    })();
    return () => { active = false; };
  }, [loadThread, open, refreshThreads, user?.id]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (open && !wasOpenRef.current) closeRef.current?.focus();
    if (!open && wasOpenRef.current) triggerRef.current?.focus();
    wasOpenRef.current = open;
  }, [open]);

  if (permissionsLoading || !hasAccess) return null;

  const startNewThread = () => {
    setActiveConversation();
    setMessages([]);
    setStatus("");
    setProgress("");
    setToolStatus("");
  };

  const closeCurrentThread = async () => {
    const activeConversationId = conversationIdRef.current;
    if (!activeConversationId || isSending) return;
    try {
      await closeAIConversation(activeConversationId);
      startNewThread();
      await refreshThreads();
    } catch (error) {
      logClientWarning("YaChat.close_thread_failed", error);
      setStatus(error instanceof Error ? error.message : "Não foi possível encerrar a conversa.");
    }
  };

  const toggleMemories = async () => {
    if (showMemories) {
      setShowMemories(false);
      return;
    }
    try {
      setMemories(await listAIUserMemories());
      setShowMemories(true);
    } catch (error) {
      logClientWarning("YaChat.load_memories_failed", error);
      setStatus(error instanceof Error ? error.message : "Não foi possível carregar as memórias.");
    }
  };

  const forgetMemory = async (key: string) => {
    try {
      await forgetAIUserMemory(key);
      setMemories((current) => current.filter((memory) => memory.key !== key));
    } catch (error) {
      logClientWarning("YaChat.forget_memory_failed", error);
      setStatus(error instanceof Error ? error.message : "Não foi possível esquecer essa memória.");
    }
  };

  const send = async (message: string) => {
    const normalized = message.trim();
    if (!normalized || sendingRef.current) return;

    const activeConversationId = conversationIdRef.current;
    setInput("");
    setStatus("");
    setMessages((current) => [...current, { role: "user", content: normalized }]);
    sendingRef.current = true;
    setIsSending(true);
    setProgress("Entendendo a sua pergunta…");
    setToolStatus("");
    abortRef.current = new AbortController();
    let streamedSources: YaChatSource[] = [];
    let streamedAnswer = "";
    let completed = false;
    let requestSucceeded = false;

    try {
      await streamAIChat({
        message: normalized,
        conversation_id: activeConversationId,
        context,
      }, {
        onStatus: setProgress,
        onThread: setActiveConversation,
        onToolStart: ({ label }) => setToolStatus(`Consultando ${label}…`),
        onToolResult: ({ label, status: toolResultStatus }) => setToolStatus(toolResultStatus === "ok" ? `${label} concluído.` : `${label}: não foi possível concluir.`),
        onSources: (sources) => {
          streamedSources = sources;
        },
        onDelta: (text) => { streamedAnswer += text; },
        onDone: ({ conversationId: id, assistantMessageId, sources, evidence, querySpec, answer, artifacts, choices }) => {
          completed = true;
          streamedSources = sources;
          setActiveConversation(id);
          const finalAnswer = answer.trim() || streamedAnswer.trim() || "Não encontrei dados suficientes para responder com segurança.";
          setMessages((current) => {
            return [...current, { id: assistantMessageId || undefined, role: "assistant", content: finalAnswer, sources: evidence.length > 0 ? evidence : sources, querySpec, artifacts, choices }];
          });
        },
      }, abortRef.current?.signal);
      requestSucceeded = true;
      if (!completed) {
        setMessages((current) => [...current, {
          role: "assistant",
          content: "Não encontrei dados suficientes para responder com segurança.",
          sources: streamedSources,
        }]);
      }
    } catch (error) {
      logClientError("YaChat.request_failed", error);
      setMessages((current) => [...current, {
        role: "assistant",
        content: error instanceof DOMException && error.name === "AbortError" ? "A consulta foi cancelada." : error instanceof Error ? error.message : "Não foi possível consultar os dados do BI agora.",
      }]);
      setStatus("");
    } finally {
      abortRef.current = undefined;
      sendingRef.current = false;
      setIsSending(false);
      setProgress("");
      setToolStatus("");
    }
    if (requestSucceeded) {
      try {
        await refreshThreads();
      } catch (error) {
        logClientWarning("YaChat.refresh_threads_failed", error);
      }
    }
  };

  const handleFeedback = async (messageId: string, feedbackType: YaFeedbackType) => {
    const activeConversationId = conversationIdRef.current;
    if (!activeConversationId || !messageId) return;
    setMessages((current) => current.map((message) => message.id === messageId ? { ...message, feedbackPending: true } : message));
    try {
      await sendAIMessageFeedback(activeConversationId, messageId, feedbackType);
      setMessages((current) => current.map((message) => message.id === messageId ? { ...message, feedback: feedbackType, feedbackPending: false } : message));
    } catch (error) {
      logClientWarning("YaChat.feedback_failed", error);
      setMessages((current) => current.map((message) => message.id === messageId ? { ...message, feedbackPending: false } : message));
      setStatus(error instanceof Error ? error.message : "Não foi possível registrar o feedback.");
    }
  };

  const handleChoice = (value: string) => {
    if (!isSending) void send(value);
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
    <div className={cn(open ? "fixed inset-0 z-30 flex flex-col items-end justify-end" : "fixed bottom-5 right-5 z-30")}>
      {open && (
        <section aria-label="Chat da AI do BI" className="mb-0 flex h-full w-full self-stretch flex-col overflow-hidden border bg-background shadow-2xl sm:mb-3 sm:h-[min(72dvh,42rem)] sm:w-[min(calc(100vw-2.5rem),31rem)] sm:self-auto sm:rounded-2xl">
          <header className="border-b px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] sm:pt-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-semibold"><MessageSquareText className="h-5 w-5 text-primary" />AI do BI</h2>
                <p className="mt-1 text-sm text-muted-foreground">Converse com os dados do BI e refine a pergunta quando quiser.</p>
              </div>
              <Button ref={closeRef} type="button" variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Fechar chat da AI"><X className="h-4 w-4" /></Button>
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
              {V2_ENABLED && <Button type="button" variant="ghost" size="sm" onClick={() => void toggleMemories()} disabled={isSending} aria-expanded={showMemories}><Brain className="mr-1 h-3.5 w-3.5" />Memórias</Button>}
              {conversationId && <Button type="button" variant="ghost" size="icon" onClick={() => void closeCurrentThread()} disabled={isSending} aria-label="Encerrar conversa"><Archive className="h-4 w-4" /></Button>}
            </div>
          </header>

          {showMemories && (
            <div className="border-b bg-muted/20 px-5 py-3" aria-label="Memórias guardadas">
              <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold">O que a agente lembra</span><span className="text-[11px] text-muted-foreground">Preferências, não números do BI</span></div>
              {memories.length === 0 ? <p className="text-xs text-muted-foreground">Nenhuma memória guardada.</p> : <div className="space-y-2">{memories.map((memory) => <div key={memory.key} className="flex items-start justify-between gap-2 rounded-md border bg-background px-2.5 py-2 text-xs"><div><div className="font-medium">{memory.key}</div><div className="text-muted-foreground">{memory.content}</div></div><Button type="button" variant="ghost" size="sm" className="h-7 shrink-0 px-2" onClick={() => void forgetMemory(memory.key)}>Esquecer</Button></div>)}</div>}
            </div>
          )}

          <div className="border-b bg-muted/30 px-5 py-2.5">
            <Badge variant="outline" className="max-w-full truncate font-normal">
              Contexto: {context.filters.from && context.filters.to ? `${formatDateBR(context.filters.from)} a ${formatDateBR(context.filters.to)}` : "sem período"}
              {context.filters.vendedor ? ` · ${context.filters.vendedor}` : ""}{context.filters.cidade ? ` · ${context.filters.cidade}` : ""}
            </Badge>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            {messages.length === 0 && !isLoadingThreads && (
              <div className="space-y-4 pt-3">
                <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">Sou a analista conversacional do Ceres BI. Pergunte sobre vendas, equipe e ações com suas próprias palavras — posso comparar períodos, explicar conceitos e mostrar tabelas ou gráficos quando houver evidência.</div>
                <div className="space-y-2">
                  {SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => void send(suggestion)} className="w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:border-primary/50 hover:bg-accent">{suggestion}</button>)}
                  <p className="pt-1 text-center text-xs text-muted-foreground">Pergunte do seu jeito — esses exemplos não limitam a conversa.</p>
                </div>
              </div>
            )}

            {messages.map((message, index) => <YaChatMessage key={message.id ?? `${message.role}-${index}`} message={message} index={index} onFeedback={handleFeedback} onChoice={handleChoice} />)}

            {isSending && (
              <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm text-muted-foreground" role="status" aria-live="polite"><LoaderCircle className="h-4 w-4 animate-spin" /><span>{toolStatus || progress || "Pensando…"}</span></div>
            )}
            {status && !isSending && <p className="text-xs text-destructive" role="alert">{status}</p>}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={onSubmit} className="border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4">
            <Textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={onKeyDown} placeholder="Ex.: Onde estamos perdendo mais negócios e por quê?" className="min-h-[84px] resize-none" disabled={isSending} aria-label="Mensagem para a agente de dados" />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Ctrl/Cmd + Enter para enviar</span>
              {isSending ? <Button type="button" variant="outline" size="sm" onClick={() => abortRef.current?.abort()}><X className="h-4 w-4" /><span className="ml-2">Cancelar</span></Button> : <Button type="submit" size="sm" disabled={!input.trim()}><SendHorizontal className="h-4 w-4" /><span className="ml-2">Enviar</span></Button>}
            </div>
          </form>
        </section>
      )}

      <Button ref={triggerRef} type="button" onClick={() => setOpen((current) => !current)} className="h-12 rounded-full px-4 shadow-lg" aria-label="Abrir chat da AI"><Sparkles className="mr-2 h-4 w-4" />{open ? "Fechar AI" : "Chat com a AI"}</Button>
    </div>
  );
}
