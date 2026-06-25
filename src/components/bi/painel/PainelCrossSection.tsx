import { Clock, ClipboardList, Target } from "lucide-react";
import { KPICard } from "@/components/bi/KPICard";
import { fmtDias, fmtNum, fmtPct, isEmpty } from "@/lib/formatters";
import type { CrossKPIs } from "@/hooks/bi/useCrossKPIsRpc";

interface Props {
  crossKpis: CrossKPIs;
  loading: boolean;
}

export function PainelCrossSection({ crossKpis, loading }: Props) {
  return (
    <>
      {(loading || !isEmpty(crossKpis.cicloMedioVendas.value)) && (
        <KPICard
          title="Ciclo Medio"
          value={fmtDias(crossKpis.cicloMedioVendas.value)}
          icon={Clock}
          previousValue={fmtDias(crossKpis.cicloMedioVendas.previousValue)}
          trend={crossKpis.cicloMedioVendas.trend}
          invertTrend
          loading={loading}
          hint="Media dias ate fechar (ganhos)"
          formula="AVG(dias ate fechar) dos ganhos"
        />
      )}
      {(loading || !isEmpty(crossKpis.esforcoMedio.value)) && (
        <KPICard
          title="Esforco Medio"
          value={fmtNum(crossKpis.esforcoMedio.value)}
          icon={ClipboardList}
          previousValue={fmtNum(crossKpis.esforcoMedio.previousValue)}
          trend={crossKpis.esforcoMedio.trend}
          invertTrend
          loading={loading}
          hint="Acoes por negocio ganho"
          formula="AVG(qtd acoes) por negocio ganho"
        />
      )}
      {(loading || !isEmpty(crossKpis.conversaoPedidoNegocio.value)) && (
        <KPICard
          title="Conversao Pedido"
          value={fmtPct(crossKpis.conversaoPedidoNegocio.value)}
          icon={Target}
          previousValue={fmtPct(crossKpis.conversaoPedidoNegocio.previousValue)}
          trend={crossKpis.conversaoPedidoNegocio.trend}
          loading={loading}
          hint="% ganhos com pedido emitido"
          formula="negocios ganhos com pedido / total ganhos x 100"
        />
      )}
    </>
  );
}
