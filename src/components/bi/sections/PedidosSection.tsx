import { ShoppingCart, DollarSign, TrendingUp, CreditCard, Percent, XCircle } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { usePedidosData } from "@/hooks/bi/usePedidosData";
import { usePedidosItensData } from "@/hooks/bi/usePedidosItensData";
import { KPICard } from "@/components/bi/KPICard";
import { ChartCard } from "@/components/bi/ChartCard";
import { HorizontalBarChart, PieChartWithLabels, LineChart } from "@/components/bi/charts";
import { CHART_COLORS, POSITIVE_COLOR } from "@/lib/chartTheme";
import { formatBRL, formatBRLShort, formatMonthYear } from "@/lib/dateUtils";

interface Props {
  active: boolean;
  dateRange?: DateRange;
}

export default function PedidosSection({ active, dateRange }: Props) {
  const { agg, isLoading } = usePedidosData(active, dateRange);
  const { agg: itens, isLoading: itensLoading } = usePedidosItensData(active);
  const { kpis } = agg;

  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard title="Total Pedidos" value={kpis.total.toLocaleString("pt-BR")} icon={ShoppingCart} loading={isLoading} />
        <KPICard title="Faturamento (Aprovado)" value={formatBRL(kpis.faturamento)} icon={DollarSign} loading={isLoading} hint="receita de pedidos aprovados" />
        <KPICard title="Ticket Medio" value={formatBRL(kpis.ticketMedio)} icon={TrendingUp} loading={isLoading} hint="por pedido aprovado" />
        <KPICard title="Taxa de Aprovacao" value={`${kpis.percentAprovado.toFixed(1)}%`} icon={Percent} loading={isLoading} />
        <KPICard title="% Financiado" value={`${kpis.percentFinanciado.toFixed(1)}%`} icon={CreditCard} loading={isLoading} hint="vs recurso proprio" />
        <KPICard title="Valor Cancelado" value={formatBRL(kpis.valorCancelado)} icon={XCircle} loading={isLoading} hint="pedidos cancelados" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard
          title="Evolucao Mensal do Faturamento"
          description="Receita aprovada e numero de pedidos por mes"
          loading={isLoading}
        >
          <div className="h-full">
            <div className="grid grid-cols-1 gap-4 h-full">
              <div className="h-1/2">
                <HorizontalBarChart
                  data={agg.evolucaoMensal.map(item => ({ name: formatMonthYear(item.name), faturamento: item.faturamento }))}
                  keys={['faturamento']}
                  seriesLabels={{ faturamento: "Faturamento" }}
                  title="Faturamento"
                  tooltipFormatter={formatBRL}
                  colors={[CHART_COLORS[0]]}
                  height={130}
                />
              </div>
              <div className="h-1/2">
                <LineChart
                  data={agg.evolucaoMensal.map(item => ({ x: formatMonthYear(item.name), y: item.qtd }))}
                  seriesName="Pedidos"
                  color={CHART_COLORS[1]}
                  height={130}
                  tooltipFormatter={(v: number) => v.toLocaleString("pt-BR")}
                />
              </div>
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Mix de Pagamento"
          description="Recurso proprio vs financiado (R$ aprovado)"
          loading={isLoading}
        >
          <PieChartWithLabels
            data={[
              { id: 'proprio', value: agg.mixPagamento[0]?.value || 0, name: 'Recurso próprio' },
              { id: 'financiado', value: agg.mixPagamento[1]?.value || 0, name: 'Financiado' }
            ]}
            title=""
            colors={[POSITIVE_COLOR, CHART_COLORS[1]]}
          />
        </ChartCard>

        <ChartCard
          title="Valor por Situacao do Pedido"
          description="R$ em cada status (aprovado, cancelado, etc.)"
          loading={isLoading}
        >
          <HorizontalBarChart
            data={agg.porSituacao.map(item => ({
              name: item.name,
              valor: item.valor,
              qtd: item.qtd
            }))}
            keys={['valor']}
            seriesLabels={{ valor: "Valor (R$)" }}
            title=""
            tooltipFormatter={(value, d) => `${formatBRL(value)} (${d?.qtd ?? 0} pedidos)`}
            colors={[CHART_COLORS[2]]}
          />
        </ChartCard>

        <ChartCard
          title="Ranking Vendedores — Faturamento"
          description="Top 10 por receita aprovada"
          loading={isLoading}
        >
          <HorizontalBarChart
            data={agg.porVendedor.map(item => ({
              name: item.name,
              value: item.value
            }))}
            keys={['value']}
            seriesLabels={{ value: "Faturamento" }}
            title=""
            tooltipFormatter={formatBRL}
            colors={[CHART_COLORS[1]]}
          />
        </ChartCard>

        <ChartCard
          title="Top Cidades de Entrega"
          description="Faturamento aprovado por cidade/UF"
          loading={isLoading}
        >
          <HorizontalBarChart
            data={agg.porCidade.map(item => ({
              name: item.name,
              value: item.value
            }))}
            keys={['value']}
            seriesLabels={{ value: "Faturamento" }}
            title=""
            tooltipFormatter={formatBRL}
            colors={[CHART_COLORS[3]]}
          />
        </ChartCard>

        <ChartCard
          title="Itens Mais Vendidos — Grupo"
          description="Valor vendido por grupo de produto (itens dos pedidos)"
          loading={itensLoading}
        >
          <HorizontalBarChart
            data={itens.porGrupo.map(item => ({
              name: item.name,
              valor: item.valor,
              qtd: item.qtd
            }))}
            keys={['valor']}
            seriesLabels={{ valor: "Valor Vendido" }}
            title=""
            tooltipFormatter={(value, d) => `${formatBRL(value)} (${d?.qtd ?? 0} un)`}
            colors={[CHART_COLORS[4]]}
          />
        </ChartCard>
      </div>
    </div>
  );
}
