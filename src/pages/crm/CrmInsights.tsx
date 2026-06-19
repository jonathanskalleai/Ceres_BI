import { useComercialDataContext } from '@/contexts/ComercialDataContext';
import { DashboardInsights } from '@/components/dashboard/DashboardInsights';

export default function CrmInsights() {
  const { data, allData, filters } = useComercialDataContext();

  return <DashboardInsights data={allData ?? data} filters={filters} />;
}
