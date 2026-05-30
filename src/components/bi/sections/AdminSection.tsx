import { Users, UserCheck, UserPlus, Globe, Briefcase, Building2 } from "lucide-react";
import { useAdminData } from "@/hooks/bi/useAdminData";
import { KPICard } from "@/components/bi/KPICard";
import { ChartCard } from "@/components/bi/ChartCard";
import { NivoHorizontalBarChart } from "@/components/bi/nivo/NivoBarChart";
import { NivoPieChartWithLabels } from "@/components/bi/nivo/NivoPieChart";
import { NIVO_COLORS, POSITIVE_COLOR } from "@/lib/nivoTheme";

interface Props {
  active: boolean;
}

export default function AdminSection({ active }: Props) {
  const { agg, isLoading } = useAdminData(active);
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
          <NivoPieChartWithLabels
            data={[
              { id: 'ativos', value: agg.prospectVsAtivo[0]?.value || 0, name: 'Clientes Ativos' },
              { id: 'prospects', value: agg.prospectVsAtivo[1]?.value || 0, name: 'Prospects' }
            ]}
            title=""
            colors={[POSITIVE_COLOR, NIVO_COLORS[1]]}
          />
        </ChartCard>

        <ChartCard title="Cobertura Geografica" description="Clientes por UF" loading={isLoading}>
          <NivoHorizontalBarChart
            data={agg.porUF.map(item => ({ name: item.name, value: item.value }))}
            keys={['value']}
            title=""
            colors={[NIVO_COLORS[0]]}
          />
        </ChartCard>

        <ChartCard title="Carteira por Consultor" description="Top 10 por numero de clientes" loading={isLoading}>
          <NivoHorizontalBarChart
            data={agg.porConsultor.map(item => ({ name: item.name, value: item.value }))}
            keys={['value']}
            title=""
            colors={[NIVO_COLORS[2]]}
          />
        </ChartCard>

        <ChartCard title="Classificacao de Clientes" description="Distribuicao por tipo (A/B/C/D)" loading={isLoading}>
          <NivoHorizontalBarChart
            data={agg.porTipoCliente.map(item => ({ name: item.name, value: item.value }))}
            keys={['value']}
            title=""
            colors={[NIVO_COLORS[4]]}
          />
        </ChartCard>
      </div>
    </div>
  );
}
