import {
  Briefcase, Percent, DollarSign, Trophy, Clock, Wallet,
} from "lucide-react";
import { type DateRange } from "react-day-picker";
import { useNegociosBIRpc } from "@/hooks/bi/useNegociosBIRpc";
import { KPICard } from "@/components/bi/KPICard";
import { ChartCard } from "@/components/bi/ChartCard";
import { HorizontalBarChart, VerticalBarChart, LineChart } from "@/components/bi/charts";
import { CHART_COLORS, POSITIVE_COLOR, NEGATIVE_COLOR } from "@/lib/chartTheme";
import { formatBRL, formatDias, formatMonthYear, toISODate, getPreviousPeriod, calcTrend } from "@/lib/dateUtils";
import { fmtBRLKpi } from "@/lib/formatters";

import { type CategoriaFilter, CATEGORIA_ALL, getFunisByCategoria, FUNIL_ALL } from "@/lib/categoriaFunil";
import type { RpcNegociosBI } from "@/types/biRpc";

interface Props {
  active: boolean;
  dateRange?: DateRange;
  categoria?: CategoriaFilter;
  funil?: string;
  vendedor?: string;
  cidade?: string;
}

const pct = (v: number) => `${v.toFixed(1)}%`;

function resolveFunis(categoria?: CategoriaFilter, funil?: string): string[] | undefined {
  if (funil && funil !== FUNIL_ALL) return [funil];
  if (categoria && categoria !== CATEGORIA_ALL) return getFunisByCategoria(categoria);
  return undefined;
}

const EMPTY_AGG: RpcNegociosBI = {
  kpis: { totalNegocios: 0, ganhos: 0, perdidos: 0, andamento: 0, taxaConversao: 0, pipelineAberto: 0, pipelinePerdido: 0, valorGanho: 0, ticketMedioGanho: 0, cicloMedioDias: 0, esforcoMedio: 0 },
  funilPorEtapa: [], porOrigem: [], motivosPerda: [], evolucaoMensal: [], rankingConsultor: [],
  velocidadeFunil: [], duracaoMediaTotal: 0,
};

export default function ComercialSection({ active, dateRange, categoria, funil, vendedor, cidade }: Props) {
  const from = toISODate(dateRange?.from);
  const to = toISODate(dateRange?.to ?? dateRange?.from);
  const funis = resolveFunis(categoria, funil);

  const { data: agg = EMPTY_AGG, isLoading } = useNegociosBIRpc({
    from,
    to,
    funis,
    vendedor,
    cidade,
    enabled: active && !!from && !!to,
  });
  const { kpis } = agg;

  // Periodo anterior (mesmo intervalo, 1 ano atras) para analise comparativa
  const prevRange = getPreviousPeriod(dateRange);
  const fromPrev = toISODate(prevRange?.from);
  const toPrev = toISODate(prevRange?.to ?? prevRange?.from);
  const { data: aggPrev } = useNegociosBIRpc({
    from: fromPrev,
    to: toPrev,
    funis,
    vendedor,
    cidade,
    enabled: active && !!fromPrev && !!toPrev,
  });
  const kpisPrev = aggPrev?.kpis ?? EMPTY_AGG.kpis;

  return (
    <div className="space-y-6 pt-4">
      <div className="flex justify-end mb-2">
        <a
          href="/performance"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          Ver metas e planejamento →
        </a>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard
          title="Negocios" value={kpis.totalNegocios.toLocaleString("pt-BR")}
          icon={Briefcase} loading={isLoading}
          previousValue={kpisPrev.totalNegocios.toLocaleString("pt-BR")}
          trend={calcTrend(kpis.totalNegocios, kpisPrev.totalNegocios)}
          hint={`${kpis.ganhos} ganhos · ${kpis.perdidos} perdidos · ${kpis.andamento} em aberto`}
          dataSource="mirror.crm_negocios · COUNT(DISTINCT ngo_numero) por ngo_datafechamento"
        />
        <KPICard
          title="Taxa de Conversao" value={pct(kpis.taxaConversao)}
          icon={Percent} loading={isLoading}
          previousValue={pct(kpisPrev.taxaConversao)}
          trend={calcTrend(kpis.taxaConversao, kpisPrev.taxaConversao)}
          hint="ganhos / (ganhos + perdidos)"
          dataSource="mirror.crm_negocios · ganhos/(ganhos+perdidos)×100 via ngo_conclusao"
        />
        <KPICard
          title="Pipeline Aberto" value={fmtBRLKpi(kpis.pipelineAberto)}
          icon={Wallet} loading={isLoading}
          previousValue={fmtBRLKpi(kpisPrev.pipelineAberto)}
          trend={calcTrend(kpis.pipelineAberto, kpisPrev.pipelineAberto)}
          hint="valor em negocios em andamento"
          dataSource="mirror.crm_negocios · SUM(ngo_vlrtotalnegociado) WHERE sem conclusao"
        />
        <KPICard
          title="Pipeline Perdido" value={fmtBRLKpi(kpis.pipelinePerdido)}
          icon={Wallet} loading={isLoading}
          previousValue={fmtBRLKpi(kpisPrev.pipelinePerdido)}
          trend={calcTrend(kpis.pipelinePerdido, kpisPrev.pipelinePerdido)}
          invertTrend
          hint="valor em negocios perdidos"
          dataSource="mirror.crm_negocios · SUM(ngo_vlrtotalnegociado) WHERE ngo_conclusao='perdido'"
        />
        <KPICard
          title="Valor Ganho" value={fmtBRLKpi(kpis.valorGanho)}
          icon={DollarSign} loading={isLoading}
          previousValue={fmtBRLKpi(kpisPrev.valorGanho)}
          trend={calcTrend(kpis.valorGanho, kpisPrev.valorGanho)}
          hint={`ticket medio ${formatBRL(kpis.ticketMedioGanho)}`}
          dataSource="mirror.crm_negocios · SUM(ngo_vlrtotalnegociado) WHERE ngo_conclusao='ganho'"
        />
        <KPICard
          title="Ciclo de Vendas" value={formatDias(kpis.cicloMedioDias)}
          icon={Clock} loading={isLoading}
          previousValue={formatDias(kpisPrev.cicloMedioDias)}
          trend={calcTrend(kpis.cicloMedioDias, kpisPrev.cicloMedioDias)}
          invertTrend
          hint="media nos negocios concluidos"
          dataSource="mirror.crm_negocios · AVG(ngo_ciclovendas) WHERE ganho"
        />
        <KPICard
          title="Esforco Medio" value={kpis.esforcoMedio.toFixed(1)}
          icon={Trophy} loading={isLoading}
          previousValue={kpisPrev.esforcoMedio.toFixed(1)}
          trend={calcTrend(kpis.esforcoMedio, kpisPrev.esforcoMedio)}
          hint="acoes por negocio"
          dataSource="mirror.crm_negocios · AVG(ngo_qtdacoes)"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard
          title="Funil de Vendas — Pipeline por Etapa"
          description="Valor em aberto (R$) acumulado em cada etapa do funil"
          dataSource="mirror.crm_negocios · ngo_etapa, SUM(ngo_vlrtotalnegociado)"
          loading={isLoading}
        >
          <HorizontalBarChart
            data={agg.funilPorEtapa.map(item => ({ name: item.name, valor: item.valor }))}
            keys={['valor']}
            seriesLabels={{ valor: "Valor (R$)" }}
            title=""
            tooltipFormatter={formatBRL}
            colors={[CHART_COLORS[0]]}
          />
        </ChartCard>

        <ChartCard
          title="Origem do Lead — Conversao"
          description="Negocios por canal de entrada (ganho / perdido / em aberto)"
          dataSource="mirror.crm_negocios · ngo_formaentrada, COUNT(*) ganho/perdido/andamento"
          loading={isLoading}
        >
          <HorizontalBarChart
            data={agg.porOrigem.map(item => ({
              name: item.name,
              ganhos: item.ganhos,
              perdidos: item.perdidos,
              andamento: item.andamento
            }))}
            keys={['ganhos', 'perdidos', 'andamento']}
            title=""
            tooltipFormatter={(v: number) => v.toLocaleString("pt-BR")}
            colors={[POSITIVE_COLOR, NEGATIVE_COLOR, CHART_COLORS[1]]}
          />
        </ChartCard>

        <ChartCard
          title="Motivos de Perda — Valor Perdido"
          description="Onde a receita esta vazando (R$ em negocios perdidos)"
          dataSource="mirror.crm_negocios · ngo_motivoperda, SUM(ngo_vlrtotalnegociado) WHERE perdido"
          loading={isLoading}
        >
          <HorizontalBarChart
            data={agg.motivosPerda.map(item => ({
              name: item.name,
              valor: item.valor,
              qtd: item.qtd
            }))}
            keys={['valor']}
            seriesLabels={{ valor: "Valor Perdido" }}
            title=""
            tooltipFormatter={(value, d) => `${formatBRL(value)} (${d?.qtd ?? 0} negocios)`}
            colors={[NEGATIVE_COLOR]}
          />
        </ChartCard>

        <ChartCard
          title="Velocidade do Funil — Gargalos"
          description="Tempo medio (dias) que negocios permanecem em cada etapa"
          dataSource="mirror.crm_negocios · ngo_etapa, AVG(ngo_ciclovendas)"
          loading={isLoading}
        >
          <HorizontalBarChart
            data={agg.velocidadeFunil.map(item => ({
              name: item.name,
              diasMedio: item.diasMedio,
              qtd: item.qtd
            }))}
            keys={['diasMedio']}
            seriesLabels={{ diasMedio: "Dias (média)" }}
            title=""
            tooltipFormatter={(value, d) => `${formatDias(value)} (${d?.qtd ?? 0} passagens)`}
            colors={[CHART_COLORS[4]]}
          />
        </ChartCard>

        <ChartCard
          title="Evolucao Mensal de Negocios"
          description="Novos negocios criados e valor negociado por mes"
          infoTooltip="Por data de cadastro do negócio"
          dataSource="mirror.crm_negocios · ngo_datafechamento→YYYY-MM, COUNT(*) + SUM(ngo_vlrtotalnegociado)"
          loading={isLoading}
        >
          <div className="h-full">
            <div className="grid grid-cols-1 gap-4 h-full">
              <div className="h-1/2">
                <VerticalBarChart
                  data={agg.evolucaoMensal.map(item => ({ name: formatMonthYear(item.name), novos: item.novos }))}
                  keys={['novos']}
                  seriesLabels={{ novos: "Novos negócios" }}
                  title="Novos negocios"
                  tooltipFormatter={(v: number) => v.toLocaleString("pt-BR")}
                  colors={[CHART_COLORS[1]]}
                  height={130}
                />
              </div>
              <div className="h-1/2">
                <LineChart
                  data={agg.evolucaoMensal.map(item => ({ x: formatMonthYear(item.name), y: item.valorCriado }))}
                  seriesName="Valor negociado"
                  color={CHART_COLORS[0]}
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
          dataSource="mirror.crm_negocios · ngo_vendedores, SUM(ngo_vlrtotalnegociado) WHERE ganho"
          loading={isLoading}
        >
          <HorizontalBarChart
            data={agg.rankingConsultor.map(item => ({
              name: item.name,
              valorGanho: item.valorGanho,
              ganhos: item.ganhos,
              total: item.total,
              taxa: item.taxa
            }))}
            keys={['valorGanho']}
            seriesLabels={{ valorGanho: "Valor Ganho" }}
            title=""
            tooltipFormatter={(value, d) => `${formatBRL(value)} · ${d?.ganhos ?? 0}/${d?.total ?? 0} (${pct((d?.taxa as number) ?? 0)})`}
            colors={CHART_COLORS}
          />
        </ChartCard>
      </div>
    </div>
  );
}
