import { useComercialDataContext } from '@/contexts/ComercialDataContext';
import { DashboardRegioes } from '@/components/dashboard/DashboardRegioes';

export default function CrmRegioes() {
  const { data, allData, filters } = useComercialDataContext();

  return <DashboardRegioes data={allData ?? data} filters={filters} />;
}
