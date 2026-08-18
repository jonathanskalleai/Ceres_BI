import { lazy, Suspense } from "react";
import { Gauge } from "lucide-react";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { Skeleton } from "@/components/ui/skeleton";

const OperacionalSection = lazy(() => import("@/components/bi/sections/OperacionalSection"));

function SectionFallback() {
  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-24" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Skeleton className="h-72" /><Skeleton className="h-72" />
      </div>
    </div>
  );
}

/** O CEM não utiliza OS/SLA; esta composição expõe somente a operação realmente consultada. */
export default function BiServicos() {
  const { dateRange } = useNegociosFilter();

  return (
    <div className="space-y-5 p-8">
      <header className="flex items-start gap-3">
        <Gauge className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Pós-Venda &amp; Serviços</h1>
          <p className="mt-1 text-sm text-muted-foreground">Operação técnica, frota e agenda de campo.</p>
        </div>
      </header>
      <p className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
        <strong className="text-foreground">Posição operacional atual:</strong> técnicos, frota e agenda usam o retrato mais recente disponível e ainda não respondem ao intervalo de datas do topo.
      </p>
      <Suspense fallback={<SectionFallback />}>
        <OperacionalSection active dateRange={dateRange} />
      </Suspense>
    </div>
  );
}
