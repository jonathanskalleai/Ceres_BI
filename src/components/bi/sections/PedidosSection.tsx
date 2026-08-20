import { ShoppingCart, DollarSign, TrendingUp, CreditCard, Percent, XCircle } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { usePedidosBIRpc } from "@/hooks/bi/usePedidosBIRpc";
import { KPICard } from "@/components/bi/KPICard";
import { ChartCard } from "@/components/bi/ChartCard";
import { VouxBarH, VouxLine, VouxDonut } from '@/components/charts/voux';
import { formatBRL, formatMonthYear, toISODate, getPreviousPeriod, calcTrend } from "@/lib/dateUtils";
import { fmtBRLKpi } from "@/lib/formatters";
import { PEDIDOS_BI_DEFAULTS } from "@/services/bi/biRpcService";

interface Props {
  active: boolean;
  dateRange?: DateRange;
  vendedor?: string;
  cidade?: string;
}

const EMPTY_AGG = PEDIDOS_BI_DEFAULTS;

export default function PedidosSection({ active, dateRange, vendedor, cidade }: Props) {
  const from = toISODate(dateRange?.from);
  const to = toISODate(dateRange?.to ?? dateRange?.from);

  const { data: agg = EMPTY_AGG, isLoading } = usePedidosBIRpc({
    from,
    to,
    vendedor,
    cidade,
    enabled: active && !!from && !!to,
  });
  const { kpis } = agg;

  // Periodo anterior (mesmo intervalo, 1 ano atras) para analise comparativa
  const prevRange = getPreviousPeriod(dateRange);
  const fromPrev = toISODate(prevRange?.from);
  const toPrev = toISODate(prevRange?.to ?? prevRange?.from);
  const { data: aggPrev } = usePedidosBIRpc({
    from: fromPrev,
    to: toPrev,
    vendedor,
    cidade,
    enabled: active && !!fromPrev && !!toPrev,
  });
  const kpisPrev = aggPrev?.kpis ?? EMPTY_AGG.kpis;

  return (
    <div className="space-y-6 pt-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard title="Total Pedidos" value={kpis.total.toLocaleString("pt-BR")} icon={ShoppingCart} loading={isLoading}
          previousValue={kpisPrev.total.toLocaleString("pt-BR")} trend={calcTrend(kpis.total, kpisPrev.total)} dataSource="mirror.crm_pedidos · COUNT(*) por pdo_dthpedido" />
        <KPICard title="Faturamento (Aprovado)" value={fmtBRLKpi(kpis.faturamento)} icon={DollarSign} loading={isLoading} hint="receita de pedidos aprovados"
          previousValue={fmtBRLKpi(kpisPrev.faturamento)} trend={calcTrend(kpis.faturamento, kpisPrev.faturamento)} dataSource="mirror.crm_pedidos · SUM(pdo_vlrpedido) WHERE aprovado" />
        <KPICard title="Ticket Medio" value={fmtBRLKpi(kpis.ticketMedio)} icon={TrendingUp} loading={isLoading} hint="por pedido aprovado"
          previousValue={fmtBRLKpi(kpisPrev.ticketMedio)} trend={calcTrend(kpis.ticketMedio, kpisPrev.ticketMedio)} dataSource="mirror.crm_pedidos · SUM/COUNT(pdo_vlrpedido) WHERE aprovado" />
        <KPICard title="Taxa de Aprovacao" value={`${kpis.percentAprovado.toFixed(1)}%`} icon={Percent} loading={isLoading}
          previousValue={`${kpisPrev.percentAprovado.toFixed(1)}%`} trend={calcTrend(kpis.percentAprovado, kpisPrev.percentAprovado)} dataSource="mirror.crm_pedidos · COUNT(aprovado)/COUNT(*) × 100" />
        <KPICard title="% Financiado" value={`${kpis.percentFinanciado.toFixed(1)}%`} icon={CreditCard} loading={isLoading} hint="vs recurso proprio"
          previousValue={`${kpisPrev.percentFinanciado.toFixed(1)}%`} trend={calcTrend(kpis.percentFinanciado, kpisPrev.percentFinanciado)} dataSource="mirror.crm_pedidos · COUNT(pdo_vlrfinanciado>0)/COUNT(*) × 100" />
        <KPICard title="Valor Cancelado" value={fmtBRLKpi(kpis.valorCancelado)} icon={XCircle} loading={isLoading} hint="pedidos cancelados"
          previousValue={fmtBRLKpi(kpisPrev.valorCancelado)} trend={calcTrend(kpis.valorCancelado, kpisPrev.valorCancelado)} invertTrend dataSource="mirror.crm_pedidos · SUM(pdo_vlrpedido) WHERE cancelado" />
      </div>

      {/* Desempenho section */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--voux-text-muted)] mb-3">Desempenho</p>

        {/* Hero chart - full width */}
        <ChartCard
          title="Evolucao Mensal do Faturamento"
          description="Receita aprovada e numero de pedidos por mes"
          infoTooltip="Por data de ganho (fechamento do negocio)"
          dataSource="mirror.crm_pedidos · pdo_dthpedido→YYYY-MM, SUM(pdo_vlrpedido) + COUNT(*)"
          loading={isLoading}
        >
          <div className="h-full">
            <div className="grid grid-cols-1 gap-4 h-full">
              <div>
                <VouxBarH data={agg.evolucaoMensal.map(item => ({label: formatMonthYear(item.name), value: item.faturamento}))} color="#4caf7a" valueFormatter={formatBRL} />
              </div>
              <div>
                <VouxLine data={agg.evolucaoMensal.map(item => ({label: formatMonthYear(item.name), value: item.qtd}))} color="#d4a05a" fmt={(v) => v.toLocaleString('pt-BR')} height={160} dataLabels={true} />
              </div>
            </div>
          </div>
        </ChartCard>

        {/* Status/composition charts - side by side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <ChartCard
            title="Mix de Pagamento"
            description="Recurso proprio vs financiado (R$ aprovado)"
            dataSource="mirror.crm_pedidos · SUM(pdo_vlrrecursoproprio) vs SUM(pdo_vlrfinanciado)"
            loading={isLoading}
          >
            <VouxDonut data={[
              { label: 'Recurso próprio', value: agg.mixPagamento[0]?.value || 0, color: '#4caf7a' },
              { label: 'Financiado', value: agg.mixPagamento[1]?.value || 0, color: '#d4a05a' },
            ]} height={220} centerLabel="Mix" />
          </ChartCard>

          <ChartCard
            title="Valor por Situacao do Pedido"
            description="R$ em cada status (aprovado, cancelado, etc.)"
            dataSource="mirror.crm_pedidos · pdo_situacaopedido, SUM(pdo_vlrpedido)"
            loading={isLoading}
          >
            <VouxBarH data={agg.porSituacao.map(item => ({label: item.name, value: item.valor}))} color="#c97565" valueFormatter={formatBRL} />
          </ChartCard>
        </div>
      </div>

      {/* Rankings section */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--voux-text-muted)] mb-3">Rankings</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartCard
            title="Ranking Vendedores — Faturamento"
            description="Top 10 por receita aprovada"
            dataSource="mirror.crm_pedidos · pdo_vendedor, SUM(pdo_vlrpedido) WHERE aprovado"
            loading={isLoading}
          >
            <VouxBarH data={agg.porVendedor.map(item => ({label: item.name, value: item.value}))} color="#4caf7a" valueFormatter={formatBRL} />
          </ChartCard>

          <ChartCard
            title="Top Cidades de Entrega"
            description="Faturamento aprovado por cidade/UF"
            dataSource="mirror.crm_pedidos · pdo_cidadeufentrega, SUM(pdo_vlrpedido) WHERE aprovado"
            loading={isLoading}
          >
            <VouxBarH data={agg.porCidade.map(item => ({label: item.name, value: item.value}))} color="#4a6b8a" valueFormatter={formatBRL} />
          </ChartCard>

          <ChartCard
            title="Itens Mais Vendidos — Grupo"
            description="Valor vendido por grupo de produto (itens dos pedidos)"
            dataSource="mirror.crm_pedidos · pdo_grupoproduto, SUM(pdo_vlrpedido)"
            loading={isLoading}
          >
            <VouxBarH data={agg.porGrupoProduto.map(item => ({label: item.name, value: item.valor}))} color="#7a9b6f" valueFormatter={formatBRL} />
          </ChartCard>

          <ChartCard
            title="Itens Mais Vendidos — Marca"
            description="Valor vendido por marca de produto (itens dos pedidos)"
            dataSource="mirror.crm_pedidos · pdo_marcaproduto, SUM(pdo_vlrpedido)"
            loading={isLoading}
          >
            <VouxBarH data={agg.porMarcaProduto.map(item => ({label: item.name, value: item.valor}))} color="#d4b896" valueFormatter={formatBRL} />
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
