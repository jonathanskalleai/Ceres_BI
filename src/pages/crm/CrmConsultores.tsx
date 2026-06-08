import { useComercialDataContext } from '@/contexts/ComercialDataContext';
import { DashboardConsultores } from '@/components/dashboard/DashboardConsultores';

export default function CrmConsultores() {
  const { data, filters, handleSelectConsultor } = useComercialDataContext();

  return (
    <DashboardConsultores
      data={data}
      filters={filters}
      onSelectConsultor={handleSelectConsultor}
    />
  );
}
