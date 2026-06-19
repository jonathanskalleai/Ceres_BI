import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import { Outlet } from 'react-router-dom';
import { useComercialData } from '@/hooks/useComercialData';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { CrmTopbarPortal } from '@/components/dashboard/CrmTopbarPortal';
import type { DadosComerciais, Filters } from '@/types/comercial';
import { type CategoriaFilter, CATEGORIA_OPTIONS } from '@/lib/categoriaFunil';

const emptyFilters: Filters = {
  cidade: '',
  tipoAcao: '',
  categoria: '',
  funil: '',
  dateRange: undefined,
};

interface ComercialDataContextValue {
  data: DadosComerciais;
  allData: DadosComerciais | null;
  filters: Filters;
  setFilters: (f: Filters) => void;
  isRefreshing: boolean;
  handleSync: () => Promise<void>;
  lastUpdated: string | null;
  selectedVendedor: string;
  handleSelectConsultor: (nome: string) => void;
  clearSelectedConsultor: () => void;
  cidades: string[];
  tiposAcao: string[];
  categorias: { value: CategoriaFilter; label: string }[];
}

const ComercialDataContext = createContext<ComercialDataContextValue | undefined>(undefined);

export function useComercialDataContext(): ComercialDataContextValue {
  const ctx = useContext(ComercialDataContext);
  if (!ctx) {
    throw new Error('useComercialDataContext must be used within ComercialDataProvider');
  }
  return ctx;
}

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

export function ComercialDataProvider({ children }: { children?: ReactNode }) {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const { data, allData, error, lastUpdated } = useComercialData(filters.categoria || undefined, filters.funil || undefined);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedVendedor, setSelectedVendedor] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleSync = useCallback(async () => {
    setIsRefreshing(true);
    toast({ title: 'Atualizando dados...', description: 'Buscando dados mais recentes do SQL Server.' });
    await queryClient.invalidateQueries({ queryKey: ['registros-comerciais'] });
    await queryClient.invalidateQueries({ queryKey: ['pipeline-by-vendedor'] });
    setIsRefreshing(false);
    toast({ title: 'Dados atualizados', description: 'Todos os indicadores foram recalculados.' });
  }, [queryClient, toast]);

  const handleSelectConsultor = useCallback((nome: string) => {
    setSelectedVendedor(nome);
  }, []);

  const clearSelectedConsultor = useCallback(() => {
    setSelectedVendedor('');
  }, []);

  const cidades = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.registrosRecentes.map((r) => r.cidade).filter(Boolean))).sort();
  }, [data]);

  const tiposAcao = useMemo(() => {
    if (!data) return [];
    return Object.keys(data.tiposAcao).sort();
  }, [data]);

  const categorias = CATEGORIA_OPTIONS;

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-destructive font-semibold text-lg">Erro ao carregar dados</p>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return <ContentSkeleton />;
  }

  return (
    <ComercialDataContext.Provider
      value={{
        data,
        allData,
        filters,
        setFilters,
        isRefreshing,
        handleSync,
        lastUpdated,
        selectedVendedor,
        handleSelectConsultor,
        clearSelectedConsultor,
        cidades,
        tiposAcao,
        categorias,
      }}
    >
      <CrmTopbarPortal />
      {children ?? <Outlet />}
    </ComercialDataContext.Provider>
  );
}
