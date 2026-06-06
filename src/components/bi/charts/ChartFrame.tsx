import type { ReactNode } from "react";
import { BarChart3 } from "lucide-react";

interface ChartFrameProps {
  loading?: boolean;
  isEmpty?: boolean;
  /** Mensagem do empty state (default: "Sem dados para este período") */
  emptyMessage?: string;
  /** Altura em px; quando omitido, preenche 100% do container pai. */
  height?: number;
  rounded?: "lg" | "full";
  children: ReactNode;
}

/**
 * Moldura compartilhada dos gráficos do BI: trata estados de loading e vazio
 * de forma consistente e aplica a altura. Evita duplicar esse boilerplate em
 * cada wrapper (DRY).
 */
export function ChartFrame({
  loading = false,
  isEmpty = false,
  emptyMessage = "Sem dados para este período",
  height,
  rounded = "lg",
  children,
}: ChartFrameProps) {
  const style = { height: height ?? "100%", width: "100%" } as const;

  if (loading) {
    return (
      <div
        className={`w-full animate-pulse bg-foreground/5 ${rounded === "full" ? "rounded-full mx-auto" : "rounded-lg"}`}
        style={rounded === "full" ? { ...style, maxWidth: height } : style}
        aria-hidden="true"
      />
    );
  }

  if (isEmpty) {
    return (
      <div
        className="w-full flex flex-col items-center justify-center gap-2 text-muted-foreground"
        style={style}
      >
        <BarChart3 className="h-8 w-8 opacity-40" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ ...style, overflow: "hidden" }}>
      {children}
    </div>
  );
}
