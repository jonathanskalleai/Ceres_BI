import { useMemo } from "react";
import { ArrowUpRight, Trophy, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Vendedor } from "@/types/comercial";
import type { RpcConsultorResumoAcoes } from "@/types/consultoresRpc";

interface RankingPerformanceCardProps {
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

const AVATAR_COLORS = [
  { bg: "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/40 ring-amber-500/20" },
  { bg: "bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/40 ring-sky-500/20" },
  { bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/40 ring-emerald-500/20" },
  { bg: "bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/40 ring-purple-500/20" },
  { bg: "bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/40 ring-rose-500/20" },
];

export function RankingPerformanceCard({
  vendedores,
  resumo,
  onSelectConsultor,
}: RankingPerformanceCardProps) {
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

  return (
    <div
      className="flex flex-col justify-between h-full rounded-2xl border p-5 transition-all duration-200"
      style={{
        background: "var(--surface-raised)",
        borderColor: "var(--voux-card-border)",
        boxShadow: "var(--voux-card-shadow)",
      }}
    >
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            <h3
              className="text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}
            >
              Ranking de Performance
            </h3>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            Top {top5.length} de {vendedoresRanked.length}
          </span>
        </div>

        {/* Top 5 List */}
        <div className="space-y-2.5">
          {top5.map((vendedor, index) => {
            const item = resumoPorConsultor.get(vendedor.nome);
            const valorGanho = Number(item?.valor_ganho ?? 0);
            const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
            const initials = getInitials(vendedor.nome);

            return (
              <button
                key={vendedor.nome}
                type="button"
                onClick={() => onSelectConsultor(vendedor.nome)}
                className={cn(
                  "group flex w-full items-center gap-3.5 rounded-xl border p-3 text-left transition-all duration-200",
                  "hover:scale-[1.01] hover:border-amber-500/40 hover:shadow-md",
                  index === 0 ? "border-amber-500/30 bg-amber-500/[0.02]" : "border-border/60 bg-transparent"
                )}
                style={{
                  background: index === 0 ? "rgba(212,184,150,0.04)" : "var(--surface-base)",
                  borderColor: index === 0 ? "var(--voux-accent)" : "var(--voux-card-border)",
                }}
              >
                {/* Avatar with Ring */}
                <div
                  className={cn(
                    "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ring-2 font-mono font-bold text-xs shadow-sm transition-transform group-hover:scale-105",
                    avatarColor.bg
                  )}
                >
                  {initials}
                  <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-background border text-[9px] font-mono font-bold text-foreground">
                    {index + 1}
                  </span>
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p
                      className="truncate text-[13px] font-bold text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors"
                      style={{ fontFamily: "var(--voux-font-sans)" }}
                    >
                      {vendedor.nome}
                    </p>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                    {item?.ganhos ?? 0} vendas · {vendedor.visitas} visitas · {vendedor.totalAcoes} ações
                  </p>
                </div>

                {/* Value & Trend */}
                <div className="shrink-0 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <p
                      className="font-mono font-bold text-[13px] tabular-nums"
                      style={{ color: valorGanho > 0 ? "var(--voux-success)" : "var(--voux-text-faint)" }}
                    >
                      {formatCurrency(valorGanho)}
                    </p>
                    {valorGanho > 0 && (
                      <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground font-mono">faturado</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Footer hint */}
      <div className="pt-3 mt-3 border-t flex items-center justify-between text-[11px]" style={{ borderColor: "var(--voux-card-border)" }}>
        <span className="text-muted-foreground">Clique para abrir o detalhe do consultor</span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-60" />
      </div>
    </div>
  );
}
