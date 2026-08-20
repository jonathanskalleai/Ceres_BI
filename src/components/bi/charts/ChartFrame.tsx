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
  /** Accessible label for the chart region */
  ariaLabel?: string;
  /** Permite rolagem vertical para rankings maiores que a altura do card. */
  scrollY?: boolean;
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
  ariaLabel,
  scrollY = false,
  children,
}: ChartFrameProps) {
  const style = { height: height ?? "100%", width: "100%" } as const;

  if (loading) {
    return (
      <div
        // `var(--voux-skeleton)`, NAO `bg-foreground/5`: 5% de opacidade sobre
        // o fundo escuro e indistinguivel do card, e o sintoma que chega ao
        // usuario e "o grafico veio vazio" quando ele so esta carregando —
        // defeito ja diagnosticado neste projeto (ChartCard e BiTableCard ja
        // usam a versao correta; este frame tinha ficado para tras).
        className={`w-full animate-pulse ${rounded === "full" ? "rounded-full mx-auto" : "rounded-lg"}`}
        style={
          rounded === "full"
            ? { ...style, maxWidth: height, background: "var(--voux-skeleton)" }
            : { ...style, background: "var(--voux-skeleton)" }
        }
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
    <div
      role="img"
      aria-label={ariaLabel}
      className="w-full"
      style={{ ...style, overflowX: "hidden", overflowY: scrollY ? "auto" : "hidden", minWidth: 0 }}
    >
      {children}
    </div>
  );
}
