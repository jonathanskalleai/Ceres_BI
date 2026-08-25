import { useMemo, memo } from "react";
import { ArrowUpRight, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Vendedor } from "@/types/comercial";
import type { RpcConsultorResumoAcoes } from "@/types/consultoresRpc";

interface RankingPerformanceHorizontalProps {
  vendedores: Vendedor[];
  resumo: RpcConsultorResumoAcoes[];
  onSelectConsultor: (nome: string) => void;
}

const formatCurrency = (value: number) => {
  if (value >= 1e6) return `R$ ${(value / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (value >= 1e3) return `R$ ${(value / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
};

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const POSITION_RIBBONS = [
  { text: "1", bg: "bg-amber-500 text-amber-950 font-bold border-amber-400" },
  { text: "2", bg: "bg-slate-300 text-slate-900 font-bold border-slate-200" },
  { text: "3", bg: "bg-amber-700 text-amber-100 font-bold border-amber-600" },
  { text: "4", bg: "bg-white/10 text-muted-foreground font-medium border-white/10" },
  { text: "5", bg: "bg-white/10 text-muted-foreground font-medium border-white/10" },
];

export const RankingPerformanceHorizontal = memo(function RankingPerformanceHorizontal({
  vendedores,
  resumo,
  onSelectConsultor,
}: RankingPerformanceHorizontalProps) {
  const resumoPorConsultor = useMemo(
    () => new Map(resumo.map((item) => [item.consultor, item])),
    [resumo]
  );

  const vendedoresRanked = useMemo(() => {
    return [...vendedores].sort((a, b) => {
      const aResumo = resumoPorConsultor.get(a.nome);
      const bResumo = resumoPorConsultor.get(b.nome);
      return (
        Number(bResumo?.valor_ganho ?? 0) - Number(aResumo?.valor_ganho ?? 0) ||
        b.visitas - a.visitas ||
        b.totalAcoes - a.totalAcoes ||
        a.nome.localeCompare(b.nome, "pt-BR")
      );
    });
  }, [vendedores, resumoPorConsultor]);

  const top5 = vendedoresRanked.slice(0, 5);
  const maxVendas = Math.max(
    ...top5.map((v) => Number(resumoPorConsultor.get(v.nome)?.valor_ganho ?? 0)),
    1
  );

  if (top5.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {/* Title */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500 dark:text-amber-400" />
          <h3
            className="text-[12px] font-semibold tracking-tight text-foreground"
            style={{ fontFamily: "var(--voux-font-sans)" }}
          >
            Performance Ranking
          </h3>
        </div>
        <span className="text-[11px] font-mono text-muted-foreground">
          Top {top5.length} Consultores
        </span>
      </div>

      {/* 5 Horizontal Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {top5.map((vendedor, index) => {
          const item = resumoPorConsultor.get(vendedor.nome);
          const valorGanho = Number(item?.valor_ganho ?? 0);
          const percentual = (valorGanho / maxVendas) * 100;
          const ribbon = POSITION_RIBBONS[index] || POSITION_RIBBONS[4];
          const initials = getInitials(vendedor.nome);

          return (
            <button
              key={vendedor.nome}
              type="button"
              onClick={() => onSelectConsultor(vendedor.nome)}
              className={cn(
                "group relative flex flex-col justify-between rounded-2xl border p-4 text-left transition-all duration-200",
                "hover:scale-[1.02] hover:border-amber-500/50 hover:shadow-lg",
                index === 0
                  ? "border-amber-500/30 bg-amber-500/[0.02]"
                  : "border-white/[0.08]"
              )}
              style={{
                background: "var(--surface-raised)",
                borderColor: index === 0 ? "var(--voux-accent)" : "var(--voux-card-border)",
                boxShadow: "var(--voux-card-shadow)",
              }}
            >
              {/* Top Row: Avatar & Position Ribbon */}
              <div className="flex items-start justify-between gap-2 mb-3">
                {/* Avatar */}
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ring-2 ring-black/10 dark:ring-white/10 font-mono font-bold text-xs bg-black/5 dark:bg-white/10 text-foreground transition-transform group-hover:scale-105"
                  style={{ borderColor: "var(--voux-card-border)" }}
                >
                  {initials}
                </div>

                {/* Ribbon Tag */}
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-mono shadow-sm border",
                    ribbon.bg
                  )}
                >
                  {ribbon.text}
                </span>
              </div>

              {/* Middle: Name & Value */}
              <div className="min-w-0 mb-3">
                <p
                  className="truncate text-[12px] font-bold text-foreground group-hover:text-amber-500 transition-colors"
                  style={{ fontFamily: "var(--voux-font-sans)" }}
                  title={vendedor.nome}
                >
                  {vendedor.nome}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <p
                    className="font-mono font-bold text-[14px] tabular-nums"
                    style={{ color: valorGanho > 0 ? "#10b981" : "var(--voux-text-faint)" }}
                  >
                    {formatCurrency(valorGanho)}
                  </p>
                  {valorGanho > 0 && (
                    <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 truncate font-mono">
                  {item?.ganhos ?? 0} ped · {vendedor.visitas} vis
                </p>
              </div>

              {/* Bottom: Progress Bar */}
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-500 bg-emerald-500"
                  style={{
                    width: `${Math.max(percentual, 6)}%`,
                    opacity: index < 3 ? 1 : 0.6,
                  }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
