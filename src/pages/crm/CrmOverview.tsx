import { useComercialDataContext } from '@/contexts/ComercialDataContext';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';

export default function CrmOverview() {
  const { data, allData, filters, handleSelectConsultor } = useComercialDataContext();

  return (
    <DashboardOverview
      data={allData ?? data}
      filters={filters}
      onSelectConsultor={handleSelectConsultor}
      totalRegistrosBase={allData?.kpis.totalRegistros}
    />
  );
}
