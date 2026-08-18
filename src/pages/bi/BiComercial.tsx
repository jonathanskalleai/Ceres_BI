import { lazy, Suspense, useState } from "react";
import { BarChart3, PackageSearch, ShoppingCart } from "lucide-react";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";

const ResultadosComerciaisSection = lazy(() => import("@/components/bi/sections/ResultadosComerciaisSection"));
const PedidosGanhosSection = lazy(() => import("@/components/bi/sections/PedidosGanhosSection"));
const AdminSection = lazy(() => import("@/components/bi/sections/AdminSection"));
const ProdutosSection = lazy(() => import("@/components/bi/sections/ProdutosSection"));
const InteligenciaMercadoSection = lazy(async () => {
  const module = await import("@/components/bi/sections/InteligenciaHighlightsSections");
  return { default: module.InteligenciaMercadoSection };
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

function PositionCurrentNotice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
      <strong className="text-foreground">Posição atual:</strong> {children} Esses dados não respondem ao intervalo de datas do topo.
    </p>
  );
}

export default function BiComercial() {
  const { dateRange, vendedor, cidade } = useNegociosFilter();
  const [tab, setTab] = useState("vendas");

  return (
    <div className="space-y-5 p-8">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Vendas &amp; Resultados</h1>
        <p className="mt-1 text-sm text-muted-foreground">Análise de vendas, pedidos, carteira e oportunidades de mercado.</p>
      </header>
      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto sm:w-auto">
          <TabsTrigger value="vendas" className="gap-2"><BarChart3 className="h-4 w-4" />Vendas</TabsTrigger>
          <TabsTrigger value="pedidos" className="gap-2"><ShoppingCart className="h-4 w-4" />Pedidos</TabsTrigger>
          <TabsTrigger value="mercado" className="gap-2"><PackageSearch className="h-4 w-4" />Carteira &amp; Mercado</TabsTrigger>
        </TabsList>

        <TabsContent value="vendas">
          <Suspense fallback={<SectionFallback />}>
            <ResultadosComerciaisSection
              active={tab === "vendas"}
              dateRange={dateRange}
              vendedor={vendedor || undefined}
              cidade={cidade || undefined}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="pedidos">
          <Suspense fallback={<SectionFallback />}>
            <PedidosGanhosSection
              active={tab === "pedidos"}
              dateRange={dateRange}
              vendedor={vendedor || undefined}
              cidade={cidade || undefined}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="mercado" className="space-y-6">
          <PositionCurrentNotice>Carteira, base instalada e frota com mais de cinco anos representam o retrato mais recente disponível.</PositionCurrentNotice>
          <Suspense fallback={<SectionFallback />}>
            <AdminSection active={tab === "mercado"} dateRange={dateRange} />
            <ProdutosSection active={tab === "mercado"} dateRange={dateRange} />
            <InteligenciaMercadoSection active={tab === "mercado"} dateRange={dateRange} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
