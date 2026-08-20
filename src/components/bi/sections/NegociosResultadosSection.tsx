import { BriefcaseBusiness, CalendarDays, CircleX, Trophy, Wallet } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { ChartCard } from "@/components/bi/ChartCard";
import { KPICard } from "@/components/bi/KPICard";
import { HorizontalBarChart, VerticalBarChart } from "@/components/bi/charts";
import { useResultadosNegociosBIRpc } from "@/hooks/bi/useResultadosNegociosBIRpc";
import { CHART_COLORS, NEGATIVE_COLOR, POSITIVE_COLOR } from "@/lib/chartTheme";
import { formatBRL, formatMonthYear, toISODate } from "@/lib/dateUtils";
import { fmtBRLKpi } from "@/lib/formatters";
import type { RpcResultadosNegociosBI } from "@/types/biRpc";

interface Props {
  active: boolean;
  dateRange?: DateRange;
  vendedor?: string;
  cidade?: string;
}

const EMPTY_AGG: RpcResultadosNegociosBI = {
  kpis: {
    pedidosGanhos: 0,
    valorGanho: 0,
    negociosPerdidos: 0,
    valorPerdido: 0,
    pipelineGeradoAberto: 0,
    valorPipelineGeradoAberto: 0,
    carteiraAtivaTrabalhada: 0,
    valorCarteiraAtivaTrabalhada: 0,
  },
  funilPorEtapa: [],
  previsao90Dias: [],
  origemLead: [],
  equipamentosPipeline: [],
  motivosPerda: [],
  cobertura: { carteiraAtiva: 0, comOrigem: 0, comDataPrevisao: 0, previstos90Dias: 0 },
};

/**
 * Visão de negócio reconciliada: os KPIs usam as mesmas regras de Ações e os
 * gráficos exploram apenas atributos cujo grão não duplica o valor do negócio.
 */
export default function NegociosResultadosSection({ active, dateRange, vendedor, cidade }: Props) {
  const from = toISODate(dateRange?.from);
  const to = toISODate(dateRange?.to ?? dateRange?.from);
  const enabled = active && !!from && !!to;
  const { data: agg = EMPTY_AGG, isLoading } = useResultadosNegociosBIRpc({
    from,
    to,
    vendedor,
    cidade,
    enabled,
  });
  const { kpis, cobertura } = agg;

  return (
    <div className="space-y-6 pt-4">
      <p className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
        <strong className="text-foreground">Base conciliada com Ações:</strong>{" "}
        ganho é pedido aprovado na data de aprovação; perda é negócio fechado como perdido; Repasse de Máquina fica fora.
        Os dois pipelines abaixo têm recortes diferentes e complementares.
      </p>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KPICard
          title="Pedidos Ganhos"
          value={kpis.pedidosGanhos.toLocaleString("pt-BR")}
          icon={Trophy}
          loading={isLoading}
          hint={`${fmtBRLKpi(kpis.valorGanho)} aprovados no período`}
          rawValue={kpis.valorGanho}
        />
        <KPICard
          title="Valor Ganho"
          value={fmtBRLKpi(kpis.valorGanho)}
          icon={Wallet}
          accentColor="success"
          loading={isLoading}
          hint={`${kpis.pedidosGanhos.toLocaleString("pt-BR")} pedidos aprovados`}
          rawValue={kpis.valorGanho}
        />
        <KPICard
          title="Negócios Perdidos"
          value={kpis.negociosPerdidos.toLocaleString("pt-BR")}
          icon={CircleX}
          accentColor="danger"
          loading={isLoading}
          hint={`${fmtBRLKpi(kpis.valorPerdido)} em valor potencial`}
          rawValue={kpis.valorPerdido}
        />
        <KPICard
          title="Valor Perdido"
          value={fmtBRLKpi(kpis.valorPerdido)}
          icon={CircleX}
          accentColor="danger"
          loading={isLoading}
          hint={`${kpis.negociosPerdidos.toLocaleString("pt-BR")} negócios fechados no período`}
          rawValue={kpis.valorPerdido}
        />
        <KPICard
          title="Pipeline Gerado e Aberto"
          value={fmtBRLKpi(kpis.valorPipelineGeradoAberto)}
          icon={BriefcaseBusiness}
          loading={isLoading}
          hint={`${kpis.pipelineGeradoAberto.toLocaleString("pt-BR")} oportunidades entraram em VENDAS no período e seguem abertas`}
          rawValue={kpis.valorPipelineGeradoAberto}
        />
        <KPICard
          title="Carteira Ativa Trabalhada"
          value={fmtBRLKpi(kpis.valorCarteiraAtivaTrabalhada)}
          icon={BriefcaseBusiness}
          loading={isLoading}
          hint={`${kpis.carteiraAtivaTrabalhada.toLocaleString("pt-BR")} negócios em aberto com ação concluída no período`}
          rawValue={kpis.valorCarteiraAtivaTrabalhada}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ChartCard
          title="Funil de Vendas — Carteira Ativa por Etapa"
          description="Valor da carteira em andamento que recebeu ao menos uma ação concluída no período. Uma mesma oportunidade fica em apenas uma etapa atual."
          loading={isLoading}
        >
          <HorizontalBarChart
            data={agg.funilPorEtapa.map((item) => ({ ...item }))}
            keys={["valor"]}
            seriesLabels={{ valor: "Valor da carteira" }}
            title=""
            tooltipFormatter={(value, datum) => `${formatBRL(value)} · ${datum?.negocios ?? 0} negócios`}
            colors={[CHART_COLORS[0]]}
          />
        </ChartCard>

        <ChartCard
          title="Projeção Ponderada de Fechamento"
          description={`Próximos 90 dias: valor do negócio × probabilidade do CRM (0–5 estrelas). ${cobertura.previstos90Dias} de ${cobertura.carteiraAtiva} negócios ativos têm previsão nessa janela.`}
          loading={isLoading}
        >
          <VerticalBarChart
            data={agg.previsao90Dias.map((item) => ({ ...item, name: formatMonthYear(item.name) }))}
            keys={["valorPonderado"]}
            seriesLabels={{ valorPonderado: "Valor ponderado" }}
            title=""
            tooltipFormatter={(value, datum) => `${formatBRL(value)} · ${datum?.negocios ?? 0} negócios · bruto ${formatBRL(Number(datum?.valorBruto ?? 0))}`}
            colors={[POSITIVE_COLOR]}
          />
        </ChartCard>

        <ChartCard
          title="Origem da Carteira Ativa"
          description={`${cobertura.comOrigem} de ${cobertura.carteiraAtiva} negócios ativos têm origem preenchida. “Não informado” expõe a lacuna de cadastro, em vez de escondê-la.`}
          loading={isLoading}
        >
          <HorizontalBarChart
            data={agg.origemLead.map((item) => ({ ...item }))}
            keys={["negocios"]}
            seriesLabels={{ negocios: "Negócios" }}
            title=""
            tooltipFormatter={(value, datum) => `${value.toLocaleString("pt-BR")} negócios · ${formatBRL(Number(datum?.valor ?? 0))}`}
            colors={[CHART_COLORS[1]]}
          />
        </ChartCard>

        <ChartCard
          title="Equipamentos em Negociação"
          description="Itens vinculados à carteira ativa por grupo de produto. Um negócio com vários itens pode aparecer em mais de um grupo; por isso este gráfico não soma valores de negócio."
          loading={isLoading}
        >
          <HorizontalBarChart
            data={agg.equipamentosPipeline.map((item) => ({ ...item }))}
            keys={["itens"]}
            seriesLabels={{ itens: "Itens" }}
            title=""
            tooltipFormatter={(value, datum) => `${value.toLocaleString("pt-BR")} itens · ${datum?.negocios ?? 0} negócios`}
            colors={[CHART_COLORS[4]]}
          />
        </ChartCard>

        <ChartCard
          title="Motivos de Perda"
          description="Valor potencial dos negócios fechados como perdidos dentro do período selecionado."
          loading={isLoading}
          className="md:col-span-2"
        >
          <HorizontalBarChart
            data={agg.motivosPerda.map((item) => ({ ...item }))}
            keys={["valor"]}
            seriesLabels={{ valor: "Valor potencial perdido" }}
            title=""
            tooltipFormatter={(value, datum) => `${formatBRL(value)} · ${datum?.negocios ?? 0} negócios`}
            colors={[NEGATIVE_COLOR]}
          />
        </ChartCard>
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5" />
        Período, vendedor e cidade filtram toda esta visão. Probabilidade e data de previsão são sinais de CRM; cobertura incompleta é exibida nos próprios gráficos.
      </p>
    </div>
  );
}
