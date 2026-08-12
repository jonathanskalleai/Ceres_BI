import { ClipboardList, Eye, Target, Gauge, PauseCircle } from "lucide-react";
import { KPICard } from "@/components/bi/KPICard";
import { fmtNum, fmtBRLKpi, isEmpty } from "@/lib/formatters";
import { fmtRatio } from "@/lib/bi/acoesGestaoUtils";
import { SectionEyebrow } from "@/components/bi/SectionEyebrow";
import type { PainelKPIs } from "@/hooks/bi/usePainelKPIsRpc";

interface Props {
  kpis: PainelKPIs;
  loading: boolean;
}

export function PainelAcoesSection({ kpis, loading }: Props) {
  const num = (v: number) => v.toLocaleString("pt-BR");

  return (
    <>
      <SectionEyebrow label="ACOES / OPERACIONAL" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 opacity-90">
        {(loading || !isEmpty(kpis.totalAcoes.value)) && (
          <KPICard
            title="Total Acoes"
            value={fmtNum(kpis.totalAcoes.value)}
            icon={ClipboardList}
            previousValue={fmtNum(kpis.totalAcoes.previousValue)}
            trend={kpis.totalAcoes.trend}
            loading={loading}
            formula="Todas as acoes concluidas pelos consultores no periodo (qualquer tipo)"
          />
        )}
        {(loading || !isEmpty(kpis.totalVisitas.value)) && (
          <KPICard
            title="Total Visitas"
            value={fmtNum(kpis.totalVisitas.value)}
            icon={Eye}
            previousValue={fmtNum(kpis.totalVisitas.previousValue)}
            trend={kpis.totalVisitas.trend}
            loading={loading}
            formula="Visitas presenciais realizadas pelos consultores"
          />
        )}
        {kpis.porTipoAcao
          .filter((tipo) => !isEmpty(tipo.value))
          .map((tipo) => (
            <KPICard
              key={tipo.name}
              title={tipo.name}
              value={fmtNum(tipo.value)}
              icon={ClipboardList}
              previousValue={fmtNum(tipo.previousValue)}
              trend={tipo.trend}
              loading={loading}
              formula={`Acoes classificadas como ${tipo.name.toLowerCase()} no periodo`}
            />
          ))}
      </div>

      <SectionEyebrow label="GESTAO COMERCIAL" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 opacity-90">
        {(loading || !isEmpty(kpis.oportunidadesAbertas.value)) && (
          <KPICard
            title="Negocios Abertos Trabalhados"
            value={fmtNum(kpis.oportunidadesAbertas.value)}
            icon={Target}
            previousValue={fmtNum(kpis.oportunidadesAbertas.previousValue)}
            trend={kpis.oportunidadesAbertas.trend}
            loading={loading}
            hint={kpis.pipelineAberto.value > 0 ? fmtBRLKpi(kpis.pipelineAberto.value) : undefined}
            formula="Negocios trabalhados (com pelo menos 1 acao concluida) no periodo que CONTINUAM Em Andamento. Nao representa a etapa CRM 'Oportunidade'; e uma foto do estoque de negocios abertos."
            dataSource="rpc_acoes_funil_gestao · negocios canonicos DISTINTOS tocados por acao no periodo (aco_dthconclusao) com ngo_conclusao='Em Andamento'"
          />
        )}
        {(loading || !isEmpty(kpis.visitasPorOportunidade.value)) && (
          <KPICard
            title="Visitas por Negocio Aberto"
            value={fmtRatio(kpis.visitasPorOportunidade.value)}
            icon={Gauge}
            previousValue={fmtRatio(kpis.visitasPorOportunidade.previousValue)}
            trend={kpis.visitasPorOportunidade.trend}
            loading={loading}
            formula="Visitas presenciais registradas por negocio aberto trabalhado. Nao e uma medida da etapa CRM 'Oportunidade'."
            dataSource="rpc_acoes_funil_gestao · visitas / negocios abertos trabalhados no periodo"
          />
        )}
        {(loading || !isEmpty(kpis.diasParados.value)) && (
          <KPICard
            title="Dias Parados (mediana)"
            value={`${num(kpis.diasParados.value)} dias`}
            icon={PauseCircle}
            previousValue={`${num(kpis.diasParados.previousValue)} dias`}
            trend={kpis.diasParados.trend}
            invertTrend
            loading={loading}
            formula="Metade dos negocios em andamento esta sem contato ha mais dias que este numero, e metade ha menos. Mediana alta = carteira esfriando"
            dataSource="rpc_acoes_funil_gestao · MEDIANA de dias desde a ultima acao em negocio comercial 'Em Andamento'"
          />
        )}
      </div>
    </>
  );
}
