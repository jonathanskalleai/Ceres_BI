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
          hint="Clientes ja compradores na carteira"
          formula="Conta clientes que nao sao prospects (ja tem historico de compra)"
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
          hint="Potenciais clientes em prospecao"
          formula="Conta contatos marcados como prospect que ainda nao compraram"
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
          hint="Total de maquinas na base de clientes"
          formula="Soma todas as maquinas registradas no parque dos clientes"
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
          hint="Quanto da carteira foi trabalhada"
          formula="Percentual de clientes ativos que receberam alguma acao no periodo"
        />
      )}
    </>
  );
}
