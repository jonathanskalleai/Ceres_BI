import { DollarSign, TrendingDown, Briefcase, Ticket } from "lucide-react";
import { KPICard } from "@/components/bi/KPICard";
import { fmtBRLKpi, isEmpty } from "@/lib/formatters";
import type { PainelKPIs } from "@/hooks/bi/usePainelKPIsRpc";

interface Props {
  kpis: PainelKPIs;
  loading: boolean;
  comparisonReady: boolean;
}

export function PainelValoresSection({ kpis, loading, comparisonReady }: Props) {
  return (
    <>
      {(loading || !isEmpty(kpis.valorGanho.value)) && (
        <KPICard
          title="Valor Ganho"
          value={fmtBRLKpi(kpis.valorGanho.value)}
          rawValue={kpis.valorGanho.value ?? undefined}
          icon={DollarSign}
          previousValue={comparisonReady ? fmtBRLKpi(kpis.valorGanho.previousValue) : undefined}
          trend={kpis.valorGanho.trend}
          loading={loading}
          accentColor="var(--voux-success)"
          formula="Soma em R$ dos PEDIDOS APROVADOS no periodo, contados pela data de aprovacao do pedido. E receita de pedido faturavel — regua DIFERENTE do Valor Perdido, que mede valor negociado perdido"
          dataSource="mirror.crm_pedidos · SUM(pdo_vlrpedido) dedup por pdo_codigointerno · pdo_situacaopedido='Aprovado' · data de competencia: pdo_dthaprovacao"
        />
      )}
      {(loading || !isEmpty(kpis.valorPerdido.value)) && (
        <KPICard
          title="Valor Perdido"
          value={fmtBRLKpi(kpis.valorPerdido.value)}
          rawValue={kpis.valorPerdido.value ?? undefined}
          icon={TrendingDown}
          previousValue={comparisonReady ? fmtBRLKpi(kpis.valorPerdido.previousValue) : undefined}
          trend={kpis.valorPerdido.trend}
          invertTrend
          loading={loading}
          accentColor="var(--voux-danger)"
          formula="Valor POTENCIAL dos negocios marcados como Perdido que fecharam no periodo, contados pela data de fechamento do negocio. E o que estava negociado e nao virou venda — nao e pedido cancelado"
          dataSource="mirror.crm_negocios canonizado por ngo_numero · SUM(ngo_vlrtotalnegociado) · ngo_conclusao='Perdido' · data de competencia: ngo_datafechamento"
        />
      )}
      {(loading || !isEmpty(kpis.pipelineAberto.value)) && (
        <KPICard
          title="Pipeline Aberto"
          value={fmtBRLKpi(kpis.pipelineAberto.value)}
          rawValue={kpis.pipelineAberto.value ?? undefined}
          icon={Briefcase}
          previousValue={comparisonReady ? fmtBRLKpi(kpis.pipelineAberto.previousValue) : undefined}
          trend={kpis.pipelineAberto.trend}
          loading={loading}
          formula="Valor dos negocios abertos trabalhados no periodo — negocios com pelo menos uma acao concluida que continuam Em Andamento. Nao representa somente a etapa CRM 'Oportunidade'."
          dataSource="rpc_acoes_funil_gestao · SUM(ngo_vlrtotalnegociado) de negocios canonicos DISTINTOS tocados por acao no periodo com ngo_conclusao='Em Andamento'"
        />
      )}
      {(loading || !isEmpty(kpis.ticketMedio.value)) && (
        <KPICard
          title="Ticket Medio"
          value={fmtBRLKpi(kpis.ticketMedio.value)}
          rawValue={kpis.ticketMedio.value ?? undefined}
          icon={Ticket}
          previousValue={comparisonReady ? fmtBRLKpi(kpis.ticketMedio.previousValue) : undefined}
          trend={kpis.ticketMedio.trend}
          loading={loading}
          formula="Valor medio por pedido aprovado — divide o total de Valor Ganho pela quantidade de pedidos aprovados"
        />
      )}
    </>
  );
}
