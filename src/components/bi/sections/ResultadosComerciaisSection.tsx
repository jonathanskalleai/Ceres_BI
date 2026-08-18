import { BriefcaseBusiness, Percent, Target, Trophy, Wallet, XCircle } from "lucide-react";
import { type DateRange } from "react-day-picker";

import { AcoesFunilConversao } from "@/components/bi/sections/AcoesFunilConversao";
import { KPICard } from "@/components/bi/KPICard";
import { useAcoesBIRpc } from "@/hooks/bi/useAcoesBIRpc";
import { useAcoesFunilPeriodoRpc } from "@/hooks/bi/useAcoesFunilPeriodoRpc";
import { fmtBRLKpi } from "@/lib/formatters";
import { toISODate } from "@/lib/dateUtils";
import type { AcoesBIKpis, AcoesFunil, AcoesFunilMeta } from "@/types/biRpc";

interface Props {
  active: boolean;
  dateRange?: DateRange;
  vendedor?: string;
  cidade?: string;
}

const EMPTY_KPIS: AcoesBIKpis = {
  totalAcoes: 0,
  cidades: 0,
  consultores: 0,
  visitas: 0,
  clientes: 0,
  tiposAcaoDistintos: 0,
  valorGanho: 0,
  negociosGanho: 0,
  valorPerdido: 0,
  negociosPerdido: 0,
  negociosOutrosStatus: 0,
  tempoMedioContato: 0,
};

const EMPTY_FUNIL: AcoesFunil = {
  visitas: 0,
  oportunidades: 0,
  valorOportunidades: 0,
  oportunidadesAbertas: 0,
  valorOportunidadesAbertas: 0,
  negociosAbertosTocadosNoPeriodo: 0,
  valorPipelineAbertoTocadoNoPeriodo: 0,
  entradasEtapaOportunidade: 0,
  emEtapaOportunidade: 0,
  ganhos: 0,
  perdidos: 0,
  valorPerdido: 0,
  visitasPorOportunidade: null,
  oportPorFechamento: null,
};

const EMPTY_META: AcoesFunilMeta = {
  acoesSemConsultor: 0,
  ganhosSemAtribuicao: 0,
  perdidosSemAtribuicao: 0,
  somaGanhosRanking: 0,
};

/**
 * Resultado comercial com o mesmo contrato auditado e aprovado em /bi/acoes.
 * Ganhos, perdas e carteira ativa têm fontes e datas de competência próprias;
 * REPASSE DE MAQUINA não participa de nenhuma das três métricas.
 */
export default function ResultadosComerciaisSection({ active, dateRange, vendedor, cidade }: Props) {
  const from = toISODate(dateRange?.from);
  const to = toISODate(dateRange?.to ?? dateRange?.from);
  const enabled = active && !!from && !!to;

  const { data: acoesData, isLoading: acoesLoading } = useAcoesBIRpc({
    from,
    to,
    vendedor,
    cidade,
    enabled,
  });
  const { data: gestaoData, isLoading: gestaoLoading, error: gestaoError } = useAcoesFunilPeriodoRpc({
    from,
    to,
    vendedor,
    cidade,
    enabled,
  });

  const kpis = acoesData?.kpis ?? EMPTY_KPIS;
  const funil = gestaoData?.funil ?? EMPTY_FUNIL;
  const taxaGanho = funil.oportunidades > 0 ? (funil.ganhos / funil.oportunidades) * 100 : null;
  const loading = acoesLoading || gestaoLoading;

  return (
    <div className="space-y-6 pt-4">
      <p className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
        <strong className="text-foreground">Regra comercial validada:</strong>{" "}
        ganhos são pedidos aprovados; perdas são negócios fechados como perdidos; pipeline é a carteira em andamento com ação no período. Repasse de Máquina não entra nos três recortes.
      </p>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KPICard
          title="Pedidos Ganhos"
          value={kpis.negociosGanho.toLocaleString("pt-BR")}
          icon={Trophy}
          loading={loading}
          hint={`${fmtBRLKpi(kpis.valorGanho)} aprovados no período`}
          dataSource="crm_pedidos · pedido Aprovado por pdo_dthaprovacao + negócio Ganho · sem REPASSE DE MAQUINA"
        />
        <KPICard
          title="Valor Ganho"
          value={fmtBRLKpi(kpis.valorGanho)}
          icon={Wallet}
          loading={loading}
          hint={`${kpis.negociosGanho.toLocaleString("pt-BR")} pedidos aprovados`}
          dataSource="SUM(pdo_vlrpedido) · pedido Aprovado por pdo_dthaprovacao · sem REPASSE DE MAQUINA"
        />
        <KPICard
          title="Negócios Perdidos"
          value={kpis.negociosPerdido.toLocaleString("pt-BR")}
          icon={XCircle}
          loading={loading}
          hint={`${fmtBRLKpi(kpis.valorPerdido)} em valor potencial`}
          dataSource="crm_negocios canônico · ngo_conclusao='Perdido' por ngo_datafechamento · sem REPASSE DE MAQUINA"
        />
        <KPICard
          title="Valor Perdido"
          value={fmtBRLKpi(kpis.valorPerdido)}
          icon={XCircle}
          loading={loading}
          invertTrend
          hint={`${kpis.negociosPerdido.toLocaleString("pt-BR")} negócios fechados como perdidos`}
          dataSource="SUM(ngo_vlrtotalnegociado) · negócio Perdido por ngo_datafechamento · sem REPASSE DE MAQUINA"
        />
        <KPICard
          title="Pipeline Aberto"
          value={fmtBRLKpi(funil.valorPipelineAbertoTocadoNoPeriodo)}
          icon={BriefcaseBusiness}
          loading={loading}
          hint={`${funil.negociosAbertosTocadosNoPeriodo.toLocaleString("pt-BR")} negócios em andamento com ação no período`}
          dataSource="crm_acoes + crm_negocios canônico · Em Andamento com ação concluída no período · sem REPASSE DE MAQUINA"
        />
        <KPICard
          title="Ganho sobre Oportunidades"
          value={taxaGanho == null ? "—" : `${taxaGanho.toFixed(1)}%`}
          icon={Percent}
          loading={loading}
          hint={`${funil.ganhos.toLocaleString("pt-BR")} pedidos ganhos / ${funil.oportunidades.toLocaleString("pt-BR")} oportunidades geradas`}
          dataSource="pedidos aprovados ganhos / primeira entrada no funil VENDAS no período"
        />
      </div>

      <AcoesFunilConversao
        funil={funil}
        meta={gestaoData?.meta ?? EMPTY_META}
        loading={gestaoLoading}
        error={gestaoError}
      />

      <a
        href="/bi/acoes"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Target className="h-3.5 w-3.5" /> Ver ações, carteira e detalhamento operacional →
      </a>
    </div>
  );
}
