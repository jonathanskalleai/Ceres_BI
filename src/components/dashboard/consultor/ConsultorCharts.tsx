import { useState } from "react";
import { ChartCard } from "@/components/bi/ChartCard";
import { LineChart } from "@/components/bi/charts";
import { formatMonthYear } from "@/lib/dateUtils";
import type { EvolucaoMensal, RegiaoVendedor } from "@/types/comercial";

interface Props {
  evolucao: EvolucaoMensal[];
  tiposAcao: Record<string, number>;
  regioes: RegiaoVendedor[];
}

/** Paleta terrosa sóbria (referência: coral → âmbar → slate → sage → verde) */
const EARTHY = ["#c97565", "#d4a05a", "#8ea3b8", "#7a9b6f", "#4caf7a", "#6e542f", "#d4b896"] as const;

// ─── Bar horizontal com hover interativo ───
function HBar({ label, value, max, color, pct, active, onEnter, onLeave }: {
  label: string; value: number; max: number; color: string; pct: string;
  active: boolean; onEnter: () => void; onLeave: () => void;
}) {
  const w = max > 0 ? Math.max((value / max) * 100, 2) : 0;
  return (
    <div
      className="flex items-center gap-3 py-1.5 px-2 rounded-lg transition-colors duration-150 cursor-default"
      style={{ background: active ? "rgba(214,207,193,0.08)" : "transparent" }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <span
        className="w-[100px] shrink-0 text-[12px] truncate transition-colors duration-150"
        style={{ fontFamily: "var(--voux-font-sans)", color: active ? "var(--voux-text-primary)" : "var(--voux-text-muted)" }}
      >
        {label}
      </span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(214,207,193,0.1)" }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${w}%`, background: color, opacity: active ? 1 : 0.8 }}
        />
      </div>
      <span
        className="w-[48px] text-right text-[12px] font-semibold tabular-nums shrink-0 transition-colors duration-150"
        style={{ fontFamily: "var(--voux-font-mono)", color: active ? color : "var(--voux-text-primary)" }}
      >
        {value}
      </span>
      <span
        className="w-[44px] text-right text-[11px] tabular-nums shrink-0"
        style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}
      >
        {pct}
      </span>
    </div>
  );
}

// ─── Donut SVG interativo (hover destaca segmento + tooltip) ───
function SimpleDonut({ data, size = 140, thickness = 16 }: { data: { label: string; value: number; color: string }[]; size?: number; thickness?: number }) {
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

  const centerLabel = hovered !== null
    ? `${(arcs[hovered].pct * 100).toFixed(0)}%`
    : String(total);

  return (
    <div className="flex items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 cursor-pointer">
        {/* Track */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(214,207,193,0.1)" strokeWidth={thickness} />
        {/* Segments */}
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={hovered === i ? thickness + 6 : thickness}
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
        {/* Center label */}
        <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="central"
          style={{ fontFamily: "var(--voux-font-mono)", fontSize: 16, fontWeight: 700, fill: "var(--voux-text-primary)" }}>
          {centerLabel}
        </text>
        {hovered !== null && (
          <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="central"
            style={{ fontFamily: "var(--voux-font-sans)", fontSize: 10, fill: "var(--voux-text-faint)" }}>
            {arcs[hovered].label}
          </text>
        )}
        {hovered === null && (
          <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="central"
            style={{ fontFamily: "var(--voux-font-mono)", fontSize: 10, fill: "var(--voux-text-faint)" }}>
            total
          </text>
        )}
      </svg>
      {/* Legend */}
      <div className="space-y-1.5">
        {data.map((d, i) => {
          const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
          const isActive = hovered === i;
          return (
            <div
              key={d.label}
              className="flex items-center gap-2 py-0.5 px-1.5 rounded transition-colors duration-150 cursor-default"
              style={{ background: isActive ? "rgba(214,207,193,0.08)" : "transparent" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
              <span
                className="text-[12px] transition-colors duration-150"
                style={{ fontFamily: "var(--voux-font-sans)", color: isActive ? "var(--voux-text-primary)" : "var(--voux-text-muted)" }}
              >
                {d.label}
              </span>
              <span
                className="text-[12px] font-semibold tabular-nums ml-auto transition-colors duration-150"
                style={{ fontFamily: "var(--voux-font-mono)", color: isActive ? d.color : "var(--voux-text-primary)" }}
              >
                {d.value}
              </span>
              <span className="text-[11px] tabular-nums" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>
                ({pct}%)
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ConsultorCharts({ evolucao, tiposAcao, regioes }: Props) {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const tiposAcaoData = Object.entries(tiposAcao)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const totalAcoes = tiposAcaoData.reduce((s, d) => s + d.value, 0);
  const maxRegiao = Math.max(...regioes.map((r) => r.acoes), 1);

  return (
    <div className="space-y-4">
      {/* Evolução mensal — mesmo gráfico, cada linha com seu próprio eixo */}
      <ChartCard
        title="Evolução Mensal"
        description="Ações e visitas por mês — cada linha com escala própria"
        label="EVOLUÇÃO · PERÍODO"
        height={300}
      >
        <LineChart
          series={[
            { name: "Ações", data: evolucao.map((d) => ({ x: formatMonthYear(d.YearMonth), y: d.acoes })), color: "#4caf7a" },
            { name: "Visitas", data: evolucao.map((d) => ({ x: formatMonthYear(d.YearMonth), y: d.visitas })), color: "#d4a05a" },
          ]}
          height={300}
          independentAxes
        />
      </ChartCard>

      {/* Tipos de ação (donut interativo) + Regiões (barras interativas) */}
      <div className="grid lg:grid-cols-2 gap-4">
        {tiposAcaoData.length > 0 && (
          <div
            className="rounded-2xl border p-5"
            style={{ borderColor: "var(--voux-card-border)", background: "var(--surface-raised)" }}
          >
            <p
              className="text-[10px] tracking-[0.08em] uppercase font-semibold mb-1"
              style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}
            >
              TIPO DE AÇÃO
            </p>
            <h3
              className="text-base font-semibold mb-4"
              style={{ fontFamily: "var(--voux-font-display)", color: "var(--voux-text-heading)" }}
            >
              Distribuição por tipo
            </h3>
            <SimpleDonut
              data={tiposAcaoData.map((t, i) => ({
                label: t.name,
                value: t.value,
                color: EARTHY[i % EARTHY.length] as string,
              }))}
            />
          </div>
        )}

        {regioes.length > 0 && (
          <div
            className="rounded-2xl border p-5"
            style={{ borderColor: "var(--voux-card-border)", background: "var(--surface-raised)" }}
          >
            <p
              className="text-[10px] tracking-[0.08em] uppercase font-semibold mb-1"
              style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}
            >
              POR CIDADE
            </p>
            <h3
              className="text-base font-semibold mb-4"
              style={{ fontFamily: "var(--voux-font-display)", color: "var(--voux-text-heading)" }}
            >
              Regiões de atuação
            </h3>
            <div>
              {regioes.slice(0, 8).map((r, i) => (
                <HBar
                  key={r.cidade}
                  label={r.cidade}
                  value={r.acoes}
                  max={maxRegiao}
                  color={EARTHY[i % EARTHY.length] as string}
                  pct={totalAcoes > 0 ? `${((r.acoes / totalAcoes) * 100).toFixed(1)}%` : "—"}
                  active={hoveredBar === i}
                  onEnter={() => setHoveredBar(i)}
                  onLeave={() => setHoveredBar(null)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
