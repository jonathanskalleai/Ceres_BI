import {
  BarChart, Bar, ComposedChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, Cell,
} from "recharts";
import {
  Briefcase, Percent, DollarSign, Trophy, Clock, Wallet,
} from "lucide-react";
import { useNegociosBI } from "@/hooks/bi/useNegociosBI";
import { useFunilData } from "@/hooks/bi/useFunilData";
import { KPICard } from "@/components/bi/KPICard";
import { ChartCard } from "@/components/bi/ChartCard";
import { CHART_COLORS, COLOR_POSITIVE, COLOR_NEGATIVE } from "@/lib/chartColors";
import { formatBRL, formatBRLShort, formatDias } from "@/lib/dateUtils";

interface Props {
  active: boolean;
}

const pct = (v: number) => `${v.toFixed(1)}%`;

export default function ComercialSection({ active }: Props) {
  const { agg, isLoading } = useNegociosBI(active);
  const { agg: funil, isLoading: funilLoading } = useFunilData(active);
  const { kpis } = agg;

  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard
          title="Negocios" value={kpis.totalNegocios.toLocaleString("pt-BR")}
          icon={Briefcase} loading={isLoading}
          hint={`${kpis.ganhos} ganhos · ${kpis.perdidos} perdidos · ${kpis.andamento} em aberto`}
        />
        <KPICard
          title="Taxa de Conversao" value={pct(kpis.taxaConversao)}
          icon={Percent} loading={isLoading}
          hint="ganhos / (ganhos + perdidos)"
        />
        <KPICard
          title="Pipeline Aberto" value={formatBRL(kpis.pipelineAberto)}
          icon={Wallet} loading={isLoading}
          hint="valor em negocios em andamento"
        />
        <KPICard
          title="Valor Ganho" value={formatBRL(kpis.valorGanho)}
          icon={DollarSign} loading={isLoading}
          hint={`ticket medio ${formatBRL(kpis.ticketMedioGanho)}`}
        />
        <KPICard
          title="Ciclo de Vendas" value={formatDias(kpis.cicloMedioDias)}
          icon={Clock} loading={isLoading}
          hint="media nos negocios concluidos"
        />
        <KPICard
          title="Esforco Medio" value={kpis.esforcoMedio.toFixed(1)}
          icon={Trophy} loading={isLoading}
          hint="acoes por negocio"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard
          title="Funil de Vendas — Pipeline por Etapa"
          description="Valor em aberto (R$) acumulado em cada etapa do funil"
          loading={isLoading}
        >
          <BarChart data={agg.funilPorEtapa} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatBRLShort} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
            <Tooltip formatter={(v: number) => formatBRL(v)} />
            <Bar dataKey="valor" name="Valor em aberto" fill={CHART_COLORS[0]} />
          </BarChart>
        </ChartCard>

        <ChartCard
          title="Origem do Lead — Conversao"
          description="Negocios por canal de entrada (ganho / perdido / em aberto)"
          loading={isLoading}
        >
          <BarChart data={agg.porOrigem} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
            <Tooltip />
            <Legend />
            <Bar dataKey="ganhos" stackId="a" name="Ganhos" fill={COLOR_POSITIVE} />
            <Bar dataKey="perdidos" stackId="a" name="Perdidos" fill={COLOR_NEGATIVE} />
            <Bar dataKey="andamento" stackId="a" name="Em aberto" fill={CHART_COLORS[1]} />
          </BarChart>
        </ChartCard>

        <ChartCard
          title="Motivos de Perda — Valor Perdido"
          description="Onde a receita esta vazando (R$ em negocios perdidos)"
          loading={isLoading}
        >
          <BarChart data={agg.motivosPerda} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatBRLShort} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
            <Tooltip formatter={(v: number, _n, p) => [`${formatBRL(v)} (${p.payload.qtd} negocios)`, "Perdido"]} />
            <Bar dataKey="valor" fill={COLOR_NEGATIVE} />
          </BarChart>
        </ChartCard>

        <ChartCard
          title="Velocidade do Funil — Gargalos"
          description="Tempo medio (dias) que negocios permanecem em cada etapa"
          loading={funilLoading}
        >
          <BarChart data={funil.velocidadePorEtapa} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${Math.round(v)}d`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
            <Tooltip formatter={(v: number, _n, p) => [`${formatDias(v)} (${p.payload.qtd} passagens)`, "Tempo medio"]} />
            <Bar dataKey="diasMedio" fill={CHART_COLORS[4]} />
          </BarChart>
        </ChartCard>

        <ChartCard
          title="Evolucao Mensal de Negocios"
          description="Novos negocios criados e valor negociado por mes"
          loading={isLoading}
        >
          <ComposedChart data={agg.evolucaoMensal}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={formatBRLShort} />
            <Tooltip formatter={(v: number, n) => (n === "Valor negociado" ? formatBRL(v) : v)} />
            <Legend />
            <Bar yAxisId="left" dataKey="novos" name="Novos negocios" fill={CHART_COLORS[1]} />
            <Line yAxisId="right" type="monotone" dataKey="valorCriado" name="Valor negociado" stroke={CHART_COLORS[0]} dot={false} />
          </ComposedChart>
        </ChartCard>

        <ChartCard
          title="Ranking de Consultores — Valor Ganho"
          description="Top 10 por receita fechada (taxa de conversao no tooltip)"
          loading={isLoading}
        >
          <BarChart data={agg.rankingConsultor} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={formatBRLShort} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
            <Tooltip formatter={(v: number, _n, p) => [`${formatBRL(v)} · ${p.payload.ganhos}/${p.payload.total} (${pct(p.payload.taxa)})`, "Ganho"]} />
            <Bar dataKey="valorGanho">
              {agg.rankingConsultor.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ChartCard>
      </div>
    </div>
  );
}
