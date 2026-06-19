import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { LoginPage } from "@/components/auth/LoginPage";
import { AppShell } from "@/components/layout/AppShell";
import { ComercialDataProvider } from "@/contexts/ComercialDataContext";
import BiLayout from "./components/bi/BiLayout";
import NotFound from "./pages/NotFound";

// CRM pages (thin wrappers — eager since they're tiny)
import CrmOverview from "./pages/crm/CrmOverview";
import CrmConsultores from "./pages/crm/CrmConsultores";
import CrmConsultorDetail from "./pages/crm/CrmConsultorDetail";

import CrmRegistros from "./pages/crm/CrmRegistros";
import CrmCriticos from "./pages/crm/CrmCriticos";
import CrmMapa from "./pages/crm/CrmMapa";
import CrmInsights from "./pages/crm/CrmInsights";
import CrmNegocios from "./pages/crm/CrmNegocios";
import CrmAdministrativo from "./pages/crm/CrmAdministrativo";

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
              {/* Root redirect */}
              <Route index element={<Navigate to="/crm/overview" replace />} />

              {/* CRM — wrapped by ComercialDataProvider */}
              <Route path="crm" element={<ComercialDataProvider />}>
                <Route path="overview" element={<CrmOverview />} />
                <Route path="consultores" element={<CrmConsultores />} />
                <Route path="consultores/:vendedor" element={<CrmConsultorDetail />} />
                
                <Route path="registros" element={<CrmRegistros />} />
                <Route path="criticos" element={<CrmCriticos />} />
                <Route path="mapa" element={<CrmMapa />} />
                <Route path="insights" element={<CrmInsights />} />
                <Route path="negocios" element={<CrmNegocios />} />
                <Route path="administrativo" element={<CrmAdministrativo />} />
              </Route>

              {/* BI — wrapped by BiLayout (shared filter context + topbar portal) */}
              <Route path="bi" element={<BiLayout />}>
                <Route index element={<Navigate to="painel" replace />} />
                <Route path="painel" element={<LazySuspense><BiPainel /></LazySuspense>} />
                <Route path="comercial" element={<LazySuspense><BiComercial /></LazySuspense>} />
                <Route path="pedidos" element={<LazySuspense><BiPedidos /></LazySuspense>} />
                <Route path="produtos" element={<LazySuspense><BiProdutos /></LazySuspense>} />
                <Route path="servicos" element={<LazySuspense><BiServicos /></LazySuspense>} />
                <Route path="operacional" element={<LazySuspense><BiOperacional /></LazySuspense>} />
                <Route path="admin" element={<LazySuspense><BiAdmin /></LazySuspense>} />
                <Route path="acoes" element={<LazySuspense><BiAcoes /></LazySuspense>} />
                <Route path="inteligencia" element={<LazySuspense><BiInteligencia /></LazySuspense>} />
              </Route>

              {/* Tools — same filter layout */}
              <Route path="tools" element={<BiLayout />}>
                <Route path="explorer" element={<LazySuspense><ToolsExplorer /></LazySuspense>} />
                <Route path="performance" element={<LazySuspense><ToolsPerformance /></LazySuspense>} />
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
