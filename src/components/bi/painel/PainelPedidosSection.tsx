import { DollarSign, FileCheck, ShieldCheck, Percent } from "lucide-react";
import { KPICard } from "@/components/bi/KPICard";
import { fmtBRL, fmtNum, fmtPct, isEmpty } from "@/lib/formatters";
import type { usePedidosKPIs } from "@/hooks/bi/usePedidosKPIs";

interface Props {
  pedKpis: ReturnType<typeof usePedidosKPIs>["kpis"];
  loading: boolean;
}

export function PainelPedidosSection({ pedKpis, loading }: Props) {
  return (
    <>
      {(loading || !isEmpty(pedKpis.faturamento.value)) && (
        <KPICard
          title="Faturamento"
          value={fmtBRL(pedKpis.faturamento.value)}
          icon={DollarSign}
          previousValue={fmtBRL(pedKpis.faturamento.previousValue)}
          trend={pedKpis.faturamento.trend}
          loading={loading}
          accentColor="var(--voux-success, #4ade80)"
          formula="SUM(valor pedido) WHERE aprovado"
        />
      )}
      {(loading || !isEmpty(pedKpis.totalPedidos.value)) && (
        <KPICard
          title="Total Pedidos"
          value={fmtNum(pedKpis.totalPedidos.value)}
          icon={FileCheck}
          previousValue={fmtNum(pedKpis.totalPedidos.previousValue)}
          trend={pedKpis.totalPedidos.trend}
          loading={loading}
          formula="COUNT pedidos no periodo"
        />
      )}
      {(loading || !isEmpty(pedKpis.taxaAprovacao.value)) && (
        <KPICard
          title="Taxa Aprovacao"
          value={fmtPct(pedKpis.taxaAprovacao.value)}
          icon={ShieldCheck}
          previousValue={fmtPct(pedKpis.taxaAprovacao.previousValue)}
          trend={pedKpis.taxaAprovacao.trend}
          loading={loading}
          formula="pedidos aprovados / total x 100"
        />
      )}
      {(loading || !isEmpty(pedKpis.mixFinanciamento.value)) && (
        <KPICard
          title="Mix Financiamento"
          value={fmtPct(pedKpis.mixFinanciamento.value)}
          icon={Percent}
          previousValue={fmtPct(pedKpis.mixFinanciamento.previousValue)}
          trend={pedKpis.mixFinanciamento.trend}
          loading={loading}
          hint="% valor financiado vs total"
          formula="valor financiado / (financiado + recurso proprio) x 100"
        />
      )}
    </>
  );
}
