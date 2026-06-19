import { useRef, useState, useCallback } from "react";
import { ChartFrame } from "./ChartFrame";
import { SvgBarH } from "./primitives/SvgBarH";
import { SvgBarV } from "./primitives/SvgBarV";
import { useContainerWidth } from "./primitives/useContainerWidth";
import { VOUX_COLORS, getVouxPalette, fmtCompact } from "./primitives/svgGeometry";
import { useTheme } from "@/hooks/useTheme";

export interface BarChartData {
  name: string;
  [key: string]: string | number;
}

export interface BarChartProps {
  data: BarChartData[];
  layout?: "horizontal" | "vertical";
  keys: string[];
  colors?: readonly string[];
  /** Cor individual por dataIndex — sobrescreve `colors` quando definido */
  itemColors?: string[];
  title?: string;
  /** Labels amigáveis para cada key */
  seriesLabels?: Record<string, string>;
  height?: number;
  loading?: boolean;
  tooltipFormatter?: (value: number, datum?: BarChartData) => string;
  groupMode?: "grouped" | "stacked";
  onBarClick?: (datum: BarChartData, index: number) => void;
}

// ── Tooltip ────────────────────────────────────────────────────────────────────
interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  content: string;
}

function Tooltip({ state }: { state: TooltipState }) {
  if (!state.visible) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: state.x + 14,
        top: state.y - 10,
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
      dangerouslySetInnerHTML={{ __html: state.content }}
    />
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function resolveColor(
  keyIndex: number,
  dataIndex: number,
  colors: readonly string[],
  itemColors?: string[],
): string {
  if (itemColors) return itemColors[dataIndex % itemColors.length];
  return colors[keyIndex % colors.length];
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function BarChart({
  data,
  layout = "vertical",
  keys,
  colors,
  itemColors,
  seriesLabels,
  height,
  loading = false,
  tooltipFormatter,
  groupMode = "grouped",
  onBarClick,
}: BarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = useContainerWidth(containerRef as React.RefObject<HTMLElement>);
  const { isDark } = useTheme();
  const palette = colors ?? getVouxPalette(isDark);

  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    content: "",
  });

  const fmt = useCallback(
    (v: number, datum?: BarChartData) =>
      tooltipFormatter ? tooltipFormatter(v, datum) : v.toLocaleString("pt-BR"),
    [tooltipFormatter],
  );

  const isEmpty = data.length === 0;

  // ── Horizontal layout ───────────────────────────────────────────────────────
  if (layout === "horizontal") {
    return (
      <ChartFrame loading={loading} isEmpty={isEmpty} height={height}>
        <div ref={containerRef} style={{ width: "100%", position: "relative" }}>
          {keys.map((key, ki) => {
            const color = resolveColor(ki, 0, palette, itemColors);
            const seriesData = data.map((d, di) => ({
              label: String(d.name),
              value: Number(d[key] ?? 0),
              _datum: d,
              _idx: di,
            }));
            const globalMax =
              groupMode === "stacked"
                ? Math.max(
                    ...data.map((d) =>
                      keys.reduce((s, k) => s + Number(d[k] ?? 0), 0),
                    ),
                    1,
                  )
                : undefined;
            return (
              <div key={key} style={{ marginBottom: keys.length > 1 ? 12 : 0 }}>
                {keys.length > 1 && (
                  <div
                    style={{
                      fontFamily: "var(--voux-font-mono)",
                      fontSize: 10,
                      color: VOUX_COLORS.inkMuted,
                      letterSpacing: "0.10em",
                      marginBottom: 4,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: itemColors ? palette[0] : color,
                      }}
                    />
                    {seriesLabels?.[key] ?? key}
                  </div>
                )}
                <SvgBarH
                  width={width}
                  data={seriesData.map((sd) => ({
                    label: sd.label,
                    value: sd.value,
                  }))}
                  color={itemColors ? resolveColor(ki, 0, palette, itemColors) : color}
                  valueFormatter={(v) => fmt(v)}
                  max={globalMax}
                  onBarEnter={(di, x, y, label, value) => {
                    const datum = data[di];
                    const formatted = fmt(value, datum);
                    const keyLabel = seriesLabels?.[key] ?? key;
                    setTooltip({
                      visible: true,
                      x,
                      y,
                      content: `<div style="font-size:10px;color:${VOUX_COLORS.inkMuted};margin-bottom:3px;text-transform:uppercase;letter-spacing:0.1em">${keyLabel}</div><div style="font-size:13px;color:${VOUX_COLORS.ink}"><strong>${label}</strong>: ${formatted}</div>`,
                    });
                  }}
                  onBarLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
                  onBarClick={onBarClick ? (di) => onBarClick(data[di], di) : undefined}
                />
              </div>
            );
          })}
          <Tooltip state={tooltip} />
        </div>
      </ChartFrame>
    );
  }

  // ── Vertical layout ─────────────────────────────────────────────────────────
  const labels = data.map((d) => String(d.name));
  const chartH = height ?? 220;

  if (groupMode === "stacked") {
    // Stacked: render as grouped SvgBarV sections stacked (simplified for v1)
    // Each key becomes its own row of bars rendered below each other
    return (
      <ChartFrame loading={loading} isEmpty={isEmpty} height={height}>
        <div ref={containerRef} style={{ width: "100%", position: "relative" }}>
          {keys.map((key, ki) => {
            const color = resolveColor(ki, 0, palette, itemColors);
            const values = data.map((d) => Number(d[key] ?? 0));
            return (
              <div key={key}>
                {keys.length > 1 && (
                  <div
                    style={{
                      fontFamily: "var(--voux-font-mono)",
                      fontSize: 10,
                      color: VOUX_COLORS.inkMuted,
                      letterSpacing: "0.10em",
                      marginBottom: 4,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: color,
                      }}
                    />
                    {seriesLabels?.[key] ?? key}
                  </div>
                )}
                <SvgBarV
                  width={width}
                  height={Math.round(chartH / Math.max(keys.length, 1))}
                  labels={ki === keys.length - 1 ? labels : labels.map(() => "")}
                  values={values}
                  color={color}
                  onBarEnter={(di, x, y, label, value) => {
                    const datum = data[di];
                    const formatted = fmt(value, datum);
                    const keyLabel = seriesLabels?.[key] ?? key;
                    setTooltip({
                      visible: true,
                      x,
                      y,
                      content: `<div style="font-size:10px;color:${VOUX_COLORS.inkMuted};margin-bottom:3px;text-transform:uppercase;letter-spacing:0.1em">${keyLabel}</div><div style="font-size:13px;color:${VOUX_COLORS.ink}"><strong>${label}</strong>: ${formatted}</div>`,
                    });
                  }}
                  onBarLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
                  onBarClick={onBarClick ? (di) => onBarClick(data[di], di) : undefined}
                />
              </div>
            );
          })}
        </div>
      </ChartFrame>
    );
  }

  // Grouped / single-key vertical
  return (
    <ChartFrame loading={loading} isEmpty={isEmpty} height={height}>
      <div ref={containerRef} style={{ width: "100%", position: "relative" }}>
        {/* Single-series legend when seriesLabels is provided */}
        {keys.length === 1 && seriesLabels && seriesLabels[keys[0]] && (
          <div
            style={{
              fontFamily: "var(--voux-font-mono)",
              fontSize: 10,
              color: VOUX_COLORS.inkMuted,
              letterSpacing: "0.10em",
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              gap: 6,
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                backgroundColor: resolveColor(0, 0, colors, itemColors),
              }}
            />
            {seriesLabels[keys[0]]}
          </div>
        )}
        {keys.map((key, ki) => {
          const color = resolveColor(ki, 0, palette, itemColors);
          const values = data.map((d) => Number(d[key] ?? 0));
          return (
            <div key={key}>
              {keys.length > 1 && (
                <div
                  style={{
                    fontFamily: "var(--voux-font-mono)",
                    fontSize: 10,
                    color: VOUX_COLORS.inkMuted,
                    letterSpacing: "0.10em",
                    marginBottom: 4,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: color,
                    }}
                  />
                  {seriesLabels?.[key] ?? key}
                </div>
              )}
              <SvgBarV
                width={width}
                height={Math.round(chartH / Math.max(keys.length, 1))}
                labels={ki === keys.length - 1 ? labels : labels.map(() => "")}
                values={values}
                color={color}
                onBarEnter={(di, x, y, label, value) => {
                  const datum = data[di];
                  const formatted = fmt(value, datum);
                  const keyLabel = seriesLabels?.[key] ?? key;
                  setTooltip({
                    visible: true,
                    x,
                    y,
                    content: `<div style="font-size:10px;color:${VOUX_COLORS.inkMuted};margin-bottom:3px;text-transform:uppercase;letter-spacing:0.1em">${keyLabel}</div><div style="font-size:13px;color:${VOUX_COLORS.ink}"><strong>${label}</strong>: ${formatted}</div>`,
                  });
                }}
                onBarLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
                onBarClick={onBarClick ? (di) => onBarClick(data[di], di) : undefined}
              />
            </div>
          );
        })}
        <Tooltip state={tooltip} />
      </div>
    </ChartFrame>
  );
}

// ── Convenience wrappers (maintain existing API) ───────────────────────────────
export function VerticalBarChart(
  props: Omit<BarChartProps, "layout" | "groupMode">,
) {
  return <BarChart {...props} layout="vertical" />;
}

export function HorizontalBarChart(
  props: Omit<BarChartProps, "layout" | "groupMode">,
) {
  return <BarChart {...props} layout="horizontal" />;
}

export function StackedBarChart(props: Omit<BarChartProps, "layout">) {
  return <BarChart {...props} layout="vertical" groupMode="stacked" />;
}
