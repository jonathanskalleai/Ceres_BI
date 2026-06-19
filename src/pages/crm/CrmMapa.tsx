import { useComercialDataContext } from '@/contexts/ComercialDataContext';
import { DashboardMapa } from '@/components/dashboard/DashboardMapa';

export default function CrmMapa() {
  const { data, allData, filters } = useComercialDataContext();

  return <DashboardMapa data={allData ?? data} filters={filters} />;
}
