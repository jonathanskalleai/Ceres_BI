import { useComercialDataContext } from '@/contexts/ComercialDataContext';
import { DashboardInsights } from '@/components/dashboard/DashboardInsights';

export default function CrmInsights() {
  const { data, filters } = useComercialDataContext();

  return <DashboardInsights data={data} filters={filters} />;
}
