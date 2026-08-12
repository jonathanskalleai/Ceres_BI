import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type DateRange } from "react-day-picker";
import { useAcoesBIRpc } from "@/hooks/bi/useAcoesBIRpc";
import { useAcoesEvolucaoMensalAnoCorrenteRpc } from "@/hooks/bi/useAcoesEvolucaoMensalAnoCorrenteRpc";
import { useAcoesDetalheRpc, ACOES_PAGE_SIZE } from "@/hooks/bi/useAcoesDetalheRpc";
import { useClientesRiscoRpc } from "@/hooks/bi/useClientesRiscoRpc";
import { useAcoesFunilPeriodoRpc } from "@/hooks/bi/useAcoesFunilPeriodoRpc";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { ChartCard } from "@/components/bi/ChartCard";
import { AcoesRankingTable } from "@/components/bi/AcoesRankingTable";
import { AcoesClientesTable } from "@/components/bi/AcoesClientesTable";
import { AcoesDetailWithFilter } from "@/components/bi/sections/AcoesDetailWithFilter";
import { AcoesKpiGrid } from "@/components/bi/sections/AcoesKpiGrid";
import { AcoesFunilConversao } from "@/components/bi/sections/AcoesFunilConversao";
import { AcoesRankingConsultores } from "@/components/bi/sections/AcoesRankingConsultores";
import { AcoesEsforcoRetorno } from "@/components/bi/sections/AcoesEsforcoRetorno";
import { AcoesTermometroFechamento } from "@/components/bi/sections/AcoesTermometroFechamento";
import { AcoesDiasSemAcaoModal } from "@/components/bi/sections/AcoesDiasSemAcaoModal";
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
    valorGanho: 0, negociosGanho: 0, valorPerdido: 0, negociosPerdido: 0,
    negociosOutrosStatus: 0, tempoMedioContato: 0,
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
  visitas: 0, oportunidades: 0, valorOportunidades: 0,
  oportunidadesAbertas: 0, valorOportunidadesAbertas: 0,
  entradasEtapaOportunidade: 0, emEtapaOportunidade: 0,
  ganhos: 0, perdidos: 0, valorPerdido: 0,
  visitasPorOportunidade: null, oportPorFechamento: null,
};

const EMPTY_META: AcoesFunilMeta = {
  acoesSemConsultor: 0, ganhosSemAtribuicao: 0, perdidosSemAtribuicao: 0, somaGanhosRanking: 0,
};

interface Props {
  active: boolean;
  dateRange?: DateRange;
}

/**
 * No desktop o termômetro é uma lista rolável ao lado de dois cards com altura
 * variável. CSS não consegue atrelar a altura máxima de um irmão à altura real
 * do outro sem deixar o conteúdo da direita definir a linha do grid. A medição
 * mantém o fim dos dois lados alinhado mesmo quando textos ou dados mudam.
 */
function useAlturaColunaEsquerda() {
  const ref = useRef<HTMLDivElement>(null);
  const [altura, setAltura] = useState<number>();

  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;

    const desktop = window.matchMedia("(min-width: 1024px)");
    const medir = () => {
      if (!desktop.matches) {
        setAltura(undefined);
        return;
      }

      const proximaAltura = Math.ceil(elemento.getBoundingClientRect().height);
      setAltura((atual) => atual === proximaAltura ? atual : proximaAltura);
    };

    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    desktop.addEventListener("change", medir);
    medir();

    return () => {
      observador.disconnect();
      desktop.removeEventListener("change", medir);
    };
  }, []);

  return { ref, altura };
}

export default function AcoesSection({ active, dateRange }: Props) {
  const { vendedor, cidade, tipoAcao, statusNegocio } = useNegociosFilter();
  const { ref: colunaEsquerdaRef, altura: alturaColunaEsquerda } = useAlturaColunaEsquerda();
  const [diasSemAcaoAberto, setDiasSemAcaoAberto] = useState(false);

  const from = useMemo(() => toISODate(dateRange?.from), [dateRange?.from]);
  const to = useMemo(() => toISODate(dateRange?.to ?? dateRange?.from), [dateRange?.to, dateRange?.from]);

  // Paginacao server-side da tabela de detalhe
  const [detalhePage, setDetalhePage] = useState(1);

  // Reset para pagina 1 quando qualquer filtro muda
  useEffect(() => {
    setDetalhePage(1);
  }, [from, to, vendedor, cidade, tipoAcao, statusNegocio]);

  const { data, isLoading, error } = useAcoesBIRpc({
    from,
    to,
    vendedor: vendedor || undefined,
    tipoAcao: tipoAcao || undefined,
    cidade: cidade || undefined,
    enabled: active,
  });

  // Os dois graficos de evolucao mantem a leitura anual, de janeiro ate o
  // mes atual. O calendario continua valendo para todos os demais visuais.
  const { data: evolucaoMensal = [], isLoading: evolucaoMensalLoading } = useAcoesEvolucaoMensalAnoCorrenteRpc({
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
    page: detalhePage,
    enabled: active,
  });

  const detalheTotal = detalhe?.total ?? 0;
  const detalheTotalPages = Math.max(1, Math.ceil(detalheTotal / ACOES_PAGE_SIZE));

  // Clientes em risco — distribuicao por faixa de dias sem acao
  const { data: riscoData, isLoading: riscoLoading } = useClientesRiscoRpc({
    vendedor: vendedor || undefined,
    cidade: cidade || undefined,
    enabled: active,
  });

  // Oportunidades pela primeira entrada no funil VENDAS da janela, nao por
  // cadastro e nem por negocios antigos apenas tocados por uma acao. Ranking e
  // dias parados permanecem os mesmos agregados da RPC-base.
  const { data: gestao, isLoading: gestaoLoading, error: gestaoError } = useAcoesFunilPeriodoRpc({
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

  // A taxa de ganho usa o MESMO agregado de entradas no funil VENDAS exibido no
  // card de gestao. Assim, o denominador nunca traz oportunidades de outro periodo.
  const { data: gestaoPrev } = useAcoesFunilPeriodoRpc({
    from: fromPrev,
    to: toPrev,
    vendedor: vendedor || undefined,
    cidade: cidade || undefined,
    enabled: active && !!fromPrev && !!toPrev,
  });

  const { kpis, porVendedor, porCidade, porTipoAcao, porTipoContato, porVendedorCidade, clientesMaisAtendidos } = data ?? EMPTY;
  const kpisPrev = (dataPrev ?? EMPTY).kpis;

  return (
    <div className="space-y-6 pt-2">

      <AcoesKpiGrid
        kpis={kpis}
        kpisPrev={kpisPrev}
        loading={isLoading}
        funil={gestao?.funil}
        funilPrev={gestaoPrev?.funil}
        diasParados={gestao?.diasParados}
        gestaoLoading={gestaoLoading}
        onOpenDiasSemAcao={() => setDiasSemAcaoAberto(true)}
      />

      <AcoesDiasSemAcaoModal
        open={diasSemAcaoAberto}
        onOpenChange={setDiasSemAcaoAberto}
        from={from}
        to={to}
        vendedor={vendedor || undefined}
        cidade={cidade || undefined}
        diasMin={gestao?.diasParados.mediana}
        active={active}
      />

      {/* Ao lado do termômetro, atividade e canais ocupam a mesma coluna. */}
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <div ref={colunaEsquerdaRef} className="self-start space-y-4">
          <AcoesFunilConversao funil={gestao?.funil ?? EMPTY_FUNIL} meta={gestao?.meta ?? EMPTY_META}
            loading={gestaoLoading} error={gestaoError} />
          <ChartCard
            title="Tipo de Contato"
            description="Distribuição dos canais"
            dataSource="mirror.crm_acoes · aco_tipocontato, COUNT(*)"
            loading={isLoading}
            height={250}
          >
            <PieChartWithLabels
              data={[...porTipoContato]
                .sort((a, b) => b.value - a.value)
                .map((d) => ({ id: d.id, name: d.name, value: d.value }))}
              title=""
              colors={CHART_COLORS}
            />
          </ChartCard>
        </div>
        <div className="min-h-0" style={alturaColunaEsquerda ? { height: alturaColunaEsquerda } : undefined}>
          <AcoesTermometroFechamento
            from={from}
            to={to}
            vendedor={vendedor || undefined}
            cidade={cidade || undefined}
            active={active}
          />
        </div>
      </div>

      {/* Comparação de desempenho: ranking à esquerda e esforço × retorno à direita. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AcoesRankingConsultores
          rows={gestao?.rankingConsultores ?? []}
          meta={gestao?.meta ?? EMPTY_META}
          ganhosFunil={gestao?.funil.ganhos ?? 0}
          loading={gestaoLoading}
          error={gestaoError}
        />
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

      {/* Ranking table */}
      <AcoesRankingTable data={porVendedorCidade} loading={isLoading} error={error} />

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartCard title="Acoes por Consultor" description="Top 15 por volume" dataSource="mirror.crm_acoes · aco_vendedor, COUNT(*)" loading={isLoading}>
          <HorizontalBarChart
            data={porVendedor.map((d) => ({ name: d.name, acoes: d.acoes }))}
            keys={["acoes"]}
            seriesLabels={{ acoes: "Ações" }}
            title=""
            colors={[CHART_COLORS[0]]}
          />
        </ChartCard>

        <ChartCard
          title="Evolucao Mensal de Acoes"
          description="Janeiro ate o mes atual (ano corrente)"
          dataSource="mirror.crm_acoes · aco_dthconclusao→YYYY-MM, COUNT(*) · independente do calendario"
          loading={evolucaoMensalLoading}
        >
          <LineChart
            data={evolucaoMensal.map((d) => ({ x: formatMonthYear(d.name), y: d.acoes }))}
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
          <HorizontalBarChart
            data={[...porTipoAcao].sort((a, b) => b.value - a.value).map((d) => ({ name: d.name, acoes: d.value }))}
            keys={["acoes"]}
            seriesLabels={{ acoes: "Ações" }}
            title=""
            colors={[CHART_COLORS[0]]}
          />
        </ChartCard>

        <ChartCard
          title="Evolucao Mensal de Visitas"
          description="Janeiro ate o mes atual (ano corrente)"
          dataSource="mirror.crm_acoes · aco_tipocontato LIKE '%visita%' por aco_dthconclusao→YYYY-MM · independente do calendario"
          loading={evolucaoMensalLoading}
        >
          <LineChart
            data={evolucaoMensal.map((d) => ({ x: formatMonthYear(d.name), y: d.visitas }))}
            seriesName="Visitas"
            color={CHART_COLORS[4]}
            tooltipFormatter={(value) => value.toLocaleString("pt-BR")}
          />
        </ChartCard>

        <ChartCard
          title="Clientes em Risco — Dias sem Acao Comercial"
          description="Dias sem acao comercial (toda a carteira)"
          dataSource="rpc_acoes_clientes_risco · faixas de dias sem contato"
          loading={riscoLoading}
          footer={
            <p className="text-[11px] text-[var(--voux-text-muted)]">
              Clique numa faixa para abrir a lista de clientes dela em "Gestao da Carteira".
            </p>
          }
        >
          <VerticalBarChart
            data={(riscoData?.faixas ?? []).map((f) => ({ name: f.faixa, clientes: f.clientes }))}
            keys={["clientes"]}
            seriesLabels={{ clientes: "Clientes" }}
            title=""
            itemColors={["#C9A96E80", "#C9A96E", "#D4956A", "#B8603A", "#8B3A22"]}
            onBarClick={handleFaixaClick}
          />
        </ChartCard>
      </div>

      {/* Tabelas */}
      <AcoesClientesTable data={clientesMaisAtendidos} loading={isLoading} error={error} />

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

      {/* Mapa de negocios abertos — inicia aberto e carrega junto da tela */}
      <AcoesMapaOportunidades
        vendedor={vendedor || undefined}
        cidade={cidade || undefined}
        from={from}
        to={to}
        active={active}
      />

      {/* Artefato principal — tabela com filtro de status */}
      <AcoesDetailWithFilter
        rows={detalhe?.rows ?? []}
        total={detalheTotal}
        page={detalhePage}
        pageSize={ACOES_PAGE_SIZE}
        totalPages={detalheTotalPages}
        onPageChange={setDetalhePage}
        loading={detalheLoading}
        error={detalheError}
      />
    </div>
  );
}
