import { ClipboardList, Eye } from "lucide-react";
import { KPICard } from "@/components/bi/KPICard";
import { fmtNum, isEmpty } from "@/lib/formatters";
import { SectionEyebrow } from "@/components/bi/SectionEyebrow";
import type { PainelKPIs } from "@/hooks/bi/usePainelKPIsRpc";

interface Props {
  kpis: PainelKPIs;
  loading: boolean;
}

export function PainelAcoesSection({ kpis, loading }: Props) {
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
            formula="COUNT acoes concluidas no periodo"
            dataSource="rpc_acoes_bi › kpis.totalAcoes"
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
            formula="COUNT acoes tipo visita"
            dataSource="rpc_acoes_bi › kpis.visitas"
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
              formula={`COUNT acoes tipo ${tipo.name.toLowerCase()}`}
              dataSource="rpc_acoes_bi › porTipoAcao[]"
            />
          ))}
      </div>
    </>
  );
}
