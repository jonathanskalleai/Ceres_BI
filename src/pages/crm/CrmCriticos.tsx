import { useComercialDataContext } from '@/contexts/ComercialDataContext';
import { DashboardClientesCriticos } from '@/components/dashboard/DashboardClientesCriticos';

export default function CrmCriticos() {
  const { data, filters } = useComercialDataContext();

  return <DashboardClientesCriticos data={data} filters={filters} />;
}
