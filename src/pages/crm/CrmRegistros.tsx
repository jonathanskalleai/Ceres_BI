import { useComercialDataContext } from '@/contexts/ComercialDataContext';
import { DashboardRegistros } from '@/components/dashboard/DashboardRegistros';

export default function CrmRegistros() {
  const { data, filters } = useComercialDataContext();

  return <DashboardRegistros data={data} filters={filters} />;
}
