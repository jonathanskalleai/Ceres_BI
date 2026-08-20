import { lazy, Suspense } from "react";
import { type DateRange } from "react-day-picker";
import { BarChart2 } from "lucide-react";
import { useNegociosExpandidoRpc } from "@/hooks/bi/useNegociosExpandidoRpc";
import { toISODate } from "@/lib/dateUtils";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BiErrorState } from "@/components/bi/BiErrorState";
import { cn } from "@/lib/utils";

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

function SectionSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className={cn("overflow-hidden", i % 3 === 0 && "md:col-span-2")}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-52 w-full rounded-lg" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface BlockProps<T extends Record<string, unknown>> {
  title: string;
  data: T[] | null | undefined;
  loading?: boolean;
  renderer: (data: T[] | null | undefined, loading?: boolean) => React.ReactNode;
  countLabel?: string;
  className?: string;
}

function Block<T extends Record<string, unknown>>({
  title,
  data,
  loading,
  renderer,
  countLabel,
  className,
}: BlockProps<T>) {
  const isEmpty = !data || data.length === 0;

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-[var(--voux-text-muted)] truncate" title={title}>
            {title}
          </span>
          {countLabel && (
            <span className="shrink-0 rounded-full border border-[var(--voux-card-border)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--voux-text-muted)]">
              {countLabel}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEmpty ? (
          <div className="flex h-40 items-center justify-center">
            <p className="text-sm text-[var(--voux-text-muted)]">
              Sem dados para este bloco no período selecionado.
            </p>
          </div>
        ) : (
          <Suspense fallback={<Skeleton className="h-52 w-full rounded-lg" />}>
            {renderer(data, loading)}
          </Suspense>
        )}
      </CardContent>
    </Card>
  );
}

function SectionEyebrow({ label }: { label: string }) {
  return (
    <div className="col-span-full">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--voux-text-muted)] mt-4 mb-1">
        {label}
      </p>
    </div>
  );
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

  return (
    <section className="space-y-4" aria-label="Análises expandidas de Negócios">
      <div className="flex items-center gap-2">
        <BarChart2 className="h-4 w-4 text-[var(--voux-accent)]" />
        <h2 className="text-[15px] font-medium text-[var(--voux-text-heading)]">
          Análises Detalhadas
        </h2>
      </div>

      <p className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
        <strong className="text-foreground">Período:</strong>{" "}
        {dateRange?.from ? new Intl.DateTimeFormat("pt-BR").format(dateRange.from) : "—"} →{" "}
        {dateRange?.to ? new Intl.DateTimeFormat("pt-BR").format(dateRange.to) : "—"}
        {data?._meta && ` — gerado em ${new Date(data._meta.generated_at).toLocaleTimeString("pt-BR")}`}
      </p>

      {isLoading ? (
        <SectionSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* ─── Group 1: Receita & Produto ─── */}
          <SectionEyebrow label="Receita & Produto" />

          <Block
            title="1. Faturamento por Marca"
            data={data?.faturamentoPorMarca}
            loading={isLoading}
            renderer={(d, l) => <FaturamentoPorMarca data={d as import("@/types/bi/negociosExpandido").FaturamentoPorMarcaItem[] | null | undefined} loading={l} />}
            countLabel={data?.faturamentoPorMarca ? `${data.faturamentoPorMarca.length}` : undefined}
          />
          <Block
            title="5. Ranking de Produtos por Receita Ganha"
            data={data?.rankingProdutosReceitaGanha}
            loading={isLoading}
            renderer={(d, l) => <RankingProdutosReceitaGanha data={d as import("@/types/bi/negociosExpandido").RankingProdutosReceitaGanhaItem[] | null | undefined} loading={l} />}
            countLabel={data?.rankingProdutosReceitaGanha ? `${data.rankingProdutosReceitaGanha.length}` : undefined}
          />
          <Block
            title="6. Distribuição por Grupo de Produto"
            data={data?.distribuicaoPorGrupoProduto}
            loading={isLoading}
            renderer={(d, l) => <DistribuicaoPorGrupoProduto data={d as import("@/types/bi/negociosExpandido").DistribuicaoPorGrupoProdutoItem[] | null | undefined} loading={l} />}
            countLabel={data?.distribuicaoPorGrupoProduto ? `${data.distribuicaoPorGrupoProduto.length}` : undefined}
          />
          <Block
            title="7. Evolução Mensal: Ganho vs. Perda (Waterfall)"
            data={data?.waterfallMensalGanhoPerdido}
            loading={isLoading}
            renderer={(d, l) => <WaterfallMensalGanhoPerdido data={d as import("@/types/bi/negociosExpandido").WaterfallMensalGanhoPerdidoItem[] | null | undefined} loading={l} />}
            countLabel={data?.waterfallMensalGanhoPerdido ? `${data.waterfallMensalGanhoPerdido.length}` : undefined}
            className="md:col-span-2"
          />

          {/* ─── Group 2: Geografia & Canais ─── */}
          <SectionEyebrow label="Geografia & Canais" />

          <Block
            title="2. Valor por Condição de Pagamento"
            data={data?.valorPorCondicaoPagamento}
            loading={isLoading}
            renderer={(d, l) => <ValorPorCondicaoPagamento data={d as import("@/types/bi/negociosExpandido").ValorPorCondicaoPagamentoItem[] | null | undefined} loading={l} />}
            countLabel={data?.valorPorCondicaoPagamento ? `${data.valorPorCondicaoPagamento.length}` : undefined}
          />
          <Block
            title="8. Valor Ganho por Cidade"
            data={data?.valorPorCidade}
            loading={isLoading}
            renderer={(d, l) => <ValorPorCidade data={d as import("@/types/bi/negociosExpandido").ValorPorCidadeItem[] | null | undefined} loading={l} />}
            countLabel={data?.valorPorCidade ? `${data.valorPorCidade.length}` : undefined}
          />
          <Block
            title="11. Ticket Médio por Forma de Entrada"
            data={data?.ticketMedioPorFormaEntrada}
            loading={isLoading}
            renderer={(d, l) => <TicketMedioPorFormaEntrada data={d as import("@/types/bi/negociosExpandido").TicketMedioPorFormaEntradaItem[] | null | undefined} loading={l} />}
            countLabel={data?.ticketMedioPorFormaEntrada ? `${data.ticketMedioPorFormaEntrada.length}` : undefined}
          />
          <Block
            title="14. Volume por Tipo de Cliente (PF vs. PJ)"
            data={data?.volumePorTipoCliente}
            loading={isLoading}
            renderer={(d, l) => <VolumePorTipoCliente data={d as import("@/types/bi/negociosExpandido").VolumePorTipoClienteItem[] | null | undefined} loading={l} />}
            countLabel={data?.volumePorTipoCliente ? `${data.volumePorTipoCliente.length}` : undefined}
          />

          {/* ─── Group 3: Conversão & Funil ─── */}
          <SectionEyebrow label="Conversão & Funil" />

          <Block
            title="3. Matriz Etapa x Idade do Negócio"
            data={data?.heatmapEtapaIdade}
            loading={isLoading}
            renderer={(d, l) => <HeatmapEtapaIdade data={d as import("@/types/bi/negociosExpandido").HeatmapEtapaIdadeItem[] | null | undefined} loading={l} />}
            className="md:col-span-2"
          />
          <Block
            title="4. Taxa de Fechamento por Motivo de Ganho"
            data={data?.taxaFechamentoPorMotivoGanho}
            loading={isLoading}
            renderer={(d, l) => <TaxaFechamentoPorMotivoGanho data={d as import("@/types/bi/negociosExpandido").TaxaFechamentoPorMotivoGanhoItem[] | null | undefined} loading={l} />}
            countLabel={data?.taxaFechamentoPorMotivoGanho ? `${data.taxaFechamentoPorMotivoGanho.length}` : undefined}
          />
          <Block
            title="9. Taxa de Perda por Banco Financiador"
            data={data?.taxaPerdaPorBanco}
            loading={isLoading}
            renderer={(d, l) => <TaxaPerdaPorBanco data={d as import("@/types/bi/negociosExpandido").TaxaPerdaPorBancoItem[] | null | undefined} loading={l} />}
            countLabel={data?.taxaPerdaPorBanco ? `${data.taxaPerdaPorBanco.length}` : undefined}
          />
          <Block
            title="12. Ciclo de Vendas por Etapa"
            data={data?.cicloVendasPorEtapa}
            loading={isLoading}
            renderer={(d, l) => <CicloVendasPorEtapa data={d as import("@/types/bi/negociosExpandido").CicloVendasPorEtapaItem[] | null | undefined} loading={l} />}
            countLabel={data?.cicloVendasPorEtapa ? `${data.cicloVendasPorEtapa.length}` : undefined}
            className="md:col-span-2"
          />

          {/* ─── Group 4: Inteligência ─── */}
          <SectionEyebrow label="Inteligência" />

          <Block
            title="10. Termos Mais Frequentes nas Observações"
            data={data?.palavrasChaveObservacao}
            loading={isLoading}
            renderer={(d, l) => <PalavrasChaveObservacao data={d as import("@/types/bi/negociosExpandido").PalavrasChaveObservacaoItem[] | null | undefined} loading={l} />}
            countLabel={data?.palavrasChaveObservacao ? `${data.palavrasChaveObservacao.length}` : undefined}
          />
          <Block
            title="13. Valor de Usado/Troca Recebido por Mês"
            data={data?.usadoRecebidoPorMes}
            loading={isLoading}
            renderer={(d, l) => <UsadoRecebidoPorMes data={d as import("@/types/bi/negociosExpandido").UsadoRecebidoPorMesItem[] | null | undefined} loading={l} />}
            countLabel={data?.usadoRecebidoPorMes ? `${data.usadoRecebidoPorMes.length}` : undefined}
            className="md:col-span-2"
          />
          <Block
            title="15. Probabilidade CRM vs. Resultado Real"
            data={data?.probabilidadeVsResultado}
            loading={isLoading}
            renderer={(d, l) => <ProbabilidadeVsResultado data={d as import("@/types/bi/negociosExpandido").ProbabilidadeVsResultadoItem[] | null | undefined} loading={l} />}
            countLabel={data?.probabilidadeVsResultado ? `${data.probabilidadeVsResultado.length}` : undefined}
            className="md:col-span-2"
          />
        </div>
      )}
    </section>
  );
}
