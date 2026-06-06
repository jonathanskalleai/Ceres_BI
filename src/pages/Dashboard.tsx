import { useState, useMemo } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { DadosComerciais, Filters } from "@/types/comercial";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { DashboardConsultores } from "@/components/dashboard/DashboardConsultores";
import { DashboardRegioes } from "@/components/dashboard/DashboardRegioes";
import { DashboardRegistros } from "@/components/dashboard/DashboardRegistros";
import { DashboardConsultorDetail } from "@/components/dashboard/DashboardConsultorDetail";
import { DashboardClientesCriticos } from "@/components/dashboard/DashboardClientesCriticos";
import { DashboardInsights } from "@/components/dashboard/DashboardInsights";
import { DashboardMapa } from "@/components/dashboard/DashboardMapa";
import { DashboardNegociosMensais } from "@/components/dashboard/DashboardNegociosMensais";
import { DashboardAdministrativo } from "@/components/dashboard/DashboardAdministrativo";
import { DashboardViewExplorer } from "@/components/dashboard/DashboardViewExplorer";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import DashboardBIReal from "@/pages/DashboardBIReal";
import { useComercialData } from "@/hooks/useComercialData";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type View = "overview" | "consultores" | "regioes" | "registros" | "consultor-detail" | "criticos" | "insights" | "mapa" | "negocios-mensais" | "administrativo" | "view-explorer" | "dashboard-bi";

const emptyFilters: Filters = { vendedor: "", cidade: "", periodo: "", ano: "", mes: "", tipoAcao: "" };

/** Skeleton só da área de conteúdo (o shell/menu já renderiza na hora). */
function ContentSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}

const Dashboard = () => {
  const { data, allData, error, lastUpdated } = useComercialData();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<View>("overview");
  const [selectedVendedor, setSelectedVendedor] = useState<string>("");
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleSync = async () => {
    setIsRefreshing(true);
    toast({ title: "Atualizando dados...", description: "Buscando dados mais recentes do SQL Server." });
    await queryClient.invalidateQueries({ queryKey: ["registros-comerciais"] });
    await queryClient.invalidateQueries({ queryKey: ["negocios-mensais"] });
    setIsRefreshing(false);
    toast({ title: "Dados atualizados", description: "Todos os indicadores foram recalculados." });
  };

  const cidades = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.registrosRecentes.map((r) => r.cidade).filter(Boolean))).sort();
  }, [data]);

  const tiposAcao = useMemo(() => (data ? Object.keys(data.tiposAcao).sort() : []), [data]);
  const anos = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    for (const r of data.registrosRecentes) {
      const y = r.dtConclusao?.split("-")[0];
      if (y && y.length === 4) set.add(y);
    }
    for (const e of data.evolucaoGlobal) {
      const y = e.YearMonth?.split("-")[0];
      if (y) set.add(y);
    }
    return Array.from(set).sort();
  }, [data]);

  const handleSelectConsultor = (nome: string) => {
    setSelectedVendedor(nome);
    setCurrentView("consultor-detail");
  };

  const handleBack = () => {
    setCurrentView("consultores");
    setSelectedVendedor("");
  };

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <p className="text-destructive font-semibold text-lg">Erro ao carregar dados</p>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <DashboardSidebar
        currentView={currentView}
        onNavigate={(view) => {
          setCurrentView(view as View);
          if (view !== "consultor-detail") setSelectedVendedor("");
        }}
        lastUpdated={lastUpdated}
      />
      <main className="flex-1 overflow-auto">
        <div className="flex items-center justify-between p-3 pb-0">
          {data && currentView !== "view-explorer" && currentView !== "dashboard-bi" ? (
            <DashboardFilters
              filters={filters}
              onFiltersChange={setFilters}
              anos={anos}
              vendedores={data.vendedores}
              cidades={cidades}
            />
          ) : (
            <div />
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={isRefreshing}
            className="gap-2 text-xs"
          >
            {isRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {isRefreshing ? "Atualizando..." : "Atualizar Dados"}
          </Button>
        </div>
        {/* Views com dados próprios — renderizam na hora, sem esperar a base comercial */}
        {currentView === "view-explorer" && <DashboardViewExplorer />}
        {currentView === "dashboard-bi" && <DashboardBIReal />}

        {/* Views da base comercial — skeleton só na área de conteúdo enquanto carrega */}
        {currentView !== "view-explorer" && currentView !== "dashboard-bi" && (
          !data ? (
            <ContentSkeleton />
          ) : (
            <>
              {currentView === "overview" && (
                <DashboardOverview
                  data={data}
                  filters={filters}
                  onSelectConsultor={handleSelectConsultor}
                  totalRegistrosBase={allData?.kpis.totalRegistros}
                />
              )}
              {currentView === "consultores" && (
                <DashboardConsultores data={data} filters={filters} onSelectConsultor={handleSelectConsultor} />
              )}
              {currentView === "regioes" && (
                <DashboardRegioes data={data} filters={filters} />
              )}
              {currentView === "registros" && (
                <DashboardRegistros data={data} filters={filters} />
              )}
              {currentView === "criticos" && (
                <DashboardClientesCriticos data={data} filters={filters} />
              )}
              {currentView === "insights" && (
                <DashboardInsights data={data} filters={filters} />
              )}
              {currentView === "mapa" && (
                <DashboardMapa data={data} filters={filters} />
              )}
              {currentView === "negocios-mensais" && (
                <DashboardNegociosMensais filters={filters} crmData={data} />
              )}
              {currentView === "administrativo" && allData && (
                <DashboardAdministrativo data={allData} filters={filters} />
              )}
              {currentView === "consultor-detail" && selectedVendedor && (
                <DashboardConsultorDetail
                  vendedor={data.vendedores.find((v) => v.nome === selectedVendedor)!}
                  registros={data.registrosRecentes}
                  onBack={handleBack}
                />
              )}
            </>
          )
        )}
      </main>
    </div>
  );
};

export default Dashboard;
