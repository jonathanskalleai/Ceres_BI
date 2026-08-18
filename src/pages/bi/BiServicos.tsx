import { lazy, Suspense, useState } from "react";
import { Gauge, Wrench } from "lucide-react";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

const ServicosEssenciaisSection = lazy(() => import("@/components/bi/sections/ServicosEssenciaisSection"));
const OperacionalSection = lazy(() => import("@/components/bi/sections/OperacionalSection"));
const InteligenciaSlaSection = lazy(async () => {
  const module = await import("@/components/bi/sections/InteligenciaHighlightsSections");
  return { default: module.InteligenciaSlaSection };
});

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

export default function BiServicos() {
  const { dateRange } = useNegociosFilter();
  const [tab, setTab] = useState("ordens-sla");

  return (
    <div className="space-y-5 p-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Pós-Venda &amp; Serviços</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ordens de serviço, SLA, agenda técnica e frota de campo.</p>
      </header>
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto sm:w-auto">
          <TabsTrigger value="ordens-sla" className="gap-2"><Wrench className="h-4 w-4" />Ordens de Serviço &amp; SLA</TabsTrigger>
          <TabsTrigger value="operacao" className="gap-2"><Gauge className="h-4 w-4" />Operação Técnica &amp; Frota</TabsTrigger>
        </TabsList>

        <TabsContent value="ordens-sla" className="space-y-6">
          <Suspense fallback={<SectionFallback />}>
            <ServicosEssenciaisSection active={tab === "ordens-sla"} dateRange={dateRange} />
            <InteligenciaSlaSection active={tab === "ordens-sla"} dateRange={dateRange} />
          </Suspense>
        </TabsContent>

        <TabsContent value="operacao" className="space-y-4">
          <p className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
            <strong className="text-foreground">Posição operacional atual:</strong> técnicos, frota e agenda usam o retrato mais recente disponível e ainda não respondem ao intervalo de datas do topo.
          </p>
          <Suspense fallback={<SectionFallback />}>
            <OperacionalSection active={tab === "operacao"} dateRange={dateRange} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
