import { useState, Suspense, lazy } from "react";
import { type DateRange } from "react-day-picker";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DashboardViewExplorer } from "@/components/dashboard/DashboardViewExplorer";
import { useSyncStatus } from "@/hooks/bi/useSyncStatus";
import { type CategoriaFilter, CATEGORIA_ALL, CATEGORIA_OPTIONS, FUNIL_ALL, getFunilOptions } from "@/lib/categoriaFunil";

const ComercialSection = lazy(() => import("@/components/bi/sections/ComercialSection"));
const PedidosSection = lazy(() => import("@/components/bi/sections/PedidosSection"));
const ProdutosSection = lazy(() => import("@/components/bi/sections/ProdutosSection"));
const ServicosSection = lazy(() => import("@/components/bi/sections/ServicosSection"));
const OperacionalSection = lazy(() => import("@/components/bi/sections/OperacionalSection"));
const AdminSection = lazy(() => import("@/components/bi/sections/AdminSection"));
const AcoesSection = lazy(() => import("@/components/bi/sections/AcoesSection"));

const TABS = [
  { value: "comercial", label: "Comercial" },
  { value: "pedidos", label: "Pedidos" },
  { value: "produtos", label: "Produtos" },
  { value: "servicos", label: "Servicos" },
  { value: "operacional", label: "Operacional" },
  { value: "admin", label: "Admin" },
  { value: "acoes", label: "Acoes" },
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

const DashboardBIReal = () => {
  const [activeTab, setActiveTab] = useState<TabValue>("comercial");
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [categoria, setCategoria] = useState<CategoriaFilter>(CATEGORIA_ALL);
  const [funil, setFunil] = useState<string>(FUNIL_ALL);
  const { lastSyncAt, isStale } = useSyncStatus();

  const funilOptions = getFunilOptions(categoria);

  const handleCategoriaChange = (v: string) => {
    setCategoria(v as CategoriaFilter);
    setFunil(FUNIL_ALL); // reset funil when categoria changes
  };

  const syncLabel = lastSyncAt
    ? `Atualizado ha ${formatMinutesAgo(lastSyncAt)}`
    : "Sync indisponivel";

  return (
    <div className="relative p-8 space-y-5">
      {/* Ambient radials — VOUX */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-20 -left-10 h-80 w-80 rounded-full blur-3xl"
          style={{ background: "rgba(212,184,150,0.04)" }} />
        <div className="absolute top-1/2 right-0 h-96 w-96 rounded-full blur-3xl"
          style={{ background: "rgba(142,163,184,0.03)" }} />
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div
            className="text-[9px] tracking-[0.28em] uppercase text-[var(--voux-text-muted)] mb-2"
            style={{ fontFamily: "var(--voux-font-mono)" }}
          >
            BI ANALYTICS
          </div>
          <h2
            className="text-[24px] leading-none tracking-[-0.012em] text-[var(--voux-text-primary)]"
            style={{ fontFamily: "var(--voux-font-display)", margin: 0 }}
          >
            Dashboard <em style={{ color: "var(--voux-accent)", fontStyle: "normal" }}>BI</em>
          </h2>
          <p
            className="text-[11px] text-[var(--voux-text-muted)] mt-2"
            style={{ fontFamily: "var(--voux-font-mono)", letterSpacing: "0.04em" }}
          >
            Análise completa — SQL Server
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <Select value={categoria} onValueChange={handleCategoriaChange}>
            <SelectTrigger className="w-[180px] h-9 text-sm border-[var(--voux-card-border)] bg-transparent text-[var(--voux-text-muted)]">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIA_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={funil} onValueChange={setFunil}>
            <SelectTrigger className="w-[180px] h-9 text-sm border-[var(--voux-card-border)] bg-transparent text-[var(--voux-text-muted)]">
              <SelectValue placeholder="Funil" />
            </SelectTrigger>
            <SelectContent>
              {funilOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge
            variant={isStale ? "destructive" : "secondary"}
            className={isStale
              ? "bg-[rgba(201,117,101,0.12)] text-[#c97565] border-[rgba(201,117,101,0.2)]"
              : "bg-[rgba(122,155,111,0.12)] text-[#7a9b6f] border-[rgba(122,155,111,0.2)]"}
            style={{ fontFamily: "var(--voux-font-mono)", fontSize: 9, letterSpacing: "0.1em" }}
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
            <ComercialSection active={activeTab === "comercial"} dateRange={dateRange} categoria={categoria} funil={funil} />
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

        <TabsContent value="acoes">
          <Suspense fallback={<SectionFallback />}>
            <AcoesSection active={activeTab === "acoes"} dateRange={dateRange} />
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
