import { useComercialDataContext } from '@/contexts/ComercialDataContext';
import { DashboardNegociosMensais } from '@/components/dashboard/DashboardNegociosMensais';

export default function CrmNegocios() {
  const { data, allData, filters } = useComercialDataContext();

  return <DashboardNegociosMensais filters={filters} crmData={allData ?? data} />;
}
