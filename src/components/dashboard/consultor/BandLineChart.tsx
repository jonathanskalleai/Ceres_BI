import { useRef, useState } from "react";
import { useContainerWidth } from "@/components/bi/charts/primitives/useContainerWidth";
import { getVouxPalette, fmtCompact } from "@/components/bi/charts/primitives/svgGeometry";
import { useTheme } from "@/hooks/useTheme";

export interface BandLineSeries {
  name: string;
  values: (number | null)[];
  color?: string;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  idx: number;
}

interface Props {
  labels: string[];
  series: BandLineSeries[];
  height?: number;
  valueFmt?: (v: number) => string;
}

/**
 * Multi-axis overlay line chart — inspirado no estilo Forte/dashboard.
 * 
 * Cada série tem seu próprio eixo Y normalizado independente, mas todas
 * compartilham o mesmo espaço vertical. A primeira série fica no topo,
 * a segunda no meio, a terceira embaixo — sem se cruzar, porque cada
 * uma é escalada para ocupar uma "faixa visual" do gráfico.
 * 
 * Resultado: linhas grudadas com area fill, sobrepostas, interativas.
 */
export function BandLineChart({ labels, series, height = 200, valueFmt = fmtCompact }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(containerRef as React.RefObject<HTMLElement>);
  const { isDark } = useTheme();
  const palette = getVouxPalette(isDark);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, idx: 0 });

  if (width === 0 || series.length === 0 || labels.length === 0) {
    return <div ref={containerRef} style={{ width: "100%", height }} />;
  }

  const n = labels.length;
  const padL = 8;
  const padR = 8;
  const padT = 6;
  const padB = 24;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const xPos = (i: number) =>
    n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW;

  const bandCount = series.length;

  // Cada série ocupa uma faixa visual do gráfico, com leve overlap
  // Série 0 (topo): topo do gráfico até ~45%
  // Série 1 (meio): ~25% até ~80%
  // Série 2 (baixo): ~55% até 100%
  // Com 2 séries: série 0 → 0-55%, série 1 → 35-100%
  const getSeriesBounds = (sIdx: number) => {
    if (bandCount === 1) return { top: 0, bottom: plotH };
    if (bandCount === 2) {
      // Overlap de ~10% para ficar grudado
      const topFrac = sIdx === 0 ? 0 : 0.45;
      const bottomFrac = sIdx === 0 ? 0.60 : 1.0;
      return { top: plotH * topFrac, bottom: plotH * bottomFrac };
    }
    // 3+ séries
    const overlap = 0.1;
    const bandSize = (1 + overlap * (bandCount - 1)) / bandCount;
    const topFrac = sIdx * (bandSize - overlap);
    const bottomFrac = topFrac + bandSize;
    return { top: plotH * topFrac, bottom: plotH * Math.min(bottomFrac, 1) };
  };

  // Pre-compute stats
  const seriesStats = series.map((s) => {
    const vals = s.values.map((v) => v ?? 0);
    const sMin = Math.min(...vals);
    const sMax = Math.max(...vals);
    return { vals, sMin, sMax, range: sMax - sMin || 1 };
  });

  const getY = (sIdx: number, v: number) => {
    const { sMin, range } = seriesStats[sIdx];
    const { top, bottom } = getSeriesBounds(sIdx);
    const bandH = bottom - top;
    const innerPad = bandH * 0.1;
    const normalized = (v - sMin) / range;
    // Inverte: alto = topo
    return padT + top + innerPad + (1 - normalized) * (bandH - innerPad * 2);
  };

  return (
    <div ref={containerRef} style={{ width: "100%", position: "relative" }}>
      {/* Legenda */}
      <div
        style={{
          display: "flex",
          gap: 14,
          marginBottom: 4,
          flexWrap: "wrap",
        }}
      >
        {series.map((s, i) => (
          <div
            key={s.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontFamily: "var(--voux-font-mono)",
              fontSize: 10,
              color: "var(--voux-text-muted)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: s.color ?? palette[i % palette.length],
                flexShrink: 0,
              }}
            />
            {s.name}
          </div>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        aria-hidden="true"
        style={{ overflow: "visible", cursor: "crosshair" }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const mouseX = e.clientX - rect.left;
          const idx = Math.round(((mouseX - padL) / plotW) * (n - 1));
          setTooltip({ visible: true, x: e.clientX, y: e.clientY, idx: Math.max(0, Math.min(n - 1, idx)) });
        }}
        onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
      >
        <defs>
          {series.map((s, sIdx) => {
            const color = s.color ?? palette[sIdx % palette.length];
            return (
              <linearGradient key={sIdx} id={`overlay-fill-${sIdx}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0.06} />
              </linearGradient>
            );
          })}
        </defs>

        {/* Renderizar de trás para frente (primeira série no topo = renderiza por último) */}
        {[...series].reverse().map((s, revIdx) => {
          const sIdx = series.length - 1 - revIdx;
          const color = s.color ?? palette[sIdx % palette.length];
          const { vals } = seriesStats[sIdx];
          const { bottom } = getSeriesBounds(sIdx);
          const baseline = padT + bottom;

          // Line path
          let pathD = "";
          vals.forEach((v, i) => {
            pathD += `${i === 0 ? "M" : "L"} ${xPos(i)} ${getY(sIdx, v)} `;
          });

          // Area closes to baseline
          const areaD = pathD + `L ${xPos(n - 1)} ${baseline} L ${xPos(0)} ${baseline} Z`;

          return (
            <g key={sIdx}>
              <path d={areaD} fill={`url(#overlay-fill-${sIdx})`} stroke="none" />
              <path
                d={pathD}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Value labels */}
              {vals.map((v, i) => {
                const step = n > 8 ? 2 : 1;
                if (step > 1 && i % step !== 0 && i !== n - 1) return null;
                const cy = getY(sIdx, v);
                return (
                  <g key={i}>
                    <circle cx={xPos(i)} cy={cy} r={2.5} fill={color} stroke="#fff" strokeWidth={1} />
                    <text
                      x={xPos(i)}
                      y={cy - 9}
                      textAnchor="middle"
                      fontFamily="var(--voux-font-mono)"
                      fontSize={9}
                      fontWeight={600}
                      fill="var(--voux-text-primary)"
                      opacity={0.8}
                    >
                      {valueFmt(v)}
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Crosshair */}
        {tooltip.visible && (
          <line
            x1={xPos(tooltip.idx)}
            x2={xPos(tooltip.idx)}
            y1={padT}
            y2={padT + plotH}
            stroke="var(--voux-text-muted)"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.3}
          />
        )}

        {/* X labels */}
        {labels.map((lbl, i) => {
          const step = n > 8 ? 2 : 1;
          if (step > 1 && i % step !== 0 && i !== n - 1) return null;
          return (
            <text
              key={i}
              x={xPos(i)}
              y={height - 4}
              textAnchor="middle"
              fontFamily="var(--voux-font-mono)"
              fontSize={9}
              fill="var(--voux-text-muted)"
              letterSpacing="0.04em"
            >
              {lbl}
            </text>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x + 14,
            top: tooltip.y - 10,
            background: "var(--voux-tooltip-bg)",
            border: "1px solid var(--voux-tooltip-border)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            padding: "8px 12px",
            borderRadius: 10,
            fontFamily: "var(--voux-font-mono)",
            fontSize: 11,
            color: "var(--voux-tooltip-text)",
            pointerEvents: "none",
            zIndex: 9999,
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ fontSize: 10, color: "var(--voux-tooltip-muted)", letterSpacing: "0.08em", marginBottom: 4 }}>
            {labels[tooltip.idx]}
          </div>
          {series.map((s, sIdx) => {
            const color = s.color ?? palette[sIdx % palette.length];
            const v = seriesStats[sIdx].vals[tooltip.idx];
            return (
              <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ color: "var(--voux-tooltip-muted)" }}>
                  {s.name}:{" "}
                  <strong style={{ color: "var(--voux-tooltip-text)" }}>{valueFmt(v)}</strong>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
