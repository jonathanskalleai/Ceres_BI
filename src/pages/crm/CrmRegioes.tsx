import { useComercialDataContext } from '@/contexts/ComercialDataContext';
import { DashboardRegioes } from '@/components/dashboard/DashboardRegioes';

export default function CrmRegioes() {
  const { data, filters } = useComercialDataContext();

  return <DashboardRegioes data={data} filters={filters} />;
}
