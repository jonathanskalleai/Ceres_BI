import {
  BarChart, Bar, ComposedChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { ShoppingCart, DollarSign, TrendingUp, CreditCard, Percent, XCircle } from "lucide-react";
import { usePedidosData } from "@/hooks/bi/usePedidosData";
import { usePedidosItensData } from "@/hooks/bi/usePedidosItensData";
import { KPICard } from "@/components/bi/KPICard";
import { ChartCard } from "@/components/bi/ChartCard";
import { CHART_COLORS, COLOR_POSITIVE } from "@/lib/chartColors";
import { formatBRL, formatBRLShort } from "@/lib/dateUtils";

interface Props {
  active: boolean;
}

export default function PedidosSection({ active }: Props) {
  const { agg, isLoading } = usePedidosData(active);
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
          <ComposedChart data={agg.evolucaoMensal}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={formatBRLShort} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: number, n) => (n === "Faturamento" ? formatBRL(v) : v)} />
            <Legend />
            <Bar yAxisId="left" dataKey="faturamento" name="Faturamento" fill={CHART_COLORS[0]} />
            <Line yAxisId="right" type="monotone" dataKey="qtd" name="Pedidos" stroke={CHART_COLORS[1]} dot={false} />
          </ComposedChart>
        </ChartCard>

        <ChartCard
          title="Mix de Pagamento"
          description="Recurso proprio vs financiado (R$ aprovado)"
          loading={isLoading}
        >
          <PieChart>
            <Pie data={agg.mixPagamento} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
              <Cell fill={COLOR_POSITIVE} />
              <Cell fill={CHART_COLORS[1]} />
            </Pie>
            <Tooltip formatter={(v: number) => formatBRL(v)} />
            <Legend />
          </PieChart>
        </ChartCard>

        <ChartCard
          title="Valor por Situacao do Pedido"
          description="R$ em cada status (aprovado, cancelado, etc.)"
          loading={isLoading}
        >
          <BarChart data={agg.porSituacao} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatBRLShort} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
            <Tooltip formatter={(v: number, _n, p) => [`${formatBRL(v)} (${p.payload.qtd} pedidos)`, "Valor"]} />
            <Bar dataKey="valor" fill={CHART_COLORS[2]} />
          </BarChart>
        </ChartCard>

        <ChartCard
          title="Ranking Vendedores — Faturamento"
          description="Top 10 por receita aprovada"
          loading={isLoading}
        >
          <BarChart data={agg.porVendedor} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatBRLShort} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
            <Tooltip formatter={(v: number) => formatBRL(v)} />
            <Bar dataKey="value" fill={CHART_COLORS[1]} />
          </BarChart>
        </ChartCard>

        <ChartCard
          title="Top Cidades de Entrega"
          description="Faturamento aprovado por cidade/UF"
          loading={isLoading}
        >
          <BarChart data={agg.porCidade} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatBRLShort} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
            <Tooltip formatter={(v: number) => formatBRL(v)} />
            <Bar dataKey="value" fill={CHART_COLORS[3]} />
          </BarChart>
        </ChartCard>

        <ChartCard
          title="Itens Mais Vendidos — Grupo"
          description="Valor vendido por grupo de produto (itens dos pedidos)"
          loading={itensLoading}
        >
          <BarChart data={itens.porGrupo} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatBRLShort} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
            <Tooltip formatter={(v: number, _n, p) => [`${formatBRL(v)} (${p.payload.qtd} un)`, "Valor"]} />
            <Bar dataKey="valor" fill={CHART_COLORS[4]} />
          </BarChart>
        </ChartCard>
      </div>
    </div>
  );
}
