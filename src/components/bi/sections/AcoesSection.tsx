import { useMemo } from "react";
import { ClipboardList, MapPin, Users, Eye, UserCheck, Tag } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { useAcoesBI } from "@/hooks/bi/useAcoesBI";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { KPICard } from "@/components/bi/KPICard";
import { ChartCard } from "@/components/bi/ChartCard";
import { HorizontalBarChart, VerticalBarChart, PieChartWithLabels } from "@/components/bi/charts";
import { CHART_COLORS } from "@/lib/chartTheme";

interface Props {
  active: boolean;
  dateRange?: DateRange;
  categoria?: string;
  funil?: string;
}

export default function AcoesSection({ active, dateRange, categoria, funil }: Props) {
  // Filtros vêm exclusivamente do topbar global (NegociosFilterContext) — sem barra duplicada.
  const { vendedor, cidade } = useNegociosFilter();

  const filters = useMemo(
    () => ({
      ano: "",
      mes: "",
      vendedor: vendedor || "",
      tipoAcao: "",
      cidade: cidade || "",
      dateRange,
    }),
    [vendedor, cidade, dateRange],
  );

  const { kpis, porVendedor, porCidade, porMes, porDiaSemana, porTipoAcao, porTipoContato, isLoading } =
    useAcoesBI(active, filters, categoria, funil);

  return (
    <div className="space-y-6 pt-2">


      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard title="Total de Acoes" value={kpis.totalAcoes.toLocaleString("pt-BR")} icon={ClipboardList} loading={isLoading} />
        <KPICard title="Cidades Atendidas" value={kpis.cidades.toLocaleString("pt-BR")} icon={MapPin} loading={isLoading} />
        <KPICard title="Consultores Ativos" value={kpis.consultores.toLocaleString("pt-BR")} icon={Users} loading={isLoading} />
        <KPICard title="Total de Visitas" value={kpis.visitas.toLocaleString("pt-BR")} icon={Eye} loading={isLoading} />
        <KPICard title="Clientes Unicos" value={kpis.clientes.toLocaleString("pt-BR")} icon={UserCheck} loading={isLoading} />
        <KPICard title="Tipos de Acao" value={kpis.tiposAcaoDistintos.toLocaleString("pt-BR")} icon={Tag} loading={isLoading} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Acoes por Consultor" description="Top 15 por volume" loading={isLoading}>
          <HorizontalBarChart
            data={porVendedor.map((d) => ({ name: d.name, acoes: d.acoes }))}
            keys={["acoes"]}
            seriesLabels={{ acoes: "Ações" }}
            title=""
            colors={[CHART_COLORS[0]]}
          />
        </ChartCard>

        <ChartCard title="Evolucao Mensal de Acoes" description="Quantidade por mes" loading={isLoading}>
          <VerticalBarChart
            data={porMes.map((d) => ({ name: d.name, acoes: d.acoes }))}
            keys={["acoes"]}
            seriesLabels={{ acoes: "Ações" }}
            title=""
            colors={[CHART_COLORS[0]]}
          />
        </ChartCard>

        <ChartCard title="Acoes por Cidade" description="Top 15 cidades" loading={isLoading}>
          <HorizontalBarChart
            data={porCidade.map((d) => ({ name: d.name, acoes: d.acoes }))}
            keys={["acoes"]}
            seriesLabels={{ acoes: "Ações" }}
            title=""
            colors={[CHART_COLORS[2]]}
          />
        </ChartCard>

        <ChartCard title="Distribuicao por Tipo de Acao" description="Proporcao de cada tipo" loading={isLoading}>
          <PieChartWithLabels data={porTipoAcao} title="" />
        </ChartCard>

        <ChartCard title="Acoes por Dia da Semana" description="Concentracao semanal" loading={isLoading}>
          <VerticalBarChart
            data={porDiaSemana.map((d) => ({ name: d.name, acoes: d.acoes }))}
            keys={["acoes"]}
            seriesLabels={{ acoes: "Ações" }}
            title=""
            colors={[CHART_COLORS[4]]}
          />
        </ChartCard>

        <ChartCard title="Tipo de Contato" description="Distribuicao dos canais" loading={isLoading}>
          <PieChartWithLabels data={porTipoContato} title="" />
        </ChartCard>
      </div>
    </div>
  );
}
