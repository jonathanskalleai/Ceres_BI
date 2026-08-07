import { Button } from '@/components/ui/button';
import type { DashboardDefinition } from '@/types/insights';

export const DashboardNavigation = ({
  dashboards,
  currentView,
  onNavigate,
  filters,
  onFiltersChange,
  cidades,
  tiposAcao,
  lastUpdated
}: {
  dashboards: DashboardDefinition[];
  currentView: string;
  onNavigate: (view: string) => void;
  filters: Record<string, string>;
  onFiltersChange: (filters: Record<string, string>) => void;
  cidades?: string[];
  tiposAcao?: string[];
  lastUpdated?: Date;
}) => {
  const categories = Array.from(new Set(dashboards.map(d => d.category)));

  return (
    <div className="w-64 border-r border-border p-4 space-y-4">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Navigation</h2>
        <div className="space-y-1">
          {categories.map((category) => (
            <Button
              key={category}
              variant={currentView === category ? "default" : "ghost"}
              size="sm"
              className="w-full justify-start"
              onClick={() => onNavigate(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Filters</h3>
        <div className="space-y-2">
          <select
            className="w-full p-2 border border-border rounded text-sm"
            value={filters.cidade || ''}
            onChange={(e) => onFiltersChange({ ...filters, cidade: e.target.value })}
          >
            <option value="">Cidade</option>
            {cidades?.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            className="w-full p-2 border border-border rounded text-sm"
            value={filters.tipoAcao || ''}
            onChange={(e) => onFiltersChange({ ...filters, tipoAcao: e.target.value })}
          >
            <option value="">Tipo Acao</option>
            {tiposAcao?.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {lastUpdated && (
        <div className="text-xs text-muted-foreground">
          Ultima atualizacao: {lastUpdated.toLocaleString()}
        </div>
      )}
    </div>
  );
};
