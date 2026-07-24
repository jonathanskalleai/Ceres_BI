import { ClipboardList, MapPin, Users, Eye, UserCheck, Tag, Clock, Wallet, Trophy, XCircle } from "lucide-react";
import { KPICard } from "@/components/bi/KPICard";
import { calcTrend } from "@/lib/dateUtils";
import type { AcoesBIKpis } from "@/types/biRpc";

/**
 * Semantica compartilhada pelos 3 cards de valor. Explicita de proposito:
 * `ngo_conclusao` e o status ATUAL do negocio, nao o status na data da acao —
 * um negocio trabalhado em maio e perdido em junho conta como Perdido em maio.
 */
const VALOR_BASE =
  "mirror.crm_negocios · SUM(ngo_vlrtotalnegociado) dedup por ngo_numero · negocios TOCADOS por acao no periodo (aco_dthconclusao) · funis VENDAS/Vendas AP/REPASSE DE MAQUINA · status ATUAL do negocio (ngo_conclusao), nao o status na data da acao";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

const num = (v: number) => v.toLocaleString("pt-BR");

interface Props {
  kpis: AcoesBIKpis;
  kpisPrev: AcoesBIKpis;
  loading?: boolean;
}

/** Grid de KPIs da tela /bi/acoes — extraida de AcoesSection para conter o tamanho do arquivo. */
export function AcoesKpiGrid({ kpis, kpisPrev, loading }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <KPICard title="Total de Acoes" value={num(kpis.totalAcoes)} icon={ClipboardList} loading={loading}
        previousValue={num(kpisPrev.totalAcoes)} trend={calcTrend(kpis.totalAcoes, kpisPrev.totalAcoes)}
        dataSource="mirror.crm_acoes · COUNT(*) por aco_dthconclusao" />

      <KPICard title="Cidades Atendidas" value={num(kpis.cidades)} icon={MapPin} loading={loading}
        previousValue={num(kpisPrev.cidades)} trend={calcTrend(kpis.cidades, kpisPrev.cidades)}
        dataSource="COUNT(DISTINCT cli_cidade) — cidade do CLIENTE (crm_carteira_clientes), nao da filial" />

      <KPICard title="Consultores Ativos" value={num(kpis.consultores)} icon={Users} loading={loading}
        previousValue={num(kpisPrev.consultores)} trend={calcTrend(kpis.consultores, kpisPrev.consultores)}
        dataSource="mirror.crm_acoes · COUNT(DISTINCT aco_vendedor)" />

      <KPICard title="Total de Visitas" value={num(kpis.visitas)} icon={Eye} loading={loading}
        previousValue={num(kpisPrev.visitas)} trend={calcTrend(kpis.visitas, kpisPrev.visitas)}
        dataSource="mirror.crm_acoes · COUNT(*) WHERE aco_tipocontato LIKE '%visita%'" />

      <KPICard title="Clientes Unicos" value={num(kpis.clientes)} icon={UserCheck} loading={loading}
        previousValue={num(kpisPrev.clientes)} trend={calcTrend(kpis.clientes, kpisPrev.clientes)}
        dataSource="mirror.crm_acoes · COUNT(DISTINCT cli_nome)" />

      <KPICard title="Tipos de Acao" value={num(kpis.tiposAcaoDistintos)} icon={Tag} loading={loading}
        previousValue={num(kpisPrev.tiposAcaoDistintos)} trend={calcTrend(kpis.tiposAcaoDistintos, kpisPrev.tiposAcaoDistintos)}
        dataSource="mirror.crm_acoes · COUNT(DISTINCT aco_tipoacao)" />

      <KPICard title="Duracao Media da Acao" value={`${kpis.tempoMedioContato} dias`} icon={Clock} loading={loading}
        previousValue={`${kpisPrev.tempoMedioContato} dias`} trend={calcTrend(kpis.tempoMedioContato, kpisPrev.tempoMedioContato)}
        invertTrend
        dataSource="mirror.crm_acoes · AVG(aco_dthconclusao - aco_dthabertura) em dias — duracao da propria acao (abertura ate conclusao), NAO tempo ate o primeiro contato" />

      <KPICard title="Valor em Aberto" value={brl(kpis.valorAberto)} icon={Wallet} loading={loading}
        previousValue={brl(kpisPrev.valorAberto)} trend={calcTrend(kpis.valorAberto, kpisPrev.valorAberto)}
        rawValue={kpis.valorAberto}
        hint={`${num(kpis.negociosAberto)} negocios`}
        dataSource={`${VALOR_BASE} · recorte: Em Andamento`} />

      <KPICard title="Valor Ganho" value={brl(kpis.valorGanho)} icon={Trophy} loading={loading}
        previousValue={brl(kpisPrev.valorGanho)} trend={calcTrend(kpis.valorGanho, kpisPrev.valorGanho)}
        rawValue={kpis.valorGanho}
        hint={`${num(kpis.negociosGanho)} negocios`}
        dataSource={`${VALOR_BASE} · recorte: Ganho`} />

      <KPICard title="Valor Perdido" value={brl(kpis.valorPerdido)} icon={XCircle} loading={loading}
        previousValue={brl(kpisPrev.valorPerdido)} trend={calcTrend(kpis.valorPerdido, kpisPrev.valorPerdido)} invertTrend
        rawValue={kpis.valorPerdido}
        hint={`${num(kpis.negociosPerdido)} negocios`}
        dataSource={`${VALOR_BASE} · recorte: Perdido`} />
    </div>
  );
}
