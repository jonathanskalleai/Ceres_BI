import type { ReactNode } from "react";

interface ChartFrameProps {
  loading?: boolean;
  isEmpty?: boolean;
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
        className="w-full flex items-center justify-center text-muted-foreground text-sm"
        style={style}
      >
        Sem dados
      </div>
    );
  }

  return (
    <div className="w-full" style={style}>
      {children}
    </div>
  );
}
