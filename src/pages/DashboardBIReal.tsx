import { useState, Suspense, lazy } from "react";
import { type DateRange } from "react-day-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DashboardViewExplorer } from "@/components/dashboard/DashboardViewExplorer";
import { useSyncStatus } from "@/hooks/bi/useSyncStatus";

const ComercialSection = lazy(() => import("@/components/bi/sections/ComercialSection"));
const PedidosSection = lazy(() => import("@/components/bi/sections/PedidosSection"));
const ProdutosSection = lazy(() => import("@/components/bi/sections/ProdutosSection"));
const ServicosSection = lazy(() => import("@/components/bi/sections/ServicosSection"));
const OperacionalSection = lazy(() => import("@/components/bi/sections/OperacionalSection"));
const AdminSection = lazy(() => import("@/components/bi/sections/AdminSection"));

const TABS = [
  { value: "comercial", label: "Comercial" },
  { value: "pedidos", label: "Pedidos" },
  { value: "produtos", label: "Produtos" },
  { value: "servicos", label: "Servicos" },
  { value: "operacional", label: "Operacional" },
  { value: "admin", label: "Admin" },
  { value: "explorer", label: "Explorer" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

function formatMinutesAgo(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  return `${diffH}h`;
}

function SectionFallback() {
  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-72" />
        ))}
      </div>
    </div>
  );
}

const FUNIS = [
  { value: "__all__", label: "Todos os funis" },
  { value: "VENDAS", label: "Vendas" },
  { value: "Vendas AP", label: "Vendas AP" },
  { value: "ADM", label: "ADM" },
  { value: "Adm AP", label: "Adm AP" },
  { value: "BANCOS", label: "Bancos" },
  { value: "Logistica AP", label: "Logística AP" },
  { value: "MARKETING", label: "Marketing" },
  { value: "OFICINA", label: "Oficina" },
  { value: "REPASSE DE MAQUINA", label: "Repasse de Máquina" },
] as const;

const DashboardBIReal = () => {
  const [activeTab, setActiveTab] = useState<TabValue>("comercial");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [funil, setFunil] = useState<string>("__all__");
  const { lastSyncAt, isStale } = useSyncStatus();

  const syncLabel = lastSyncAt
    ? `Atualizado ha ${formatMinutesAgo(lastSyncAt)}`
    : "Sync indisponivel";

  return (
    <div className="relative p-6 space-y-4">
      {/* Fundo ambiente — radiais suaves para o efeito glass (blur) refratar */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-amber-400/20 blur-3xl" />
        <div className="absolute top-1/3 right-0 h-80 w-80 rounded-full bg-blue-500/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-violet-500/15 blur-3xl" />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard BI</h1>
          <p className="text-sm text-muted-foreground">
            Analise completa de todas as views do SQL Server
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Select value={funil} onValueChange={setFunil}>
            <SelectTrigger className="w-[180px] h-9 text-sm">
              <SelectValue placeholder="Funil" />
            </SelectTrigger>
            <SelectContent>
              {FUNIS.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge
            variant={isStale ? "destructive" : "secondary"}
            className={isStale ? "bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-100" : ""}
          >
            {syncLabel}
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList className="flex flex-wrap gap-1 h-auto">
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="comercial">
          <Suspense fallback={<SectionFallback />}>
            <ComercialSection active={activeTab === "comercial"} dateRange={dateRange} funil={funil} />
          </Suspense>
        </TabsContent>

        <TabsContent value="pedidos">
          <Suspense fallback={<SectionFallback />}>
            <PedidosSection active={activeTab === "pedidos"} dateRange={dateRange} />
          </Suspense>
        </TabsContent>

        <TabsContent value="produtos">
          <Suspense fallback={<SectionFallback />}>
            <ProdutosSection active={activeTab === "produtos"} dateRange={dateRange} />
          </Suspense>
        </TabsContent>

        <TabsContent value="servicos">
          <Suspense fallback={<SectionFallback />}>
            <ServicosSection active={activeTab === "servicos"} dateRange={dateRange} />
          </Suspense>
        </TabsContent>

        <TabsContent value="operacional">
          <Suspense fallback={<SectionFallback />}>
            <OperacionalSection active={activeTab === "operacional"} dateRange={dateRange} />
          </Suspense>
        </TabsContent>

        <TabsContent value="admin">
          <Suspense fallback={<SectionFallback />}>
            <AdminSection active={activeTab === "admin"} dateRange={dateRange} />
          </Suspense>
        </TabsContent>

        <TabsContent value="explorer">
          <DashboardViewExplorer />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DashboardBIReal;
