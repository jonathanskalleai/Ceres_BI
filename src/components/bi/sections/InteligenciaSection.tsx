import { type DateRange } from "react-day-picker";
import { useInteligenciaBIRpc } from "@/hooks/bi/useInteligenciaBIRpc";
import { ChartCard } from "@/components/bi/ChartCard";
import { HorizontalBarChart, PieChart } from "@/components/bi/charts";
import { CHART_COLORS, POSITIVE_COLOR, NEGATIVE_COLOR } from "@/lib/chartTheme";
import { formatBRL } from "@/lib/dateUtils";
import { type CategoriaFilter } from "@/lib/categoriaFunil";

interface Props {
  active: boolean;
  dateRange?: DateRange;
  categoria?: CategoriaFilter;
  funil?: string;
}

function SectionTitle({ label }: { label: string }) {
  return (
    <h3
      className="text-[10px] tracking-[0.22em] uppercase mt-4"
      style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}
    >
      {"— "}{label}
    </h3>
  );
}

export default function InteligenciaSection({ active, dateRange, categoria, funil }: Props) {
  const data = useInteligenciaBIRpc(active, dateRange, categoria, funil);
  const { isLoading } = data;

  const winRateData = data.winRatePorVendedor.map((v) => ({
    name: v.name,
    ganhos: v.ganhos,
    perdidos: v.perdidos,
  }));

  const motivosData = data.motivosPerda.map((m) => ({
    name: m.name,
    valor: m.valor,
  }));

  const visitasData = data.visitasPorNegocioGanho.map((v) => ({
    name: v.name,
    ratio: v.ratio,
  }));

  const mixData = [
    { id: "financiado", name: "Financiado", value: data.mixFaturamento.financiado },
    { id: "recursoProprio", name: "Recurso Proprio", value: data.mixFaturamento.recursoProprio },
  ];

  const bancosData = data.sharePorBanco.map((b) => ({
    name: b.name,
    valor: b.valor,
  }));

  const cidadesData = data.receitaPorCidade.map((c) => ({
    name: c.cidade,
    valor: c.valor,
  }));

  const frotaData = data.frotaRenovacao.map((f) => ({
    name: f.isNossaMarca ? `${f.marca} ★` : f.marca,
    totalMaquinas: f.totalMaquinas,
  }));

  const filialData = data.slaPorFilial.map((f) => ({
    name: f.filial,
    mediaDias: f.mediaDias,
  }));

  const tipoData = data.slaPorTipoOS.map((t) => ({
    name: t.tipo,
    mediaDias: t.mediaDias,
  }));

  return (
    <div className="space-y-8 pt-4">
      {/* BLOCO 1: Funil & Esforco */}
      <SectionTitle label="EFICIENCIA DO FUNIL" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {winRateData.length > 0 && (
          <ChartCard
            title="Win Rate por Vendedor"
            description="Negocios ganhos vs perdidos por consultor"
            loading={isLoading}
          >
            <HorizontalBarChart
              data={winRateData}
              keys={["ganhos", "perdidos"]}
              seriesLabels={{ ganhos: "Ganhos", perdidos: "Perdidos" }}
              colors={[POSITIVE_COLOR, NEGATIVE_COLOR]}
              tooltipFormatter={(v: number) => v.toLocaleString("pt-BR")}
            />
          </ChartCard>
        )}
        {motivosData.length > 0 && (
          <ChartCard
            title="Motivos de Perda (Top 8)"
            description="Principais razoes de perda por valor"
            loading={isLoading}
          >
            <HorizontalBarChart
              data={motivosData}
              keys={["valor"]}
              seriesLabels={{ valor: "Valor Perdido" }}
              colors={[NEGATIVE_COLOR]}
              tooltipFormatter={formatBRL}
            />
          </ChartCard>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visitasData.length > 0 && (
          <ChartCard
            title="Visitas por Negocio Ganho"
            description="Esforco medio em visitas para fechar"
            loading={isLoading}
          >
            <HorizontalBarChart
              data={visitasData}
              keys={["ratio"]}
              seriesLabels={{ ratio: "Visitas/Negocio" }}
              colors={[CHART_COLORS[3]]}
              tooltipFormatter={(v: number) => v.toFixed(1)}
            />
          </ChartCard>
        )}
      </div>

      {/* BLOCO 2: Performance Financeira */}
      <SectionTitle label="PERFORMANCE FINANCEIRA" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(mixData[0].value > 0 || mixData[1].value > 0) && (
          <ChartCard
            title="Mix de Pagamento"
            description="Financiado vs Recurso Proprio"
            loading={isLoading}
          >
            <PieChart
              data={mixData}
              colors={[CHART_COLORS[0], CHART_COLORS[1]]}
              tooltipFormatter={formatBRL}
            />
          </ChartCard>
        )}
        {bancosData.length > 0 && (
          <ChartCard
            title="Share por Banco Financiador"
            description="Distribuicao de valor por instituicao"
            loading={isLoading}
          >
            <HorizontalBarChart
              data={bancosData}
              keys={["valor"]}
              seriesLabels={{ valor: "Valor (R$)" }}
              colors={CHART_COLORS}
              tooltipFormatter={formatBRL}
            />
          </ChartCard>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cidadesData.length > 0 && (
          <ChartCard
            title="Receita por Cidade (Top 10)"
            description="Maiores mercados por valor ganho"
            loading={isLoading}
          >
            <HorizontalBarChart
              data={cidadesData}
              keys={["valor"]}
              seriesLabels={{ valor: "Receita (R$)" }}
              colors={[CHART_COLORS[0]]}
              tooltipFormatter={formatBRL}
            />
          </ChartCard>
        )}
      </div>

      {/* BLOCO 3: Inteligencia de Mercado */}
      <SectionTitle label="INTELIGENCIA DE MERCADO" />
      <div className="grid grid-cols-1 gap-4">
        {frotaData.length > 0 && (
          <ChartCard
            title="Frota com +5 Anos por Marca"
            description="Oportunidade de renovacao"
            loading={isLoading}
          >
            <HorizontalBarChart
              data={frotaData}
              keys={["totalMaquinas"]}
              seriesLabels={{ totalMaquinas: "Maquinas" }}
              colors={[CHART_COLORS[5]]}
              tooltipFormatter={(v: number) => v.toLocaleString("pt-BR")}
            />
          </ChartCard>
        )}
      </div>

      {/* BLOCO 4: Pos-Venda / SLA */}
      <SectionTitle label="POS-VENDA / SLA" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filialData.length > 0 && (
          <ChartCard
            title="Tempo Medio OS por Filial"
            description="Dias medios para conclusao por filial"
            loading={isLoading}
          >
            <HorizontalBarChart
              data={filialData}
              keys={["mediaDias"]}
              seriesLabels={{ mediaDias: "Dias (media)" }}
              colors={[CHART_COLORS[4]]}
              tooltipFormatter={(v: number) => `${v.toFixed(1)} dias`}
            />
          </ChartCard>
        )}
        {tipoData.length > 0 && (
          <ChartCard
            title="Tempo Medio OS por Tipo"
            description="Dias medios para conclusao por tipo de OS"
            loading={isLoading}
          >
            <HorizontalBarChart
              data={tipoData}
              keys={["mediaDias"]}
              seriesLabels={{ mediaDias: "Dias (media)" }}
              colors={[CHART_COLORS[4]]}
              tooltipFormatter={(v: number) => `${v.toFixed(1)} dias`}
            />
          </ChartCard>
        )}
      </div>
    </div>
  );
}
