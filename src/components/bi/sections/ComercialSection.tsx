import {
  Briefcase, Percent, DollarSign, Trophy, Clock, Wallet,
} from "lucide-react";
import { useNegociosBI } from "@/hooks/bi/useNegociosBI";
import { useFunilData } from "@/hooks/bi/useFunilData";
import { KPICard } from "@/components/bi/KPICard";
import { ChartCard } from "@/components/bi/ChartCard";
import { NivoHorizontalBarChart } from "@/components/bi/nivo/NivoBarChart";
import NivoLineChart from "@/components/bi/nivo/NivoLineChart";
import { NIVO_COLORS, POSITIVE_COLOR, NEGATIVE_COLOR } from "@/lib/nivoTheme";
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
          <NivoHorizontalBarChart
            data={agg.funilPorEtapa.map(item => ({ name: item.name, valor: item.valor }))}
            keys={['valor']}
            title=""
            tooltipFormatter={formatBRL}
            colors={[NIVO_COLORS[0]]}
          />
        </ChartCard>

        <ChartCard
          title="Origem do Lead — Conversao"
          description="Negocios por canal de entrada (ganho / perdido / em aberto)"
          loading={isLoading}
        >
          <NivoHorizontalBarChart
            data={agg.porOrigem.map(item => ({
              name: item.name,
              ganhos: item.ganhos,
              perdidos: item.perdidos,
              andamento: item.andamento
            }))}
            keys={['ganhos', 'perdidos', 'andamento']}
            title=""
            tooltipFormatter={(v: number) => v.toLocaleString("pt-BR")}
            colors={[POSITIVE_COLOR, NEGATIVE_COLOR, NIVO_COLORS[1]]}
          />
        </ChartCard>

        <ChartCard
          title="Motivos de Perda — Valor Perdido"
          description="Onde a receita esta vazando (R$ em negocios perdidos)"
          loading={isLoading}
        >
          <NivoHorizontalBarChart
            data={agg.motivosPerda.map(item => ({
              name: item.name,
              valor: item.valor,
              qtd: item.qtd
            }))}
            keys={['valor']}
            title=""
            tooltipFormatter={(v: number) => `${formatBRL(v)} (${v.qtd} negocios)`}
            colors={[NEGATIVE_COLOR]}
          />
        </ChartCard>

        <ChartCard
          title="Velocidade do Funil — Gargalos"
          description="Tempo medio (dias) que negocios permanecem em cada etapa"
          loading={funilLoading}
        >
          <NivoHorizontalBarChart
            data={funil.velocidadePorEtapa.map(item => ({
              name: item.name,
              diasMedio: item.diasMedio,
              qtd: item.qtd
            }))}
            keys={['diasMedio']}
            title=""
            tooltipFormatter={(v: number) => `${formatDias(v)} (${v.qtd} passagens)`}
            colors={[NIVO_COLORS[4]]}
          />
        </ChartCard>

        <ChartCard
          title="Evolucao Mensal de Negocios"
          description="Novos negocios criados e valor negociado por mes"
          loading={isLoading}
        >
          <div className="h-full">
            <div className="grid grid-cols-1 gap-4 h-full">
              <div className="h-1/2">
                <NivoHorizontalBarChart
                  data={agg.evolucaoMensal.map(item => ({ name: item.name, novos: item.novos }))}
                  keys={['novos']}
                  title="Novos negocios"
                  tooltipFormatter={(v: number) => v.toLocaleString("pt-BR")}
                  colors={[NIVO_COLORS[1]]}
                  height={130}
                />
              </div>
              <div className="h-1/2">
                <NivoLineChart
                  data={agg.evolucaoMensal.map(item => ({ x: item.name, y: item.valorCriado }))}
                  title="Valor negociado"
                  color={NIVO_COLORS[0]}
                  height={130}
                  tooltipFormatter={formatBRL}
                />
              </div>
            </div>
          </div>
        </ChartCard>

        <ChartCard
          title="Ranking de Consultores — Valor Ganho"
          description="Top 10 por receita fechada (taxa de conversao no tooltip)"
          loading={isLoading}
        >
          <NivoHorizontalBarChart
            data={agg.rankingConsultor.map(item => ({
              name: item.name,
              valorGanho: item.valorGanho,
              ganhos: item.ganhos,
              total: item.total,
              taxa: item.taxa
            }))}
            keys={['valorGanho']}
            title=""
            tooltipFormatter={(v: number) => `${formatBRL(v)} · ${v.ganhos}/${v.total} (${pct(v.taxa)})`}
            colors={NIVO_COLORS}
          />
        </ChartCard>
      </div>
    </div>
  );
}
