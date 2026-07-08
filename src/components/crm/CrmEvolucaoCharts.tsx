import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart } from "@/components/bi/charts";
import { formatMonthYear } from "@/lib/dateUtils";
import { startOfMonth, subMonths, format } from "date-fns";
import {
  useEvolucaoMensal,
  useEvolucaoNegocios12m,
  useEvolucaoTiposAcao12m,
} from "@/hooks/useComercialRpc";

const formatCurrency = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : `R$ ${(v / 1e3).toFixed(0)}K`;

/** Short month label: "2026-07" → "jul/26" */
const fmtShort = (ym: string) => formatMonthYear(ym).replace(/\/20(\d{2})$/, "/$1");

/**
 * CrmEvolucaoCharts — 5 line charts for the "Graficos" tab.
 * Self-contained: fetches its own data via hooks.
 */
export default function CrmEvolucaoCharts() {
  // 12-month rolling window
  const evoFrom = useMemo(
    () => format(subMonths(startOfMonth(new Date()), 11), "yyyy-MM-dd"),
    [],
  );
  const evoTo = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  // ─── Hooks ────────────────────────────────────────────────────────────
  const { data: evolucao, isLoading: evolLoading } = useEvolucaoMensal({
    from: evoFrom,
    to: evoTo,
    enabled: true,
  });

  const { data: negocios, isLoading: negLoading } = useEvolucaoNegocios12m({
    enabled: true,
  });

  const { data: tiposRaw, isLoading: tiposLoading } = useEvolucaoTiposAcao12m({
    enabled: true,
  });

  // ─── Derived data ─────────────────────────────────────────────────────
  const evoData = useMemo(() => evolucao?.slice(-12) ?? [], [evolucao]);

  const negociosSeries = useMemo(() => {
    if (!negocios) return [];
    return [
      { name: "Total", data: negocios.map((d) => ({ x: fmtShort(d.mes), y: d.total })) },
      { name: "Ganhos", data: negocios.map((d) => ({ x: fmtShort(d.mes), y: d.ganhos })) },
      { name: "Perdidos", data: negocios.map((d) => ({ x: fmtShort(d.mes), y: d.perdidos })) },
    ];
  }, [negocios]);

  const tiposSeries = useMemo(() => {
    if (!tiposRaw || tiposRaw.length === 0) return [];
    // Pivot flat rows into series per tipo_acao
    const seriesMap = new Map<string, { x: string; y: number }[]>();
    for (const row of tiposRaw) {
      if (!seriesMap.has(row.tipo_acao)) seriesMap.set(row.tipo_acao, []);
      seriesMap.get(row.tipo_acao)!.push({ x: fmtShort(row.mes), y: row.total });
    }
    return Array.from(seriesMap.entries()).map(([name, data]) => ({ name, data }));
  }, [tiposRaw]);

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* 1. Evolucao Acoes */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Evolucao Acoes (12m)</CardTitle>
        </CardHeader>
        <CardContent>
          <LineChart
            series={[{ name: "Acoes", data: evoData.map((d) => ({ x: fmtShort(d.mes), y: d.acoes })) }]}
            height={260}
            loading={evolLoading}
          />
        </CardContent>
      </Card>

      {/* 2. Evolucao Visitas */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Evolucao Visitas (12m)</CardTitle>
        </CardHeader>
        <CardContent>
          <LineChart
            series={[{ name: "Visitas", data: evoData.map((d) => ({ x: fmtShort(d.mes), y: d.visitas })) }]}
            height={260}
            loading={evolLoading}
          />
        </CardContent>
      </Card>

      {/* 3. Negocios: Ganhos vs Perdidos */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Negocios: Ganhos vs Perdidos (12m)</CardTitle>
        </CardHeader>
        <CardContent>
          <LineChart
            series={negociosSeries}
            height={260}
            loading={negLoading}
          />
        </CardContent>
      </Card>

      {/* 4. Valor Pipeline */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Valor Pipeline (12m)</CardTitle>
        </CardHeader>
        <CardContent>
          <LineChart
            series={[{ name: "Valor", data: evoData.map((d) => ({ x: fmtShort(d.mes), y: d.valor })) }]}
            height={260}
            loading={evolLoading}
            tooltipFormatter={formatCurrency}
          />
        </CardContent>
      </Card>

      {/* 5. Tipos de Acao (multi-serie) */}
      <Card className="border-0 shadow-sm lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Tipos de Acao por Mes (Top 8)</CardTitle>
        </CardHeader>
        <CardContent>
          <LineChart
            series={tiposSeries}
            height={300}
            loading={tiposLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}
