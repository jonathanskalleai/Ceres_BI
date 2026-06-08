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
import type { DadosComerciais, Filters } from '@/types/comercial';

const emptyFilters: Filters = {
  vendedor: '',
  cidade: '',
  periodo: '',
  ano: '',
  mes: '',
  tipoAcao: '',
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
  anos: string[];
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
  const { data, allData, error, lastUpdated } = useComercialData();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [selectedVendedor, setSelectedVendedor] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleSync = useCallback(async () => {
    setIsRefreshing(true);
    toast({ title: 'Atualizando dados...', description: 'Buscando dados mais recentes do SQL Server.' });
    await queryClient.invalidateQueries({ queryKey: ['registros-comerciais'] });
    await queryClient.invalidateQueries({ queryKey: ['negocios-mensais'] });
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

  const anos = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    for (const r of data.registrosRecentes) {
      const y = r.dtConclusao?.split('-')[0];
      if (y && y.length === 4) set.add(y);
    }
    for (const e of data.evolucaoGlobal) {
      const y = e.YearMonth?.split('-')[0];
      if (y) set.add(y);
    }
    return Array.from(set).sort();
  }, [data]);

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
        anos,
      }}
    >
      {children ?? <Outlet />}
    </ComercialDataContext.Provider>
  );
}
