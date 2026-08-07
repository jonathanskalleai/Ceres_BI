import {
  TrendingUp, TrendingDown, Briefcase, Target, Activity,
} from "lucide-react";
import { KPICard } from "@/components/bi/KPICard";
import { fmtNum, fmtPct, isEmpty } from "@/lib/formatters";
import type { PainelKPIs } from "@/hooks/bi/usePainelKPIsRpc";

interface Props {
  kpis: PainelKPIs;
  loading: boolean;
}

export function PainelNegociosSection({ kpis, loading }: Props) {
  return (
    <>
      {(loading || !isEmpty(kpis.totalNegocios.value)) && (
        <KPICard
          title="Total Negocios"
          value={fmtNum(kpis.totalNegocios.value)}
          icon={Briefcase}
          previousValue={fmtNum(kpis.totalNegocios.previousValue)}
          trend={kpis.totalNegocios.trend}
          loading={loading}
          formula="Quantidade de negocios diferentes no periodo. Conta cada negocio uma unica vez, mesmo que tenha varios produtos"
        />
      )}
      {(loading || !isEmpty(kpis.ganhos.value)) && (
        <KPICard
          title="Ganhos"
          value={fmtNum(kpis.ganhos.value)}
          icon={TrendingUp}
          previousValue={fmtNum(kpis.ganhos.previousValue)}
          trend={kpis.ganhos.trend}
          loading={loading}
          accentColor="var(--voux-success)"
          formula="Quantidade de PEDIDOS APROVADOS no periodo (contados pela data de aprovacao), cujo negocio esta Ganho. E pedido, nao negocio — um negocio pode gerar varios pedidos"
          dataSource="mirror.crm_pedidos dedup por pdo_codigointerno · pdo_situacaopedido='Aprovado' · negocio canonico com ngo_conclusao='Ganho'"
        />
      )}
      {(loading || !isEmpty(kpis.perdidos.value)) && (
        <KPICard
          title="Perdidos"
          value={fmtNum(kpis.perdidos.value)}
          icon={TrendingDown}
          previousValue={fmtNum(kpis.perdidos.previousValue)}
          trend={kpis.perdidos.trend}
          invertTrend
          loading={loading}
          accentColor="var(--voux-danger)"
          formula="Quantidade de NEGOCIOS que fecharam como Perdido no periodo (contados pela data de fechamento). Sao negocios, nao pedidos — um negocio perdido pode ter gerado varios pedidos cancelados"
          dataSource="mirror.crm_negocios canonizado por ngo_numero · ngo_conclusao='Perdido' · data de competencia: ngo_datafechamento"
        />
      )}
      {(loading || !isEmpty(kpis.andamento.value)) && (
        <KPICard
          title="Em Andamento"
          value={fmtNum(kpis.andamento.value)}
          icon={Activity}
          previousValue={fmtNum(kpis.andamento.previousValue)}
          trend={kpis.andamento.trend}
          loading={loading}
          formula="Negocios ainda abertos, sem resultado definido"
        />
      )}
      {(loading || !isEmpty(kpis.taxaConversao.value)) && (
        <KPICard
          title="Taxa de Conversao"
          value={fmtPct(kpis.taxaConversao.value)}
          icon={Target}
          previousValue={fmtPct(kpis.taxaConversao.previousValue)}
          trend={kpis.taxaConversao.trend}
          loading={loading}
          formula="Dos negocios que tiveram resultado, quantos % foram ganhos"
        />
      )}
    </>
  );
}
