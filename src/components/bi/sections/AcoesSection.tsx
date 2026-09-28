import { useCallback, useEffect, useMemo, useState } from "react";
import { type DateRange } from "react-day-picker";
import { useAcoesBIRpc } from "@/hooks/bi/useAcoesBIRpc";
import { useAcoesEvolucaoMensalAnoCorrenteRpc } from "@/hooks/bi/useAcoesEvolucaoMensalAnoCorrenteRpc";
import { useAcoesDetalheRpc, ACOES_PAGE_SIZE } from "@/hooks/bi/useAcoesDetalheRpc";
import { useClientesRiscoRpc } from "@/hooks/bi/useClientesRiscoRpc";
import { useClientesCriticosRpc } from "@/hooks/bi/useClientesCriticosRpc";
import { useAcoesSinaisSemanaIA } from "@/hooks/bi/useAcoesSinaisSemanaIA";
import { useAcoesFunilPeriodoRpc } from "@/hooks/bi/useAcoesFunilPeriodoRpc";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { AcoesRankingTable } from "@/components/bi/AcoesRankingTable";
import { AcoesClientesTable } from "@/components/bi/AcoesClientesTable";
import { AcoesDetailWithFilter } from "@/components/bi/sections/AcoesDetailWithFilter";
import { AcoesKpiGrid } from "@/components/bi/sections/AcoesKpiGrid";
import { usePedidosEsteira } from "@/hooks/bi/usePedidosEsteira";
import { PedidosEsteiraCard } from "@/components/bi/pedidos/PedidosEsteiraCard";
import { AcoesFunilConversao } from "@/components/bi/sections/AcoesFunilConversao";
import { AcoesRankingConsultores } from "@/components/bi/sections/AcoesRankingConsultores";
import { AcoesEsforcoRetorno } from "@/components/bi/sections/AcoesEsforcoRetorno";
import { AcoesTermometroFechamento } from "@/components/bi/sections/AcoesTermometroFechamento";
import { AcoesDiasSemAcaoModal } from "@/components/bi/sections/AcoesDiasSemAcaoModal";
import { AcoesGestaoCarteira, type CarteiraDrill } from "@/components/bi/sections/AcoesGestaoCarteira";
import { AcoesMapaOportunidades } from "@/components/bi/sections/AcoesMapaOportunidades";
import { AcoesClientesCriticos } from "@/components/bi/sections/AcoesClientesCriticos";
import { AcoesSinaisSemanaIA } from "@/components/bi/sections/AcoesSinaisSemanaIA";
import { AcoesChartsGrid } from "@/components/bi/sections/AcoesChartsGrid";
import { ChartCard } from "@/components/bi/ChartCard";
import { PieChartWithLabels } from "@/components/bi/charts";
import type { BarChartData } from "@/components/bi/charts/BarChart";
import { faixaToDiasRange } from "@/lib/bi/acoesGestaoUtils";
import { CHART_COLORS } from "@/lib/chartPalette";
import { toISODate, getPreviousPeriod, formatDateBR } from "@/lib/dateUtils";
import { useDelayedReady } from "@/hooks/useDelayedReady";
import { useAlturaColunaEsquerda } from "@/hooks/bi/useAlturaColunaEsquerda";
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
  negociosAbertosTocadosNoPeriodo: 0, valorPipelineAbertoTocadoNoPeriodo: 0,
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

export default function AcoesSection({ active, dateRange }: Props) {
  const { vendedor, cidade, tipoAcao, statusNegocio } = useNegociosFilter();
  const { medidoRef: colunaEsquerdaRef, alvoRef: colunaTermometroRef } = useAlturaColunaEsquerda();
  const [diasSemAcaoAberto, setDiasSemAcaoAberto] = useState(false);

  const from = useMemo(() => toISODate(dateRange?.from), [dateRange?.from]);
  const to = useMemo(() => toISODate(dateRange?.to ?? dateRange?.from), [dateRange?.to, dateRange?.from]);

  // A abertura da tela disparava mapa, tabelas e análises abaixo da dobra ao
  // mesmo tempo que os cards principais. Mantemos todos os blocos, mas
  // liberamos as consultas em duas ondas: apoio visível após o primeiro paint
  // e consultas pesadas (mapa, detalhe, IA e período anterior) depois que a
  // interface já está utilizável. Filtros reiniciam as duas ondas.
  const carregarApoio = useDelayedReady(
    active,
    250,
    `${from}|${to}|${vendedor}|${cidade}|${tipoAcao}|${statusNegocio}`,
  );
  const carregarPesados = useDelayedReady(
    active,
    900,
    `${from}|${to}|${vendedor}|${cidade}|${tipoAcao}|${statusNegocio}`,
  );

  // Paginacao server-side da tabela de detalhe
  const [detalhePage, setDetalhePage] = useState(1);

  // Reset para pagina 1 quando qualquer filtro muda
  useEffect(() => {
    setDetalhePage(1);
  }, [from, to, vendedor, cidade, tipoAcao, statusNegocio]);

  const { data, isLoading, isError, error } = useAcoesBIRpc({
    from,
    to,
    vendedor: vendedor || undefined,
    tipoAcao: tipoAcao || undefined,
    cidade: cidade || undefined,
    enabled: active,
  });
  const coreError = isError && !data ? error : null;

  // Os dois graficos de evolucao mantem a leitura anual, de janeiro ate o
  // mes atual. O calendario continua valendo para todos os demais visuais.
  const { data: evolucaoMensal = [], isLoading: evolucaoMensalLoading } = useAcoesEvolucaoMensalAnoCorrenteRpc({
    vendedor: vendedor || undefined,
    tipoAcao: tipoAcao || undefined,
    cidade: cidade || undefined,
    enabled: active && carregarApoio,
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
    enabled: active && carregarPesados,
  });

  const detalheTotal = detalhe?.total ?? 0;
  const detalheTotalPages = Math.max(1, Math.ceil(detalheTotal / ACOES_PAGE_SIZE));

  // Clientes em risco — distribuicao por faixa de dias sem acao
  const { data: riscoData, isLoading: riscoLoading, error: riscoError } = useClientesRiscoRpc({
    vendedor: vendedor || undefined,
    cidade: cidade || undefined,
    enabled: active && carregarPesados,
  });

  const { data: clientesCriticos, isLoading: clientesCriticosLoading, error: clientesCriticosError } = useClientesCriticosRpc({
    vendedor: vendedor || undefined,
    cidade: cidade || undefined,
    enabled: active && carregarApoio,
  });

  const { data: sinaisSemanaIA, isLoading: sinaisSemanaIALoading, error: sinaisSemanaIAError } = useAcoesSinaisSemanaIA(
    active && carregarPesados,
  );

  // Oportunidades pela primeira entrada no funil VENDAS da janela, nao por
  // cadastro e nem por negocios antigos apenas tocados por uma acao. Ranking e
  // dias parados permanecem os mesmos agregados da RPC-base.
  const { data: gestao, isLoading: gestaoLoading, error: gestaoError } = useAcoesFunilPeriodoRpc({
    from,
    to,
    vendedor: vendedor || undefined,
    cidade: cidade || undefined,
    enabled: active && carregarApoio,
  });

  const { data: esteiraData, isLoading: esteiraLoading } = usePedidosEsteira({
    from,
    to,
    vendedor: vendedor || undefined,
    cidade: cidade || undefined,
    enabled: active && carregarApoio,
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
    enabled: active && carregarPesados && !!fromPrev,
  });

  // A taxa de ganho usa o MESMO agregado de entradas no funil VENDAS exibido no
  // card de gestao. Assim, o denominador nunca traz oportunidades de outro periodo.
  const { data: gestaoPrev } = useAcoesFunilPeriodoRpc({
    from: fromPrev,
    to: toPrev,
    vendedor: vendedor || undefined,
    cidade: cidade || undefined,
    enabled: active && carregarPesados && !!fromPrev && !!toPrev,
  });

  const { kpis, porVendedor, porCidade, porTipoAcao, porTipoContato, porVendedorCidade, clientesMaisAtendidos } = data ?? EMPTY;
  const kpisPrev = dataPrev?.kpis;

  return (
    <div className="space-y-6 pt-2">
      {tipoAcao && (
        <p role="note" className="rounded-md border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-xs text-muted-foreground">
          <strong className="text-foreground">Filtro de tipo de ação ativo:</strong> aplicado aos blocos cujo fato é uma ação (`crm_acoes`) e à tabela de ações. Ganhos, perdas, termômetro, risco, mapa e esteira são fatos de negócio/pedido/carteira e não recebem esse atributo; eles permanecem com a regra de origem para não afirmar uma relação inexistente.
        </p>
      )}

      <AcoesKpiGrid
        kpis={kpis}
        kpisPrev={kpisPrev}
        loading={isLoading}
        funil={gestao?.funil}
        funilPrev={gestaoPrev?.funil}
        diasParados={gestao?.diasParados}
        gestaoLoading={gestaoLoading}
        error={coreError}
        onOpenDiasSemAcao={() => setDiasSemAcaoAberto(true)}
      />

      {/* ESTEIRA DE PEDIDOS EM FECHAMENTO (Aguardando Aprovação e Aguardando Assinatura) */}
      <PedidosEsteiraCard
        variant="strip"
        data={esteiraData}
        isLoading={esteiraLoading}
        periodoLabel={from && to ? `${formatDateBR(from)} a ${formatDateBR(to)}` : undefined}
      />

      <AcoesClientesCriticos
        data={clientesCriticos}
        loading={!carregarApoio || clientesCriticosLoading}
        error={clientesCriticosError}
      />

      <AcoesSinaisSemanaIA
        data={sinaisSemanaIA}
        loading={!carregarPesados || sinaisSemanaIALoading}
        error={sinaisSemanaIAError}
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
            error={coreError}
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
        <div ref={colunaTermometroRef} className="min-h-0">
          <AcoesTermometroFechamento
            from={from}
            to={to}
            vendedor={vendedor || undefined}
            cidade={cidade || undefined}
            active={active && carregarApoio}
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
          loading={!carregarApoio || gestaoLoading}
          error={gestaoError}
          from={from}
          to={to}
          vendedor={vendedor || undefined}
          cidade={cidade || undefined}
          active={active && carregarApoio}
        />
      </div>

      {/* Ranking table */}
      <AcoesRankingTable data={porVendedorCidade} loading={isLoading} error={error} />

      <AcoesChartsGrid
        porVendedor={porVendedor}
        porCidade={porCidade}
        porTipoAcao={porTipoAcao}
        evolucaoMensal={evolucaoMensal}
        riscoData={riscoData}
        isLoading={isLoading}
        evolucaoMensalLoading={evolucaoMensalLoading}
        riscoLoading={riscoLoading}
        coreError={coreError}
        riscoError={riscoError}
        onFaixaClick={handleFaixaClick}
      />

      {/* Tabelas */}
      <AcoesClientesTable data={clientesMaisAtendidos} loading={isLoading} error={error} />

      {/* Gestao da carteira em abas — recebe o drill-down do chart acima */}
      <AcoesGestaoCarteira
        from={from}
        to={to}
        vendedor={vendedor || undefined}
        cidade={cidade || undefined}
        active={active && carregarPesados}
        drill={drill}
        onClearDrill={() => setDrill(null)}
      />

      {/* Mapa de negocios abertos — começa recolhido; a consulta entra na
          segunda onda e só é executada quando o usuário abre o bloco. */}
      <AcoesMapaOportunidades
        vendedor={vendedor || undefined}
        cidade={cidade || undefined}
        from={from}
        to={to}
        active={active && carregarPesados}
      />

      {/* Artefato principal — tabela com filtro de status */}
      <AcoesDetailWithFilter
        rows={detalhe?.rows ?? []}
        total={detalheTotal}
        page={detalhePage}
        pageSize={ACOES_PAGE_SIZE}
        totalPages={detalheTotalPages}
        onPageChange={setDetalhePage}
        loading={!carregarPesados || detalheLoading}
        error={detalheError}
      />
    </div>
  );
}
