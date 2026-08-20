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
  return <Skeleton className="h-56 w-full rounded-2xl" />;
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
      <section className="space-y-4 pt-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <ChartSkeleton key={i} />)}
        </div>
      </section>
    );
  }

  // Helper: only render if has data
  const has = (arr: unknown[] | null | undefined) => arr && arr.length > 0;

  return (
    <section className="space-y-5 pt-6" aria-label="Análises expandidas de Negócios">
      <div className="flex items-center gap-2">
        <BarChart2 className="h-4 w-4 text-[var(--voux-accent)]" />
        <h2 className="text-base font-semibold" style={{ color: "var(--voux-text-primary)" }}>
          Análises Detalhadas
        </h2>
      </div>

      {/* Row 1: Evolução temporal (full width) — VouxLine */}
      {has(data?.usadoRecebidoPorMes) && (
        <Suspense fallback={<ChartSkeleton />}>
          <UsadoRecebidoPorMes data={data!.usadoRecebidoPorMes!} loading={isLoading} />
        </Suspense>
      )}

      {/* Row 2: Waterfall ganho/perda (full width) */}
      {has(data?.waterfallMensalGanhoPerdido) && (
        <Suspense fallback={<ChartSkeleton />}>
          <WaterfallMensalGanhoPerdido data={data!.waterfallMensalGanhoPerdido!} loading={isLoading} />
        </Suspense>
      )}

      {/* Row 3: Donut + Tipo Cliente — composição lado a lado */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {has(data?.distribuicaoPorGrupoProduto) && (
          <Suspense fallback={<ChartSkeleton />}>
            <DistribuicaoPorGrupoProduto data={data!.distribuicaoPorGrupoProduto!} loading={isLoading} />
          </Suspense>
        )}
        {has(data?.volumePorTipoCliente) && (
          <Suspense fallback={<ChartSkeleton />}>
            <VolumePorTipoCliente data={data!.volumePorTipoCliente!} loading={isLoading} />
          </Suspense>
        )}
      </div>

      {/* Row 4: Rankings de receita — tabela + barras */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {has(data?.faturamentoPorMarca) && (
          <Suspense fallback={<ChartSkeleton />}>
            <FaturamentoPorMarca data={data!.faturamentoPorMarca!} loading={isLoading} />
          </Suspense>
        )}
        {has(data?.rankingProdutosReceitaGanha) && (
          <div className="lg:col-span-2">
            <Suspense fallback={<ChartSkeleton />}>
              <RankingProdutosReceitaGanha data={data!.rankingProdutosReceitaGanha!} loading={isLoading} />
            </Suspense>
          </div>
        )}
      </div>

      {/* Row 5: Geografia — 2 col */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {has(data?.valorPorCidade) && (
          <Suspense fallback={<ChartSkeleton />}>
            <ValorPorCidade data={data!.valorPorCidade!} loading={isLoading} />
          </Suspense>
        )}
        {has(data?.valorPorCondicaoPagamento) && (
          <Suspense fallback={<ChartSkeleton />}>
            <ValorPorCondicaoPagamento data={data!.valorPorCondicaoPagamento!} loading={isLoading} />
          </Suspense>
        )}
      </div>

      {/* Row 6: Conversão — heatmap full width */}
      {has(data?.heatmapEtapaIdade) && (
        <Suspense fallback={<ChartSkeleton />}>
          <HeatmapEtapaIdade data={data!.heatmapEtapaIdade!} loading={isLoading} />
        </Suspense>
      )}

      {/* Row 7: Funil — 3 col (taxa ganho, ciclo, perda banco) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {has(data?.taxaFechamentoPorMotivoGanho) && (
          <Suspense fallback={<ChartSkeleton />}>
            <TaxaFechamentoPorMotivoGanho data={data!.taxaFechamentoPorMotivoGanho!} loading={isLoading} />
          </Suspense>
        )}
        {has(data?.cicloVendasPorEtapa) && (
          <Suspense fallback={<ChartSkeleton />}>
            <CicloVendasPorEtapa data={data!.cicloVendasPorEtapa!} loading={isLoading} />
          </Suspense>
        )}
        {has(data?.taxaPerdaPorBanco) && (
          <Suspense fallback={<ChartSkeleton />}>
            <TaxaPerdaPorBanco data={data!.taxaPerdaPorBanco!} loading={isLoading} />
          </Suspense>
        )}
      </div>

      {/* Row 8: Canais — 2 col */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {has(data?.ticketMedioPorFormaEntrada) && (
          <Suspense fallback={<ChartSkeleton />}>
            <TicketMedioPorFormaEntrada data={data!.ticketMedioPorFormaEntrada!} loading={isLoading} />
          </Suspense>
        )}
        {has(data?.palavrasChaveObservacao) && (
          <Suspense fallback={<ChartSkeleton />}>
            <PalavrasChaveObservacao data={data!.palavrasChaveObservacao!} loading={isLoading} />
          </Suspense>
        )}
      </div>

      {/* Row 9: Scatter — full width */}
      {has(data?.probabilidadeVsResultado) && (
        <Suspense fallback={<ChartSkeleton />}>
          <ProbabilidadeVsResultado data={data!.probabilidadeVsResultado!} loading={isLoading} />
        </Suspense>
      )}
    </section>
  );
}
