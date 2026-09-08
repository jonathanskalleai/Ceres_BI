import { CircleAlert, LoaderCircle, ThumbsDown, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { YaChatSource, YaFeedbackType } from "@/services/yaChatService";
import { YaChatAnswer } from "./YaChatAnswer";
import { YaChatEvidence } from "./YaChatEvidence";

export interface ChatMessageData {
  id?: string;
  role: "user" | "assistant";
  content: string;
  sources?: YaChatSource[];
  querySpec?: Record<string, unknown>;
  feedback?: YaFeedbackType;
  feedbackPending?: boolean;
}

interface YaChatMessageProps {
  message: ChatMessageData;
  index: number;
  onFeedback?: (messageId: string, feedbackType: YaFeedbackType) => void;
}

export function YaChatMessage({ message, index, onFeedback }: YaChatMessageProps) {
  const isAssistant = message.role === "assistant";
  const canRate = isAssistant && Boolean(message.id) && Boolean(onFeedback);
  return (
    <article key={message.id ?? `${message.role}-${index}`} className={cn("max-w-[92%] rounded-xl px-4 py-3 text-sm leading-6", message.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "border bg-card text-card-foreground")}>
      <YaChatAnswer content={message.content} />
      {isAssistant && message.sources && <YaChatEvidence sources={message.sources} />}
      {canRate && (
        <div className="mt-3 flex items-center gap-2 border-t pt-2 text-xs text-muted-foreground">
          <span>Esta resposta foi útil?</span>
          <Button type="button" variant={message.feedback === "useful" ? "secondary" : "ghost"} size="icon" className="h-7 w-7" disabled={message.feedbackPending} aria-label="Marcar resposta como útil" aria-pressed={message.feedback === "useful"} onClick={() => onFeedback?.(message.id ?? "", "useful")}><ThumbsUp className="h-3.5 w-3.5" /></Button>
          <Button type="button" variant={message.feedback === "incorrect_number" ? "secondary" : "ghost"} size="icon" className="h-7 w-7" disabled={message.feedbackPending} aria-label="Marcar número incorreto" aria-pressed={message.feedback === "incorrect_number"} onClick={() => onFeedback?.(message.id ?? "", "incorrect_number")}><ThumbsDown className="h-3.5 w-3.5" /></Button>
          <Button type="button" variant={message.feedback === "insufficient_source" ? "secondary" : "ghost"} size="icon" className="h-7 w-7" disabled={message.feedbackPending} aria-label="Marcar fonte insuficiente" aria-pressed={message.feedback === "insufficient_source"} onClick={() => onFeedback?.(message.id ?? "", "insufficient_source")}><CircleAlert className="h-3.5 w-3.5" /></Button>
          {message.feedbackPending && <LoaderCircle className="h-3 w-3 animate-spin" aria-label="Registrando feedback" />}
        </div>
      )}
    </article>
  );
}
