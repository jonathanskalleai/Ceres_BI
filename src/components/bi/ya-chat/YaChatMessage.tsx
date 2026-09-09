import { cn } from "@/lib/utils";
import type { YaArtifact, YaChatSource, YaChoice, YaFeedbackType } from "@/services/yaChatService";
import { YaChatAnswer } from "./YaChatAnswer";
import { YaChatArtifacts } from "./YaChatArtifacts";

export interface ChatMessageData {
  id?: string;
  role: "user" | "assistant";
  content: string;
  sources?: YaChatSource[];
  querySpec?: Record<string, unknown>;
  artifacts?: YaArtifact[];
  choices?: YaChoice[];
  feedback?: YaFeedbackType;
  feedbackPending?: boolean;
}

interface YaChatMessageProps {
  message: ChatMessageData;
  index: number;
  onFeedback?: (messageId: string, feedbackType: YaFeedbackType) => void;
  onChoice?: (value: string) => void;
}

export function YaChatMessage({ message, index, onChoice }: YaChatMessageProps) {
  const isAssistant = message.role === "assistant";
  return (
    <article key={message.id ?? `${message.role}-${index}`} className={cn("max-w-[92%] rounded-xl px-4 py-3 text-sm leading-6", message.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "border bg-card text-card-foreground")}>
      <YaChatAnswer content={message.content} />
      {isAssistant && <YaChatArtifacts artifacts={message.artifacts} choices={message.choices} onChoice={onChoice} />}
    </article>
  );
}
