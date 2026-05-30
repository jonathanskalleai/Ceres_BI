import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "./pages/Dashboard";
import PerformanceComercial from "./pages/PerformanceComercial";
import PipelineModule from "./pages/PipelineModule";
import PosVendaModule from "./pages/PosVendaModule";
import Cliente360Module from "./pages/Cliente360Module";
import ProdutosModule from "./pages/ProdutosModule";
import DashboardBI from "./pages/DashboardBI";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/bi" element={<DashboardBI />} />
          <Route path="/performance" element={<PerformanceComercial />} />
          <Route path="/pipeline" element={<PipelineModule />} />
          <Route path="/pos-venda" element={<PosVendaModule />} />
          <Route path="/cliente360" element={<Cliente360Module />} />
          <Route path="/produtos" element={<ProdutosModule />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
