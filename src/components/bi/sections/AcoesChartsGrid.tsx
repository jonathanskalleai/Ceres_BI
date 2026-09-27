import { ChartCard } from "@/components/bi/ChartCard";
import { HorizontalBarChart, VerticalBarChart, type BarChartData } from "@/components/bi/charts/BarChart";
import LineChart from "@/components/bi/charts/LineChart";
import { CHART_COLORS } from "@/lib/chartPalette";
import { formatMonthYear } from "@/lib/dateUtils";
import type {
  AcoesBIEvolucaoMensalAnoCorrente,
  AcoesBINameAcoes,
  AcoesBIPieDatum,
  RpcClientesRisco,
} from "@/types/biRpc";

interface AcoesChartsGridProps {
  porVendedor: AcoesBINameAcoes[];
  porCidade: AcoesBINameAcoes[];
  porTipoAcao: AcoesBIPieDatum[];
  evolucaoMensal: AcoesBIEvolucaoMensalAnoCorrente[];
  riscoData?: RpcClientesRisco;
  isLoading: boolean;
  evolucaoMensalLoading: boolean;
  riscoLoading: boolean;
  coreError: Error | null;
  riscoError: Error | null;
  onFaixaClick: (datum: BarChartData) => void;
}

export function AcoesChartsGrid({
  porVendedor,
  porCidade,
  porTipoAcao,
  evolucaoMensal,
  riscoData,
  isLoading,
  evolucaoMensalLoading,
  riscoLoading,
  coreError,
  riscoError,
  onFaixaClick,
}: AcoesChartsGridProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <ChartCard title="Acoes por Consultor" description="Top 15 por volume" dataSource="mirror.crm_acoes · aco_vendedor, COUNT(*)" loading={isLoading} error={coreError}>
        <HorizontalBarChart
          data={porVendedor.map((item) => ({ name: item.name, acoes: item.acoes }))}
          keys={["acoes"]}
          seriesLabels={{ acoes: "Ações" }}
          title=""
          colors={[CHART_COLORS[0]]}
        />
      </ChartCard>

      <ChartCard
        title="Evolucao Mensal de Acoes"
        description="Janeiro ate o mes atual (ano corrente)"
        dataSource="mirror.crm_acoes · aco_dthconclusao→YYYY-MM, COUNT(*) · independente do calendario"
        loading={evolucaoMensalLoading}
        error={coreError}
      >
        <LineChart
          data={evolucaoMensal.map((item) => ({ x: formatMonthYear(item.name), y: item.acoes }))}
          seriesName="Ações"
          color={CHART_COLORS[0]}
        />
      </ChartCard>

      <ChartCard title="Acoes por Cidade" description="Top 15 cidades" dataSource="mirror.crm_acoes · cli_cidade (cidade do CLIENTE), COUNT(*)" loading={isLoading} error={coreError}>
        <HorizontalBarChart
          data={porCidade.map((item) => ({ name: item.name, acoes: item.acoes }))}
          keys={["acoes"]}
          seriesLabels={{ acoes: "Ações" }}
          title=""
          colors={[CHART_COLORS[2]]}
        />
      </ChartCard>

      <ChartCard title="Distribuicao por Tipo de Acao" description="Todos os tipos" dataSource="mirror.crm_acoes · aco_tipoacao, COUNT(*)" loading={isLoading} error={coreError}>
        <HorizontalBarChart
          data={[...porTipoAcao].sort((a, b) => b.value - a.value).map((item) => ({ name: item.name, acoes: item.value }))}
          keys={["acoes"]}
          seriesLabels={{ acoes: "Ações" }}
          title=""
          colors={[CHART_COLORS[0]]}
        />
      </ChartCard>

      <ChartCard
        title="Evolucao Mensal de Visitas"
        description="Janeiro ate o mes atual (ano corrente)"
        dataSource="mirror.crm_acoes · aco_tipocontato LIKE '%visita%' por aco_dthconclusao→YYYY-MM · independente do calendario"
        loading={evolucaoMensalLoading}
        error={coreError}
      >
        <LineChart
          data={evolucaoMensal.map((item) => ({ x: formatMonthYear(item.name), y: item.visitas }))}
          seriesName="Visitas"
          color={CHART_COLORS[4]}
          tooltipFormatter={(value) => value.toLocaleString("pt-BR")}
        />
      </ChartCard>

      <ChartCard
        title="Clientes em Risco — Dias sem Acao Comercial"
        description="Dias sem acao comercial (toda a carteira)"
        dataSource="rpc_acoes_clientes_risco · faixas de dias sem contato"
        loading={riscoLoading}
        error={riscoError}
        footer={<p className="text-[11px] text-[var(--voux-text-muted)]">Clique numa faixa para abrir a lista de clientes dela em "Gestao da Carteira".</p>}
      >
        <VerticalBarChart
          data={(riscoData?.faixas ?? []).map((item) => ({ name: item.faixa, clientes: item.clientes }))}
          keys={["clientes"]}
          seriesLabels={{ clientes: "Clientes" }}
          title=""
          itemColors={["#C9A96E80", "#C9A96E", "#D4956A", "#B8603A", "#8B3A22"]}
          onBarClick={onFaixaClick}
        />
      </ChartCard>
    </div>
  );
}
