import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardFilters } from './DashboardFilters';
import { useComercialDataContext } from '@/contexts/ComercialDataContext';

/**
 * Renders CRM filters inside the AppShell topbar via React Portal.
 * Target: <div id="topbar-actions"> in AppShellTopbar.
 */
export function CrmTopbarPortal() {
  const { filters, setFilters, cidades, tiposAcao, categorias, handleSync, isRefreshing } =
    useComercialDataContext();

  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.getElementById('topbar-actions');
    setContainer(el);
  }, []);

  if (!container) return null;

  return createPortal(
    <>
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
    </>,
    container
  );
}
