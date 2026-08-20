import { lazy, Suspense } from "react";
import { type DateRange } from "react-day-picker";
import { BarChart2 } from "lucide-react";
import { useNegociosExpandidoRpc } from "@/hooks/bi/useNegociosExpandidoRpc";
import { toISODate } from "@/lib/dateUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { BiErrorState } from "@/components/bi/BiErrorState";

// Lazy sub-components
const FaturamentoPorMarca = lazy(() =>
  import("./negocios-expandido/FaturamentoPorMarca").then((m) => ({ default: m.FaturamentoPorMarca })),
);
const ValorPorCondicaoPagamento = lazy(() =>
  import("./negocios-expandido/ValorPorCondicaoPagamento").then((m) => ({ default: m.ValorPorCondicaoPagamento })),
);
const HeatmapEtapaIdade = lazy(() =>
  import("./negocios-expandido/HeatmapEtapaIdade").then((m) => ({ default: m.HeatmapEtapaIdade })),
);
const TaxaFechamentoPorMotivoGanho = lazy(() =>
  import("./negocios-expandido/TaxaFechamentoPorMotivoGanho").then((m) => ({ default: m.TaxaFechamentoPorMotivoGanho })),
);
const RankingProdutosReceitaGanha = lazy(() =>
  import("./negocios-expandido/RankingProdutosReceitaGanha").then((m) => ({ default: m.RankingProdutosReceitaGanha })),
);
const DistribuicaoPorGrupoProduto = lazy(() =>
  import("./negocios-expandido/DistribuicaoPorGrupoProduto").then((m) => ({ default: m.DistribuicaoPorGrupoProduto })),
);
const WaterfallMensalGanhoPerdido = lazy(() =>
  import("./negocios-expandido/WaterfallMensalGanhoPerdido").then((m) => ({ default: m.WaterfallMensalGanhoPerdido })),
);
const ValorPorCidade = lazy(() =>
  import("./negocios-expandido/ValorPorCidade").then((m) => ({ default: m.ValorPorCidade })),
);
const TaxaPerdaPorBanco = lazy(() =>
  import("./negocios-expandido/TaxaPerdaPorBanco").then((m) => ({ default: m.TaxaPerdaPorBanco })),
);
const PalavrasChaveObservacao = lazy(() =>
  import("./negocios-expandido/PalavrasChaveObservacao").then((m) => ({ default: m.PalavrasChaveObservacao })),
);
const TicketMedioPorFormaEntrada = lazy(() =>
  import("./negocios-expandido/TicketMedioPorFormaEntrada").then((m) => ({ default: m.TicketMedioPorFormaEntrada })),
);
const CicloVendasPorEtapa = lazy(() =>
  import("./negocios-expandido/CicloVendasPorEtapa").then((m) => ({ default: m.CicloVendasPorEtapa })),
);
const UsadoRecebidoPorMes = lazy(() =>
  import("./negocios-expandido/UsadoRecebidoPorMes").then((m) => ({ default: m.UsadoRecebidoPorMes })),
);
const VolumePorTipoCliente = lazy(() =>
  import("./negocios-expandido/VolumePorTipoCliente").then((m) => ({ default: m.VolumePorTipoCliente })),
);
const ProbabilidadeVsResultado = lazy(() =>
  import("./negocios-expandido/ProbabilidadeVsResultado").then((m) => ({ default: m.ProbabilidadeVsResultado })),
);

interface Props {
  active: boolean;
  dateRange?: DateRange;
  vendedor?: string;
  cidade?: string;
}

function ChartSkeleton() {
  return <Skeleton className="h-64 w-full rounded-2xl" />;
}

export default function NegociosExpandidoSection({ active, dateRange, vendedor, cidade }: Props) {
  const from = toISODate(dateRange?.from) ?? "2000-01-01";
  const to = toISODate(dateRange?.to ?? dateRange?.from) ?? toISODate(new Date())!;

  const { data, isLoading, error, refetch } = useNegociosExpandidoRpc({
    pFrom: from,
    pTo: to,
    pVendedor: vendedor,
    pCidade: cidade,
    active,
  });

  if (error) {
    return (
      <BiErrorState
        message="Não foi possível carregar as análises expandidas. Tente novamente."
        onRetry={() => void refetch()}
      />
    );
  }

  if (isLoading) {
    return (
      <section className="space-y-4 pt-6" aria-label="Análises expandidas de Negócios">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => <ChartSkeleton key={i} />)}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6 pt-6" aria-label="Análises expandidas de Negócios">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <BarChart2 className="h-4 w-4 text-[var(--voux-accent)]" />
        <h2 className="text-[15px] font-medium text-[var(--voux-text-heading)]">
          Análises Detalhadas
        </h2>
      </div>

      {/* ─── Receita & Produto ─── */}
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--voux-text-muted)]">Receita &amp; Produto</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Suspense fallback={<ChartSkeleton />}>
          {data?.faturamentoPorMarca && data.faturamentoPorMarca.length > 0 && (
            <FaturamentoPorMarca data={data.faturamentoPorMarca} loading={isLoading} />
          )}
        </Suspense>
        <Suspense fallback={<ChartSkeleton />}>
          {data?.rankingProdutosReceitaGanha && data.rankingProdutosReceitaGanha.length > 0 && (
            <RankingProdutosReceitaGanha data={data.rankingProdutosReceitaGanha} loading={isLoading} />
          )}
        </Suspense>
        <Suspense fallback={<ChartSkeleton />}>
          {data?.distribuicaoPorGrupoProduto && data.distribuicaoPorGrupoProduto.length > 0 && (
            <DistribuicaoPorGrupoProduto data={data.distribuicaoPorGrupoProduto} loading={isLoading} />
          )}
        </Suspense>
        <Suspense fallback={<ChartSkeleton />}>
          {data?.volumePorTipoCliente && data.volumePorTipoCliente.length > 0 && (
            <VolumePorTipoCliente data={data.volumePorTipoCliente} loading={isLoading} />
          )}
        </Suspense>
      </div>

      {/* Waterfall — full width */}
      <Suspense fallback={<ChartSkeleton />}>
        {data?.waterfallMensalGanhoPerdido && data.waterfallMensalGanhoPerdido.length > 0 && (
          <WaterfallMensalGanhoPerdido data={data.waterfallMensalGanhoPerdido} loading={isLoading} />
        )}
      </Suspense>

      {/* ─── Geografia & Canais ─── */}
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--voux-text-muted)]">Geografia &amp; Canais</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Suspense fallback={<ChartSkeleton />}>
          {data?.valorPorCondicaoPagamento && data.valorPorCondicaoPagamento.length > 0 && (
            <ValorPorCondicaoPagamento data={data.valorPorCondicaoPagamento} loading={isLoading} />
          )}
        </Suspense>
        <Suspense fallback={<ChartSkeleton />}>
          {data?.valorPorCidade && data.valorPorCidade.length > 0 && (
            <ValorPorCidade data={data.valorPorCidade} loading={isLoading} />
          )}
        </Suspense>
        <Suspense fallback={<ChartSkeleton />}>
          {data?.ticketMedioPorFormaEntrada && data.ticketMedioPorFormaEntrada.length > 0 && (
            <TicketMedioPorFormaEntrada data={data.ticketMedioPorFormaEntrada} loading={isLoading} />
          )}
        </Suspense>
      </div>

      {/* ─── Conversão & Funil ─── */}
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--voux-text-muted)]">Conversão &amp; Funil</p>

      {/* Heatmap — full width */}
      <Suspense fallback={<ChartSkeleton />}>
        {data?.heatmapEtapaIdade && data.heatmapEtapaIdade.length > 0 && (
          <HeatmapEtapaIdade data={data.heatmapEtapaIdade} loading={isLoading} />
        )}
      </Suspense>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Suspense fallback={<ChartSkeleton />}>
          {data?.taxaFechamentoPorMotivoGanho && data.taxaFechamentoPorMotivoGanho.length > 0 && (
            <TaxaFechamentoPorMotivoGanho data={data.taxaFechamentoPorMotivoGanho} loading={isLoading} />
          )}
        </Suspense>
        <Suspense fallback={<ChartSkeleton />}>
          {data?.taxaPerdaPorBanco && data.taxaPerdaPorBanco.length > 0 && (
            <TaxaPerdaPorBanco data={data.taxaPerdaPorBanco} loading={isLoading} />
          )}
        </Suspense>
      </div>

      {/* Ciclo de Vendas — full width */}
      <Suspense fallback={<ChartSkeleton />}>
        {data?.cicloVendasPorEtapa && data.cicloVendasPorEtapa.length > 0 && (
          <CicloVendasPorEtapa data={data.cicloVendasPorEtapa} loading={isLoading} />
        )}
      </Suspense>

      {/* ─── Inteligência ─── */}
      <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[var(--voux-text-muted)]">Inteligência</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Suspense fallback={<ChartSkeleton />}>
          {data?.palavrasChaveObservacao && data.palavrasChaveObservacao.length > 0 && (
            <PalavrasChaveObservacao data={data.palavrasChaveObservacao} loading={isLoading} />
          )}
        </Suspense>
        <Suspense fallback={<ChartSkeleton />}>
          {data?.probabilidadeVsResultado && data.probabilidadeVsResultado.length > 0 && (
            <ProbabilidadeVsResultado data={data.probabilidadeVsResultado} loading={isLoading} />
          )}
        </Suspense>
      </div>

      {/* Usado Recebido — full width */}
      <Suspense fallback={<ChartSkeleton />}>
        {data?.usadoRecebidoPorMes && data.usadoRecebidoPorMes.length > 0 && (
          <UsadoRecebidoPorMes data={data.usadoRecebidoPorMes} loading={isLoading} />
        )}
      </Suspense>
    </section>
  );
}
