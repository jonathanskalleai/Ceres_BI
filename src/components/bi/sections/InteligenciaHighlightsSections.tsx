import { type DateRange } from "react-day-picker";
import { ChartCard } from "@/components/bi/ChartCard";
import { HorizontalBarChart } from "@/components/bi/charts";
import { CHART_COLORS } from "@/lib/chartTheme";
import { formatBRL } from "@/lib/dateUtils";
import { useInteligenciaBIRpc } from "@/hooks/bi/useInteligenciaBIRpc";

interface Props {
  active: boolean;
  dateRange?: DateRange;
}

/** Recorte financeiro que complementa Carteira & Mercado sem duplicar Pedidos. */
export function InteligenciaFinanceiraSection({ active, dateRange }: Props) {
  const { sharePorBanco, isLoading } = useInteligenciaBIRpc(
    active,
    dateRange,
    undefined,
    undefined,
    ["financeiro"],
  );

  const bancos = sharePorBanco.map((banco) => ({ name: banco.name, valor: banco.valor }));
  if (bancos.length === 0 && !isLoading) return null;

  return (
    <div className="grid grid-cols-1 gap-4">
      <ChartCard
        title="Share por Banco Financiador"
        description="Distribuição de valor por instituição no período selecionado"
        loading={isLoading}
      >
        <HorizontalBarChart
          data={bancos}
          keys={["valor"]}
          seriesLabels={{ valor: "Valor (R$)" }}
          colors={CHART_COLORS}
          tooltipFormatter={formatBRL}
        />
      </ChartCard>
    </div>
  );
}

/** Base instalada envelhecida é contexto de renovação e pós-venda, não de faturamento. */
export function FrotaRenovacaoSection({ active, dateRange }: Props) {
  const { frotaRenovacao, isLoading } = useInteligenciaBIRpc(
    active,
    dateRange,
    undefined,
    undefined,
    ["mercado"],
  );

  const frota = frotaRenovacao.map((item) => ({
    name: item.isNossaMarca ? `${item.marca} ★` : item.marca,
    totalMaquinas: item.totalMaquinas,
  }));

  if (frota.length === 0 && !isLoading) return null;

  return (
    <div className="grid grid-cols-1 gap-4">
      <ChartCard
        title="Frota com +5 Anos por Marca"
        description="Posição atual: oportunidade de renovação da base instalada"
        loading={isLoading}
      >
        <HorizontalBarChart
          data={frota}
          keys={["totalMaquinas"]}
          seriesLabels={{ totalMaquinas: "Máquinas" }}
          colors={[CHART_COLORS[5]]}
          tooltipFormatter={(value: number) => value.toLocaleString("pt-BR")}
        />
      </ChartCard>
    </div>
  );
}

/** Compatibilidade temporária para consumidores ainda não consolidados. */
export function InteligenciaMercadoSection({ active, dateRange }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <InteligenciaFinanceiraSection active={active} dateRange={dateRange} />
      <FrotaRenovacaoSection active={active} dateRange={dateRange} />
    </div>
  );
}

/** Recorte de Inteligência que acrescenta os dois visuais de SLA à aba de serviços. */
export function InteligenciaSlaSection({ active, dateRange }: Props) {
  const { slaPorFilial, slaPorTipoOS, isLoading } = useInteligenciaBIRpc(
    active,
    dateRange,
    undefined,
    undefined,
    ["sla"],
  );

  if (slaPorFilial.length === 0 && slaPorTipoOS.length === 0 && !isLoading) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ChartCard
        title="Tempo Médio OS por Filial"
        description="Dias médios para conclusão por filial no período selecionado"
        loading={isLoading}
      >
        <HorizontalBarChart
          data={slaPorFilial.map((item) => ({ name: item.filial, mediaDias: item.mediaDias }))}
          keys={["mediaDias"]}
          seriesLabels={{ mediaDias: "Dias (média)" }}
          colors={[CHART_COLORS[4]]}
          tooltipFormatter={(value: number) => `${value.toFixed(1)} dias`}
        />
      </ChartCard>
      <ChartCard
        title="Tempo Médio OS por Tipo"
        description="Dias médios para conclusão por tipo de OS no período selecionado"
        loading={isLoading}
      >
        <HorizontalBarChart
          data={slaPorTipoOS.map((item) => ({ name: item.tipo, mediaDias: item.mediaDias }))}
          keys={["mediaDias"]}
          seriesLabels={{ mediaDias: "Dias (média)" }}
          colors={[CHART_COLORS[4]]}
          tooltipFormatter={(value: number) => `${value.toFixed(1)} dias`}
        />
      </ChartCard>
    </div>
  );
}
