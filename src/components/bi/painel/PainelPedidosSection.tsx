import { DollarSign, FileCheck, ShieldCheck, Percent } from "lucide-react";
import { KPICard } from "@/components/bi/KPICard";
import { fmtBRLKpi, fmtNum, fmtPct, isEmpty } from "@/lib/formatters";
import type { PedidosKPIsResult } from "@/hooks/bi/usePedidosKPIsRpc";

interface Props {
  pedKpis: PedidosKPIsResult;
  loading: boolean;
}

export function PainelPedidosSection({ pedKpis, loading }: Props) {
  return (
    <>
      {(loading || !isEmpty(pedKpis.faturamento.value)) && (
        <KPICard
          title="Faturamento"
          value={fmtBRLKpi(pedKpis.faturamento.value)}
          icon={DollarSign}
          previousValue={fmtBRLKpi(pedKpis.faturamento.previousValue)}
          trend={pedKpis.faturamento.trend}
          loading={loading}
          accentColor="var(--voux-success)"
          formula="Valor total em R$ dos pedidos aprovados no periodo"
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
          formula="Quantidade de pedidos emitidos no periodo"
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
          formula="De todos os pedidos, quantos % foram aprovados"
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
          formula="Quanto do valor total foi via financiamento (vs recurso proprio)"
        />
      )}
    </>
  );
}
