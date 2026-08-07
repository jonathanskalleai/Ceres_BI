import { useEffect, useMemo, useRef, useState } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import type { EChartsOption } from "echarts";
import echarts from "@/lib/echartsCore";
import { tooltipRow, baseAnimation } from "@/lib/chartTheme";
import { useChartTheme } from "@/hooks/useChartTheme";
import { ChartFrame } from "./ChartFrame";

const GEOJSON_URL =
  "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";

/** Mapeamento nome completo do GeoJSON -> sigla UF (2 letras) */
const STATE_TO_UF: Record<string, string> = {
  Acre: "AC", Alagoas: "AL", Amapá: "AP", Amazonas: "AM",
  Bahia: "BA", Ceará: "CE", "Distrito Federal": "DF",
  "Espírito Santo": "ES", Goiás: "GO", Maranhão: "MA",
  "Mato Grosso": "MT", "Mato Grosso do Sul": "MS",
  "Minas Gerais": "MG", Pará: "PA", Paraíba: "PB",
  Paraná: "PR", Pernambuco: "PE", Piauí: "PI",
  "Rio de Janeiro": "RJ", "Rio Grande do Norte": "RN",
  "Rio Grande do Sul": "RS", Rondônia: "RO", Roraima: "RR",
  "Santa Catarina": "SC", "São Paulo": "SP", Sergipe: "SE",
  Tocantins: "TO",
};

export interface BrazilHeatmapData {
  name: string;
  value: number;
}

export interface BrazilHeatmapProps {
  data: BrazilHeatmapData[];
  loading?: boolean;
  height?: number;
  tooltipFormatter?: (value: number) => string;
}

export default function BrazilHeatmap({
  data,
  loading = false,
  height,
  tooltipFormatter,
}: BrazilHeatmapProps) {
  const { tooltip, vars, isDark } = useChartTheme();
  const [mapReady, setMapReady] = useState(false);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) {
      setMapReady(true);
      return;
    }
    let cancelled = false;
    fetch(GEOJSON_URL)
      .then((r) => r.json())
      .then((geo) => {
        if (cancelled) return;
        // Normalizar names para sigla UF
        for (const feature of geo.features) {
          const fullName: string = feature.properties?.name ?? "";
          feature.properties.name = STATE_TO_UF[fullName] ?? fullName;
        }
        echarts.registerMap("brazil", geo);
        fetched.current = true;
        setMapReady(true);
      })
      .catch(() => {
        /* silencioso — ChartFrame mostra empty */
      });
    return () => { cancelled = true; };
  }, []);

  const option = useMemo<EChartsOption>(() => {
    if (!mapReady) return {};
    const maxVal = Math.max(...data.map((d) => d.value), 1);
    return {
      ...baseAnimation,
      tooltip: {
        ...tooltip,
        trigger: "item",
        formatter: (params) => {
          const p = params as { name: string; value: number; color: string };
          const val = Number(p.value) || 0;
          const formatted = tooltipFormatter
            ? tooltipFormatter(val)
            : val.toLocaleString("pt-BR");
          return tooltipRow(p.name, "Clientes", String(p.color), formatted);
        },
      },
      visualMap: {
        min: 0,
        max: maxVal,
        left: "left",
        bottom: 12,
        text: ["Mais", "Menos"],
        textStyle: { color: vars.axisText, fontSize: 11 },
        inRange: {
          // heatmap scale — no VOUX token equivalent (green intensity gradient)
          color: isDark
            ? ["#2a3215", "#3d5a1e", "#5a8c14", "#26a503"]
            : ["#e2daca", "#a8b88a", "#6b8e23", "#425a02"],
        },
        calculable: true,
        itemWidth: 12,
        itemHeight: 80,
      },
      series: [
        {
          type: "map",
          map: "brazil",
          roam: false,
          emphasis: {
            label: { show: true, color: vars.tooltipText, fontSize: 12 },
            // heatmap scale — no VOUX token equivalent (green highlight)
            itemStyle: { areaColor: isDark ? "#5a8c14" : "#6b8e23" },
          },
          itemStyle: {
            borderColor: isDark ? "rgba(219,201,169,0.2)" : "rgba(26,36,0,0.15)",
            borderWidth: 0.8,
          },
          label: { show: false },
          data: data.map((d) => ({ name: d.name, value: d.value })),
        },
      ],
    };
  }, [mapReady, data, tooltip, vars, isDark, tooltipFormatter]);

  return (
    <ChartFrame loading={loading || !mapReady} isEmpty={!data.length} height={height}>
      {mapReady && (
        <ReactEChartsCore
          echarts={echarts}
          option={option}
          style={{ height: "100%", width: "100%" }}
          notMerge
          lazyUpdate
          opts={{ renderer: "canvas" }}
        />
      )}
    </ChartFrame>
  );
}
