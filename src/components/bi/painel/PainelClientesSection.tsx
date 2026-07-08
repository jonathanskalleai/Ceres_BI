import { Users, Wrench, Target } from "lucide-react";
import { KPICard } from "@/components/bi/KPICard";
import { fmtNum, fmtPct, isEmpty } from "@/lib/formatters";
import type { ClientesKPIs } from "@/types/clientesKpis";

interface Props {
  cliKpis: ClientesKPIs;
  loading: boolean;
}

export function PainelClientesSection({ cliKpis, loading }: Props) {
  return (
    <>
      {(loading || !isEmpty(cliKpis.clientesAtivos.value)) && (
        <KPICard
          title="Clientes Ativos"
          value={fmtNum(cliKpis.clientesAtivos.value)}
          icon={Users}
          previousValue={fmtNum(cliKpis.clientesAtivos.previousValue)}
          trend={cliKpis.clientesAtivos.trend}
          loading={loading}
          formula="Clientes que ja compraram — nao sao prospects"
        />
      )}
      {(loading || !isEmpty(cliKpis.prospects.value)) && (
        <KPICard
          title="Prospects"
          value={fmtNum(cliKpis.prospects.value)}
          icon={Users}
          previousValue={fmtNum(cliKpis.prospects.previousValue)}
          trend={cliKpis.prospects.trend}
          loading={loading}
          accentColor="var(--voux-champagne-400, #d4a574)"
          formula="Potenciais clientes em prospecao que ainda nao compraram"
        />
      )}
      {(loading || !isEmpty(cliKpis.parqueMaquinas.value)) && (
        <KPICard
          title="Parque Maquinas"
          value={fmtNum(cliKpis.parqueMaquinas.value)}
          icon={Wrench}
          previousValue={fmtNum(cliKpis.parqueMaquinas.previousValue)}
          trend={cliKpis.parqueMaquinas.trend}
          loading={loading}
          formula="Total de maquinas registradas no parque de todos os clientes"
        />
      )}
      {(loading || !isEmpty(cliKpis.coberturaComercial.value)) && (
        <KPICard
          title="Cobertura Comercial"
          value={fmtPct(cliKpis.coberturaComercial.value)}
          icon={Target}
          previousValue={fmtPct(cliKpis.coberturaComercial.previousValue)}
          trend={cliKpis.coberturaComercial.trend}
          loading={loading}
          formula="Quanto da carteira foi trabalhada — % de clientes que receberam acao no periodo"
        />
      )}
    </>
  );
}
