import { memo, useState } from "react";
import { Compass, Users, Phone, MessageSquare, MapPin, Calendar, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  tiposAcao: Record<string, number>;
  totalAcoes: number;
  visitas: number;
  clientes: number;
}

const EARTHY = ["#4caf7a", "#d4a05a", "#8ea3b8", "#7a9b6f", "#c97565", "#6e542f", "#d4b896"] as const;

// Donut SVG interativo
function SimpleDonut({ data, size = 135, thickness = 14 }: { data: { label: string; value: number; color: string }[]; size?: number; thickness?: number }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs = data.map((d) => {
    const pct = d.value / total;
    const dashArray = `${pct * circumference} ${circumference}`;
    const dashOffset = -offset * circumference;
    offset += pct;
    return { ...d, dashArray, dashOffset, pct };
  });

  const centerLabel = hovered !== null ? `${(arcs[hovered].pct * 100).toFixed(0)}%` : String(total);
  const centerSub = hovered !== null ? arcs[hovered].label : "ações";

  return (
    <div className="flex items-center justify-center gap-4 py-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 cursor-pointer">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(214,207,193,0.1)" strokeWidth={thickness} />
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={hovered === i ? thickness + 4 : thickness}
            strokeDasharray={arc.dashArray}
            strokeDashoffset={arc.dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            opacity={hovered === null || hovered === i ? 1 : 0.4}
            className="transition-all duration-200"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontFamily: "var(--voux-font-mono)", fontSize: 16, fontWeight: 700, fill: "var(--voux-text-primary)" }}
        >
          {centerLabel}
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontFamily: "var(--voux-font-mono)", fontSize: 9, fill: "var(--voux-text-faint)" }}
        >
          {centerSub}
        </text>
      </svg>

      <div className="space-y-1.5 min-w-0 flex-1">
        {data.slice(0, 5).map((d, i) => {
          const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
          const isActive = hovered === i;
          return (
            <div
              key={d.label}
              className="flex items-center gap-1.5 py-0.5 px-1.5 rounded text-[11px] transition-colors cursor-default"
              style={{ background: isActive ? "rgba(214,207,193,0.08)" : "transparent" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="truncate text-muted-foreground">{d.label}</span>
              <span className="ml-auto font-mono font-bold tabular-nums text-foreground">{d.value}</span>
              <span className="text-[10px] font-mono text-muted-foreground">({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const ConsultorDistribuicaoCampoCard = memo(function ConsultorDistribuicaoCampoCard({
  tiposAcao,
  totalAcoes,
  visitas,
  clientes,
}: Props) {
  const tiposAcaoData = Object.entries(tiposAcao || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const acoesPorCliente = clientes > 0 ? (totalAcoes / clientes).toFixed(1) : "0";
  const visitasPorCliente = clientes > 0 ? (visitas / clientes).toFixed(1) : "0";

  return (
    <div
      className="rounded-2xl border p-5 flex flex-col justify-between h-full transition-all"
      style={{
        background: "var(--surface-raised)",
        borderColor: "var(--voux-card-border)",
        boxShadow: "var(--voux-card-shadow)",
      }}
    >
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3.5 pb-2.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
              <Compass className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground" style={{ fontFamily: "var(--voux-font-sans)" }}>
                Distribuição de Ações de Campo
              </h3>
              <p className="text-[10px] font-mono text-muted-foreground">
                Canais e tipos de contatos registrados no CRM
              </p>
            </div>
          </div>
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono text-muted-foreground bg-background">
            {totalAcoes} ações
          </span>
        </div>

        {/* Donut Chart */}
        {tiposAcaoData.length > 0 ? (
          <SimpleDonut
            data={tiposAcaoData.map((t, i) => ({
              label: t.name,
              value: t.value,
              color: EARTHY[i % EARTHY.length] as string,
            }))}
          />
        ) : (
          <p className="text-xs text-muted-foreground py-8 text-center">Nenhuma ação registrada no período.</p>
        )}
      </div>

      {/* Grid de Métricas de Campo no Rodapé */}
      <div className="pt-3 mt-3 border-t grid grid-cols-2 gap-2 text-[11px] font-mono" style={{ borderColor: "var(--voux-card-border)" }}>
        <div className="rounded-xl border p-2 bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
          <span className="text-muted-foreground text-[10px] flex items-center gap-1">
            <Compass className="h-3 w-3 text-amber-500" />
            Visitas Presenciais
          </span>
          <p className="font-bold text-foreground text-[15px] tabular-nums mt-0.5">{visitas}</p>
          <span className="text-[9px] text-muted-foreground">{visitasPorCliente} vis / cliente</span>
        </div>

        <div className="rounded-xl border p-2 bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
          <span className="text-muted-foreground text-[10px] flex items-center gap-1">
            <Users className="h-3 w-3 text-emerald-500" />
            Clientes Atendidos
          </span>
          <p className="font-bold text-foreground text-[15px] tabular-nums mt-0.5">{clientes}</p>
          <span className="text-[9px] text-muted-foreground">{acoesPorCliente} ações / cliente</span>
        </div>
      </div>
    </div>
  );
});
