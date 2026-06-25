import { useMemo } from 'react';
import { format } from 'date-fns';
import { useNegociosFilter } from '@/contexts/NegociosFilterContext';
import { useRegistrosRecentes } from '@/hooks/useComercialRpc';
import { mapRegistroRecente } from '@/lib/comercialMappers';
import { DashboardNegociosMensais } from '@/components/dashboard/DashboardNegociosMensais';
import type { Filters, DadosComerciais } from '@/types/comercial';

/**
 * CRM Negocios page — migrated to RPC-backed data (Onda 5).
 * Uses useNegociosFilter for shared filter state and useRegistrosRecentes
 * for the cross-reference charts in NegociosCharts.
 */
export default function CrmNegocios() {
  const { dateRange, cidade } = useNegociosFilter();

  const from = dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined;
  const to = dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined;

  // Build old-style Filters for DashboardNegociosMensais
  const filters: Filters = useMemo(() => ({
    cidade: cidade || '',
    tipoAcao: '',
    categoria: '',
    funil: '',
    dateRange: from && to ? { from, to } : undefined,
  }), [cidade, from, to]);

  // Fetch registros for cross-reference charts
  const { data: registrosRpc } = useRegistrosRecentes({ from, to, cidade: cidade || undefined });

  // Build minimal DadosComerciais shell — only registrosRecentes is consumed
  const crmData: DadosComerciais = useMemo(() => ({
    kpis: { totalAcoes: 0, totalClientes: 0, totalVisitas: 0, taxaConversao: 0, receitaTotal: 0, ticketMedio: 0 },
    vendedores: [],
    regioes: [],
    evolucaoGlobal: [],
    tiposContato: {},
    tiposAcao: {},
    registrosRecentes: (registrosRpc ?? []).map(mapRegistroRecente),
    listaVendedores: [],
    listaCidades: [],
  }), [registrosRpc]);

  return <DashboardNegociosMensais filters={filters} crmData={crmData} />;
}
