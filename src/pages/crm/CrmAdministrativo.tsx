import { useComercialDataContext } from '@/contexts/ComercialDataContext';
import { DashboardAdministrativo } from '@/components/dashboard/DashboardAdministrativo';

export default function CrmAdministrativo() {
  const { allData, filters } = useComercialDataContext();

  if (!allData) return null;

  return <DashboardAdministrativo data={allData} filters={filters} />;
}
