import { DollarSign, TrendingDown, Briefcase, Ticket } from "lucide-react";
import { KPICard } from "@/components/bi/KPICard";
import { fmtBRLKpi, isEmpty } from "@/lib/formatters";
import type { PainelKPIs } from "@/hooks/bi/usePainelKPIsRpc";

interface Props {
  kpis: PainelKPIs;
  loading: boolean;
}

export function PainelValoresSection({ kpis, loading }: Props) {
  return (
    <>
      {(loading || !isEmpty(kpis.valorGanho.value)) && (
        <KPICard
          title="Valor Ganho"
          value={fmtBRLKpi(kpis.valorGanho.value)}
          rawValue={kpis.valorGanho.value}
          icon={DollarSign}
          previousValue={fmtBRLKpi(kpis.valorGanho.previousValue)}
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
          rawValue={kpis.valorPerdido.value}
          icon={TrendingDown}
          previousValue={fmtBRLKpi(kpis.valorPerdido.previousValue)}
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
          rawValue={kpis.pipelineAberto.value}
          icon={Briefcase}
          previousValue={fmtBRLKpi(kpis.pipelineAberto.previousValue)}
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
          rawValue={kpis.ticketMedio.value}
          icon={Ticket}
          previousValue={fmtBRLKpi(kpis.ticketMedio.previousValue)}
          trend={kpis.ticketMedio.trend}
          loading={loading}
          formula="Valor medio por pedido aprovado — divide o total de Valor Ganho pela quantidade de pedidos aprovados"
        />
      )}
    </>
  );
}
