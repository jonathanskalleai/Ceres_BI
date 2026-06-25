import { Users, UserCheck, UserPlus, Globe, Briefcase, Building2 } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { useAdminBIRpc } from "@/hooks/bi/useAdminBIRpc";
import { KPICard } from "@/components/bi/KPICard";
import { ChartCard } from "@/components/bi/ChartCard";
import { HorizontalBarChart, PieChartWithLabels, BrazilHeatmap } from "@/components/bi/charts";
import { CHART_COLORS, POSITIVE_COLOR } from "@/lib/chartTheme";
import type { RpcAdminBI } from "@/types/biRpc";

const EMPTY: RpcAdminBI = {
  kpis: { totalClientes: 0, prospects: 0, ativos: 0, ufsCobertas: 0, consultoresCarteira: 0, empresas: 0 },
  prospectVsAtivo: [], porTipoCliente: [], porUF: [], porConsultor: [],
};

interface Props {
  active: boolean;
  dateRange?: DateRange;
}

export default function AdminSection({ active, dateRange }: Props) {
  const { data, isLoading } = useAdminBIRpc({ enabled: active });
  const agg = data ?? EMPTY;
  const { kpis } = agg;

  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard title="Clientes na Carteira" value={kpis.totalClientes.toLocaleString("pt-BR")} icon={Users} loading={isLoading} />
        <KPICard title="Clientes Ativos" value={kpis.ativos.toLocaleString("pt-BR")} icon={UserCheck} loading={isLoading} />
        <KPICard title="Prospects" value={kpis.prospects.toLocaleString("pt-BR")} icon={UserPlus} loading={isLoading} hint="oportunidades a converter" />
        <KPICard title="UFs Cobertas" value={kpis.ufsCobertas.toLocaleString("pt-BR")} icon={Globe} loading={isLoading} />
        <KPICard title="Consultores" value={kpis.consultoresCarteira.toLocaleString("pt-BR")} icon={Briefcase} loading={isLoading} hint="com carteira ativa" />
        <KPICard title="Empresas/Filiais" value={kpis.empresas.toLocaleString("pt-BR")} icon={Building2} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Prospects vs Clientes Ativos" description="Composicao da carteira" loading={isLoading}>
          <PieChartWithLabels
            data={[
              { id: 'ativos', value: agg.prospectVsAtivo[0]?.value || 0, name: 'Clientes Ativos' },
              { id: 'prospects', value: agg.prospectVsAtivo[1]?.value || 0, name: 'Prospects' }
            ]}
            title=""
            colors={[POSITIVE_COLOR, CHART_COLORS[1]]}
          />
        </ChartCard>

        <ChartCard title="Cobertura Geografica" description="Clientes por UF" loading={isLoading}>
          <BrazilHeatmap
            data={agg.porUF.map(item => ({ name: item.name, value: item.value }))}
          />
        </ChartCard>

        <ChartCard title="Carteira por Consultor" description="Top 10 por numero de clientes" loading={isLoading}>
          <HorizontalBarChart
            data={agg.porConsultor.map(item => ({ name: item.name, value: item.value }))}
            keys={['value']}
            seriesLabels={{ value: "Clientes" }}
            title=""
            colors={[CHART_COLORS[2]]}
          />
        </ChartCard>

        <ChartCard title="Classificação de Clientes" description="Conforme Campus Dealer (sistema origem) — maioria ainda sem classificação no ERP" loading={isLoading}>
          <HorizontalBarChart
            data={agg.porTipoCliente.filter(item => item.name !== "Sem classificação" && item.name !== "").map(item => ({ name: item.name, value: item.value }))}
            keys={['value']}
            seriesLabels={{ value: "Clientes" }}
            title=""
            colors={[CHART_COLORS[4]]}
          />
        </ChartCard>
      </div>
    </div>
  );
}
