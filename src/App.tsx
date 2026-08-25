import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ModuleGuard } from "@/components/auth/ModuleGuard";
import { FirstAccessibleModuleRedirect } from "@/components/auth/FirstAccessibleModuleRedirect";
import { LoginPage } from "@/components/auth/LoginPage";
import { AppShell } from "@/components/layout/AppShell";
import BiLayout from "./components/bi/BiLayout";
import CrmLayout from "./components/crm/CrmLayout";
import NotFound from "./pages/NotFound";

// CRM pages load after navigation. Some of their detail views include charting
// libraries, so keeping the whole CRM tree out of the bootstrap makes login
// and the protected shell much faster to parse.
const CrmOverview = lazy(() => import("./pages/crm/CrmOverview"));
const CrmConsultores = lazy(() => import("./pages/crm/CrmConsultores"));
const CrmConsultorDetail = lazy(() => import("./pages/crm/CrmConsultorDetail"));
const CrmRegistros = lazy(() => import("./pages/crm/CrmRegistros"));
const CrmCriticos = lazy(() => import("./pages/crm/CrmCriticos"));
const CrmMapa = lazy(() => import("./pages/crm/CrmMapa"));
const CrmInsights = lazy(() => import("./pages/crm/CrmInsights"));
const CrmNegocios = lazy(() => import("./pages/crm/CrmNegocios"));
const CrmAdministrativo = lazy(() => import("./pages/crm/CrmAdministrativo"));

// BI pages (lazy — heavy chart sections)
const BiComercial = lazy(() => import("./pages/bi/BiComercial"));
const BiPainel = lazy(() => import("./pages/bi/BiPainel"));
const BiPedidos = lazy(() => import("./pages/bi/BiPedidos"));
const BiProdutos = lazy(() => import("./pages/bi/BiProdutos"));
const BiServicos = lazy(() => import("./pages/bi/BiServicos"));
const BiOperacional = lazy(() => import("./pages/bi/BiOperacional"));
const BiAdmin = lazy(() => import("./pages/bi/BiAdmin"));
const BiAcoes = lazy(() => import("./pages/bi/BiAcoes"));
const BiInteligencia = lazy(() => import("./pages/bi/BiInteligencia"));
const BiEtlMonitor = lazy(() => import("./pages/bi/BiEtlMonitor"));
const BiDesempenhoVendas = lazy(() => import("./pages/bi/BiDesempenhoVendas"));

// Tools pages
const ToolsExplorer = lazy(() => import("./pages/tools/ToolsExplorer"));
const ToolsPerformance = lazy(() => import("./pages/tools/ToolsPerformance"));

// Admin pages
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminProfile = lazy(() => import("./pages/admin/AdminProfile"));

// Cache global: dados de BI/SQL Server não são realtime. Sem isso (staleTime:0
// padrão) toda troca de aba/remontagem refazia o fetch inteiro — causa da lentidão.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000, // 5 min "fresco" — não refetch ao trocar de aba
      gcTime: 30 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function LazySuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-champagne-400 border-t-transparent" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public route */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected routes — all wrapped by AppShell */}
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              {/* A pagina inicial respeita a primeira permissao visivel do usuario. */}
              <Route index element={<FirstAccessibleModuleRedirect />} />

              {/* CRM — wrapped by CrmLayout (shared filter context + topbar portal) */}
              <Route path="crm" element={<CrmLayout />}>
                <Route path="overview" element={<ModuleGuard moduleId="crm.overview"><LazySuspense><CrmOverview /></LazySuspense></ModuleGuard>} />
                <Route path="consultores" element={<ModuleGuard moduleId="crm.consultores"><LazySuspense><CrmConsultores /></LazySuspense></ModuleGuard>} />
                <Route path="consultores/:vendedor" element={<ModuleGuard moduleId="crm.consultores"><LazySuspense><CrmConsultorDetail /></LazySuspense></ModuleGuard>} />

                <Route path="registros" element={<ModuleGuard moduleId="crm.registros"><LazySuspense><CrmRegistros /></LazySuspense></ModuleGuard>} />
                <Route path="criticos" element={<ModuleGuard moduleId="crm.criticos"><LazySuspense><CrmCriticos /></LazySuspense></ModuleGuard>} />
                <Route path="mapa" element={<ModuleGuard moduleId="crm.mapa"><LazySuspense><CrmMapa /></LazySuspense></ModuleGuard>} />
                <Route path="insights" element={<ModuleGuard moduleId="crm.insights"><LazySuspense><CrmInsights /></LazySuspense></ModuleGuard>} />
                <Route path="negocios" element={<ModuleGuard moduleId="crm.negocios"><LazySuspense><CrmNegocios /></LazySuspense></ModuleGuard>} />
                <Route path="administrativo" element={<ModuleGuard moduleId="crm.administrativo"><LazySuspense><CrmAdministrativo /></LazySuspense></ModuleGuard>} />
              </Route>

              {/* BI — wrapped by BiLayout (shared filter context + topbar portal) */}
              <Route path="bi" element={<BiLayout />}>
                <Route index element={<FirstAccessibleModuleRedirect modulePrefix="bi." />} />
                <Route path="painel" element={<ModuleGuard moduleId="bi.painel"><LazySuspense><BiPainel /></LazySuspense></ModuleGuard>} />
                <Route path="comercial" element={<ModuleGuard moduleId="bi.comercial"><LazySuspense><BiComercial /></LazySuspense></ModuleGuard>} />
                <Route path="pedidos" element={<ModuleGuard moduleId="bi.pedidos"><LazySuspense><BiPedidos /></LazySuspense></ModuleGuard>} />
                <Route path="produtos" element={<ModuleGuard moduleId="bi.produtos"><LazySuspense><BiProdutos /></LazySuspense></ModuleGuard>} />
                <Route path="servicos" element={<ModuleGuard moduleId="bi.servicos"><LazySuspense><BiServicos /></LazySuspense></ModuleGuard>} />
                <Route path="operacional" element={<ModuleGuard moduleId="bi.operacional"><LazySuspense><BiOperacional /></LazySuspense></ModuleGuard>} />
                <Route path="admin" element={<ModuleGuard moduleId="bi.admin"><LazySuspense><BiAdmin /></LazySuspense></ModuleGuard>} />
                <Route path="acoes" element={<ModuleGuard moduleId="bi.acoes"><LazySuspense><BiAcoes /></LazySuspense></ModuleGuard>} />
                <Route path="inteligencia" element={<ModuleGuard moduleId="bi.inteligencia"><LazySuspense><BiInteligencia /></LazySuspense></ModuleGuard>} />
                <Route path="etl-monitor" element={<ModuleGuard moduleId="bi.etl-monitor"><LazySuspense><BiEtlMonitor /></LazySuspense></ModuleGuard>} />
                <Route path="desempenho" element={<ModuleGuard moduleId="bi.desempenho"><LazySuspense><BiDesempenhoVendas /></LazySuspense></ModuleGuard>} />
              </Route>

              {/* Tools — same filter layout */}
              <Route path="tools" element={<BiLayout />}>
                <Route path="explorer" element={<ModuleGuard moduleId="tools.explorer"><LazySuspense><ToolsExplorer /></LazySuspense></ModuleGuard>} />
                <Route path="performance" element={<ModuleGuard moduleId="tools.performance"><LazySuspense><ToolsPerformance /></LazySuspense></ModuleGuard>} />
              </Route>

              {/* Admin */}
              <Route path="admin/users" element={<LazySuspense><AdminUsers /></LazySuspense>} />
              <Route path="admin/profile" element={<LazySuspense><AdminProfile /></LazySuspense>} />

              {/* Legacy redirects */}
              <Route path="performance" element={<Navigate to="/tools/performance" replace />} />

              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
