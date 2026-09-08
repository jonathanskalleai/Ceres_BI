import type { ReactNode } from "react";
import { formatChatText } from "@/lib/yaChatFormatters";

function InlineText({ text }: { text: string }): ReactNode {
  const parts = formatChatText(text).split(/(\*\*[^*]+\*\*|__[^_]+__)/g);
  return parts.map((part, index) => {
    const isBold = (part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"));
    if (isBold) return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function isBullet(line: string): boolean {
  return /^\s*[-*•]\s+/.test(line);
}

function isNumbered(line: string): boolean {
  return /^\s*\d+[.)]\s+/.test(line);
}

function ListBlock({ lines, numbered }: { lines: string[]; numbered: boolean }) {
  const List = numbered ? "ol" : "ul";
  return (
    <List className={numbered ? "list-decimal space-y-1 pl-5" : "list-disc space-y-1 pl-5"}>
      {lines.map((line, index) => (
        <li key={`${line}-${index}`}><InlineText text={line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "")} /></li>
      ))}
    </List>
  );
}

function AnswerBlock({ block, index }: { block: string; index: number }) {
  const lines = block.split(/\r?\n/).filter(Boolean);
  if (lines.length > 0 && lines.every(isBullet)) return <ListBlock lines={lines} numbered={false} />;
  if (lines.length > 0 && lines.every(isNumbered)) return <ListBlock lines={lines} numbered />;

  const heading = lines[0]?.match(/^#{2,4}\s+(.+)$/);
  if (heading) {
    return (
      <div key={`${index}-heading`}>
        <h4 className="mb-1 font-semibold text-foreground"><InlineText text={heading[1]} /></h4>
        {lines.slice(1).length > 0 && <p><InlineText text={lines.slice(1).join("\n")} /></p>}
      </div>
    );
  }

  return <p key={`${index}-paragraph`}>{lines.map((line, lineIndex) => <span key={`${line}-${lineIndex}`}><InlineText text={line} />{lineIndex < lines.length - 1 && <br />}</span>)}</p>;
}

export function YaChatAnswer({ content }: { content: string }) {
  const blocks = content.trim().split(/\n{2,}/).filter(Boolean);
  if (blocks.length === 0) return <p>Não encontrei dados suficientes para responder com segurança.</p>;
  return <div className="space-y-2">{blocks.map((block, index) => <AnswerBlock key={`${block}-${index}`} block={block} index={index} />)}</div>;
}
