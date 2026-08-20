import { lazy, Suspense, useState } from "react";
import { type DateRange } from "react-day-picker";
import { BarChart2 } from "lucide-react";
import { useNegociosExpandidoRpc } from "@/hooks/bi/useNegociosExpandidoRpc";
import { toISODate } from "@/lib/dateUtils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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

function SectionSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-5 w-64" />
          <Skeleton className="h-52 w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}

interface BlockItemProps<T extends Record<string, unknown>> {
  data: T[] | null | undefined;
  loading?: boolean;
  renderer: (props: { data: T[]; loading?: boolean }) => React.ReactNode;
  title: string;
}

function BlockItem<T extends Record<string, unknown>>({ data, loading, renderer: RenderProps, title }: BlockItemProps<T>) {
  if (!data || data.length === 0) {
    return (
      <AccordionItem value={title}>
        <AccordionTrigger className="text-[13px] font-medium">{title}</AccordionTrigger>
        <AccordionContent>
          <p className="py-6 text-center text-sm text-[var(--voux-text-muted)]">
            Sem dados para este bloco no período selecionado.
          </p>
        </AccordionContent>
      </AccordionItem>
    );
  }
  return (
    <AccordionItem value={title}>
      <AccordionTrigger className="text-[13px] font-medium">{title}</AccordionTrigger>
      <AccordionContent>
        <Suspense fallback={<Skeleton className="h-52 w-full rounded-xl" />}>
          {RenderProps({ data, loading })}
        </Suspense>
      </AccordionContent>
    </AccordionItem>
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
        <span className="rounded-full border border-[var(--voux-card-border)] px-2 py-0.5 text-[10px] font-mono text-[var(--voux-text-muted)]">
          15 blocos
        </span>
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
        <Accordion type="single" defaultValue="FaturamentoPorMarca" collapsible className="space-y-1">
          <BlockItem
            title="1. Faturamento por Marca"
            data={data?.faturamentoPorMarca}
            loading={isLoading}
            renderer={({ data: d, loading: l }) => <FaturamentoPorMarca data={d} loading={l} />}
          />
          <BlockItem
            title="2. Valor por Condição de Pagamento"
            data={data?.valorPorCondicaoPagamento}
            loading={isLoading}
            renderer={({ data: d, loading: l }) => <ValorPorCondicaoPagamento data={d} loading={l} />}
          />
          <BlockItem
            title="3. Matriz Etapa x Idade do Negócio"
            data={data?.heatmapEtapaIdade}
            loading={isLoading}
            renderer={({ data: d, loading: l }) => <HeatmapEtapaIdade data={d} loading={l} />}
          />
          <BlockItem
            title="4. Taxa de Fechamento por Motivo de Ganho"
            data={data?.taxaFechamentoPorMotivoGanho}
            loading={isLoading}
            renderer={({ data: d, loading: l }) => <TaxaFechamentoPorMotivoGanho data={d} loading={l} />}
          />
          <BlockItem
            title="5. Ranking de Produtos por Receita Ganha"
            data={data?.rankingProdutosReceitaGanha}
            loading={isLoading}
            renderer={({ data: d, loading: l }) => <RankingProdutosReceitaGanha data={d} loading={l} />}
          />
          <BlockItem
            title="6. Distribuição por Grupo de Produto"
            data={data?.distribuicaoPorGrupoProduto}
            loading={isLoading}
            renderer={({ data: d, loading: l }) => <DistribuicaoPorGrupoProduto data={d} loading={l} />}
          />
          <BlockItem
            title="7. Evolução Mensal: Ganho vs. Perda (Waterfall)"
            data={data?.waterfallMensalGanhoPerdido}
            loading={isLoading}
            renderer={({ data: d, loading: l }) => <WaterfallMensalGanhoPerdido data={d} loading={l} />}
          />
          <BlockItem
            title="8. Valor Ganho por Cidade"
            data={data?.valorPorCidade}
            loading={isLoading}
            renderer={({ data: d, loading: l }) => <ValorPorCidade data={d} loading={l} />}
          />
          <BlockItem
            title="9. Taxa de Perda por Banco Financiador"
            data={data?.taxaPerdaPorBanco}
            loading={isLoading}
            renderer={({ data: d, loading: l }) => <TaxaPerdaPorBanco data={d} loading={l} />}
          />
          <BlockItem
            title="10. Termos Mais Frequentes nas Observações"
            data={data?.palavrasChaveObservacao}
            loading={isLoading}
            renderer={({ data: d, loading: l }) => <PalavrasChaveObservacao data={d} loading={l} />}
          />
          <BlockItem
            title="11. Ticket Médio por Forma de Entrada"
            data={data?.ticketMedioPorFormaEntrada}
            loading={isLoading}
            renderer={({ data: d, loading: l }) => <TicketMedioPorFormaEntrada data={d} loading={l} />}
          />
          <BlockItem
            title="12. Ciclo de Vendas por Etapa"
            data={data?.cicloVendasPorEtapa}
            loading={isLoading}
            renderer={({ data: d, loading: l }) => <CicloVendasPorEtapa data={d} loading={l} />}
          />
          <BlockItem
            title="13. Valor de Usado/Troca Recebido por Mês"
            data={data?.usadoRecebidoPorMes}
            loading={isLoading}
            renderer={({ data: d, loading: l }) => <UsadoRecebidoPorMes data={d} loading={l} />}
          />
          <BlockItem
            title="14. Volume por Tipo de Cliente (PF vs. PJ)"
            data={data?.volumePorTipoCliente}
            loading={isLoading}
            renderer={({ data: d, loading: l }) => <VolumePorTipoCliente data={d} loading={l} />}
          />
          <BlockItem
            title="15. Probabilidade CRM vs. Resultado Real"
            data={data?.probabilidadeVsResultado}
            loading={isLoading}
            renderer={({ data: d, loading: l }) => <ProbabilidadeVsResultado data={d} loading={l} />}
          />
        </Accordion>
      )}
    </section>
  );
}
