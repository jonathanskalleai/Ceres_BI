import { RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardFilters } from './DashboardFilters';
import { useComercialDataContext } from '@/contexts/ComercialDataContext';

/**
 * Sticky filter bar rendered inside ComercialDataProvider,
 * above the CRM route Outlet. VOUX dark aesthetic.
 */
export function CrmFiltersBar() {
  const { filters, setFilters, cidades, tiposAcao, categorias, handleSync, isRefreshing } =
    useComercialDataContext();

  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between gap-4 px-6 py-3 border-b backdrop-blur-sm"
      style={{
        borderColor: "var(--voux-card-border)",
        backgroundColor: "color-mix(in srgb, var(--voux-card-to) 95%, transparent)",
      }}
    >
      <DashboardFilters
        filters={filters}
        onFiltersChange={setFilters}
        cidades={cidades}
        tiposAcao={tiposAcao}
        categorias={categorias}
      />

      <Button
        variant="outline"
        size="sm"
        onClick={handleSync}
        disabled={isRefreshing}
        className="shrink-0 rounded-full text-xs font-mono tracking-wide"
        style={{
          borderColor: "var(--voux-card-border)",
          color: "var(--voux-accent)",
        }}
      >
        {isRefreshing ? (
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        )}
        {isRefreshing ? 'Atualizando...' : 'Atualizar'}
      </Button>
    </div>
  );
}
