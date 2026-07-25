import { useCallback, useMemo, useState } from "react";
import { type DateRange } from "react-day-picker";
import { useAcoesBIRpc } from "@/hooks/bi/useAcoesBIRpc";
import { useAcoesDetalheRpc } from "@/hooks/bi/useAcoesDetalheRpc";
import { useClientesRiscoRpc } from "@/hooks/bi/useClientesRiscoRpc";
import { useAcoesFunilRpc } from "@/hooks/bi/useAcoesFunilRpc";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { ChartCard } from "@/components/bi/ChartCard";
import { AcoesRankingTable } from "@/components/bi/AcoesRankingTable";
import { AcoesClientesTable } from "@/components/bi/AcoesClientesTable";
import { AcoesDetailWithFilter } from "@/components/bi/sections/AcoesDetailWithFilter";
import { AcoesKpiGrid } from "@/components/bi/sections/AcoesKpiGrid";
import { AcoesFunilConversao } from "@/components/bi/sections/AcoesFunilConversao";
import { AcoesRankingConsultores } from "@/components/bi/sections/AcoesRankingConsultores";
import { AcoesEsforcoRetorno } from "@/components/bi/sections/AcoesEsforcoRetorno";
import { AcoesGestaoCarteira, type CarteiraDrill } from "@/components/bi/sections/AcoesGestaoCarteira";
import { AcoesMapaOportunidades } from "@/components/bi/sections/AcoesMapaOportunidades";
import { HorizontalBarChart, VerticalBarChart, LineChart, PieChartWithLabels, type BarChartData } from "@/components/bi/charts";
import { CHART_COLORS } from "@/lib/chartTheme";
import { faixaToDiasRange } from "@/lib/bi/acoesGestaoUtils";
import { toISODate, getPreviousPeriod, formatMonthYear } from "@/lib/dateUtils";
import type { AcoesFunil, AcoesFunilMeta, RpcAcoesBI } from "@/types/biRpc";

const EMPTY: RpcAcoesBI = {
  kpis: {
    totalAcoes: 0, cidades: 0, consultores: 0, visitas: 0, clientes: 0, tiposAcaoDistintos: 0,
    valorAberto: 0, negociosAberto: 0, valorGanho: 0, negociosGanho: 0, valorPerdido: 0, negociosPerdido: 0,
    negociosTocados: 0, valorTocado: 0, negociosOutrosStatus: 0, tempoMedioContato: 0,
  },
  porVendedor: [], porCidade: [], porMes: [], porDiaSemana: [],
  porTipoAcao: [], porTipoContato: [], listaAnos: [], porVendedorCidade: [],
  clientesMaisAtendidos: [],
};

/**
 * Baselines da RPC de gestao. As razoes nascem `null`, NAO `0`: enquanto o
 * dado nao chegou (ou nao ha denominador) a tela mostra "—". Um `0` ali seria
 * um numero afirmado que ninguem mediu.
 */
const EMPTY_FUNIL: AcoesFunil = {
  visitas: 0, oportunidades: 0, ganhos: 0,
  visitasPorOportunidade: null, oportPorFechamento: null,
};

const EMPTY_META: AcoesFunilMeta = {
  acoesSemConsultor: 0, ganhosSemAtribuicao: 0, somaGanhosRanking: 0,
};

interface Props {
  active: boolean;
  dateRange?: DateRange;
}

export default function AcoesSection({ active, dateRange }: Props) {
  const { vendedor, cidade, tipoAcao, statusNegocio } = useNegociosFilter();

  const from = useMemo(() => toISODate(dateRange?.from), [dateRange?.from]);
  const to = useMemo(() => toISODate(dateRange?.to ?? dateRange?.from), [dateRange?.to, dateRange?.from]);

  const { data, isLoading, error } = useAcoesBIRpc({
    from,
    to,
    vendedor: vendedor || undefined,
    tipoAcao: tipoAcao || undefined,
    cidade: cidade || undefined,
    enabled: active,
  });

  // Tabela de detalhe em RPC separada: rpc_acoes_bi roda 4x no app (2x aqui,
  // 2x em usePainelKPIsRpc que le so os kpis) — a tabela pesada fica fora dele.
  const { data: detalhe, isLoading: detalheLoading, error: detalheError } = useAcoesDetalheRpc({
    from,
    to,
    vendedor: vendedor || undefined,
    tipoAcao: tipoAcao || undefined,
    cidade: cidade || undefined,
    statusNegocio: statusNegocio || undefined,
    enabled: active,
  });

  // Clientes em risco — distribuicao por faixa de dias sem acao
  const { data: riscoData, isLoading: riscoLoading } = useClientesRiscoRpc({
    vendedor: vendedor || undefined,
    cidade: cidade || undefined,
    enabled: active,
  });

  // Agregados de gestao comercial (funil + ranking + dias parados).
  // RPC separada de proposito: rpc_acoes_bi ja viaja 4x no app.
  const { data: gestao, isLoading: gestaoLoading, error: gestaoError } = useAcoesFunilRpc({
    from,
    to,
    vendedor: vendedor || undefined,
    cidade: cidade || undefined,
    enabled: active,
  });

  // Drill-down: clicar uma faixa do chart "Clientes em Risco" abre a aba
  // "Sem contato" ja recortada por p_dias_min/p_dias_max.
  const [drill, setDrill] = useState<CarteiraDrill | null>(null);
  const handleFaixaClick = useCallback((datum: BarChartData) => {
    const faixa = String(datum.name);
    const range = faixaToDiasRange(faixa);
    // Rotulo desconhecido: nao inventar faixa — melhor nao filtrar do que
    // mostrar uma lista que nao corresponde a barra clicada.
    if (!range) return;
    setDrill({ faixa, ...range });
  }, []);

  // Periodo anterior (mesmo intervalo, 1 ano atras) para analise comparativa
  const prevRange = useMemo(() => getPreviousPeriod(dateRange), [dateRange]);
  const fromPrev = useMemo(() => toISODate(prevRange?.from), [prevRange?.from]);
  const toPrev = useMemo(() => toISODate(prevRange?.to ?? prevRange?.from), [prevRange?.to, prevRange?.from]);
  const { data: dataPrev } = useAcoesBIRpc({
    from: fromPrev,
    to: toPrev,
    vendedor: vendedor || undefined,
    tipoAcao: tipoAcao || undefined,
    cidade: cidade || undefined,
    enabled: active && !!fromPrev,
  });

  const { kpis, porVendedor, porCidade, porMes, porDiaSemana, porTipoAcao, porTipoContato, porVendedorCidade, clientesMaisAtendidos } = data ?? EMPTY;
  const kpisPrev = (dataPrev ?? EMPTY).kpis;

  return (
    <div className="space-y-6 pt-2">

      <AcoesKpiGrid
        kpis={kpis}
        kpisPrev={kpisPrev}
        loading={isLoading}
        funil={gestao?.funil}
        diasParados={gestao?.diasParados}
        gestaoLoading={gestaoLoading}
      />

      {/* Gestao comercial — funil + ranking de consultores */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AcoesFunilConversao funil={gestao?.funil ?? EMPTY_FUNIL} loading={gestaoLoading} error={gestaoError} />
        <AcoesEsforcoRetorno
          ranking={gestao?.rankingConsultores ?? []}
          loading={gestaoLoading}
          error={gestaoError}
          from={from}
          to={to}
          vendedor={vendedor || undefined}
          cidade={cidade || undefined}
          active={active}
        />
      </div>

      <AcoesRankingConsultores
        rows={gestao?.rankingConsultores ?? []}
        meta={gestao?.meta ?? EMPTY_META}
        ganhosFunil={gestao?.funil.ganhos ?? 0}
        loading={gestaoLoading}
        error={gestaoError}
      />

      {/* Ranking table */}
      <AcoesRankingTable data={porVendedorCidade} loading={isLoading} error={error} />

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Acoes por Consultor" description="Top 15 por volume" dataSource="mirror.crm_acoes · aco_vendedor, COUNT(*)" loading={isLoading}>
          <HorizontalBarChart
            data={porVendedor.map((d) => ({ name: d.name, acoes: d.acoes }))}
            keys={["acoes"]}
            seriesLabels={{ acoes: "Ações" }}
            title=""
            colors={[CHART_COLORS[0]]}
          />
        </ChartCard>

        <ChartCard title="Evolucao Mensal de Acoes" description="Quantidade por mes" dataSource="mirror.crm_acoes · aco_dthconclusao→YYYY-MM, COUNT(*)" loading={isLoading}>
          <LineChart
            data={porMes.map((d) => ({ x: formatMonthYear(d.name), y: d.acoes }))}
            seriesName="Ações"
            color={CHART_COLORS[0]}
          />
        </ChartCard>

        <ChartCard title="Acoes por Cidade" description="Top 15 cidades" dataSource="mirror.crm_acoes · cli_cidade (cidade do CLIENTE), COUNT(*)" loading={isLoading}>
          <HorizontalBarChart
            data={porCidade.map((d) => ({ name: d.name, acoes: d.acoes }))}
            keys={["acoes"]}
            seriesLabels={{ acoes: "Ações" }}
            title=""
            colors={[CHART_COLORS[2]]}
          />
        </ChartCard>

        <ChartCard
          title="Distribuicao por Tipo de Acao"
          description="Todos os tipos"
          dataSource="mirror.crm_acoes · aco_tipoacao, COUNT(*)"
          loading={isLoading}
        >
          <PieChartWithLabels data={porTipoAcao} title="" />
        </ChartCard>

        <ChartCard title="Acoes por Dia da Semana" description="Concentracao semanal" dataSource="mirror.crm_acoes · DOW(aco_dthconclusao), COUNT(*)" loading={isLoading}>
          <VerticalBarChart
            data={porDiaSemana.map((d) => ({ name: d.name, acoes: d.acoes }))}
            keys={["acoes"]}
            seriesLabels={{ acoes: "Ações" }}
            title=""
            colors={[CHART_COLORS[4]]}
          />
        </ChartCard>

        <ChartCard title="Tipo de Contato" description="Distribuicao dos canais" dataSource="mirror.crm_acoes · aco_tipocontato, COUNT(*)" loading={isLoading}>
          <PieChartWithLabels data={porTipoContato} title="" />
        </ChartCard>
      </div>

      {/* Tabelas */}
      <AcoesClientesTable data={clientesMaisAtendidos} loading={isLoading} error={error} />

      {/* Clientes em Risco — distribuicao por faixa de dias sem acao */}
      <ChartCard
        title="Clientes em Risco"
        description="Dias sem acao comercial (toda a carteira)"
        dataSource="rpc_acoes_clientes_risco · faixas de dias sem contato"
        loading={riscoLoading}
        footer={
          <p className="text-[11px] text-[var(--voux-text-muted)]">
            Clique numa faixa para abrir a lista de clientes dela em “Gestao da Carteira”.
          </p>
        }
      >
        <VerticalBarChart
          data={(riscoData?.faixas ?? []).map((f) => ({ name: f.faixa, clientes: f.clientes }))}
          keys={["clientes"]}
          seriesLabels={{ clientes: "Clientes" }}
          title=""
          colors={[CHART_COLORS[4]]}
          onBarClick={handleFaixaClick}
        />
      </ChartCard>

      {/* Gestao da carteira em abas — recebe o drill-down do chart acima */}
      <AcoesGestaoCarteira
        from={from}
        to={to}
        vendedor={vendedor || undefined}
        cidade={cidade || undefined}
        active={active}
        drill={drill}
        onClearDrill={() => setDrill(null)}
      />

      {/* Mapa de oportunidades abertas — colapsado, monta o Leaflet so ao abrir */}
      <AcoesMapaOportunidades
        vendedor={vendedor || undefined}
        cidade={cidade || undefined}
        active={active}
      />

      {/* Artefato principal — tabela com filtro de status */}
      <AcoesDetailWithFilter
        rows={detalhe?.rows ?? []}
        total={detalhe?.total ?? 0}
        loading={detalheLoading}
        error={detalheError}
      />
    </div>
  );
}
