import { formatBRL } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";

export function FormattedCurrency({ value, className }: { value: number; className?: string }) {
  const formatted = formatBRL(value);
  const numberPart = formatted.replace(/^R\$\s*/, "");
  return (
    <span className={cn("inline-flex items-baseline font-mono tabular-nums", className)}>
      <span className="text-[11px] font-normal text-[var(--voux-text-muted)] mr-1 tracking-normal select-none">R$</span>
      <span>{numberPart}</span>
    </span>
  );
}
