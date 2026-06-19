import { useNavigate } from 'react-router-dom';
import { useComercialDataContext } from '@/contexts/ComercialDataContext';
import { DashboardConsultores } from '@/components/dashboard/DashboardConsultores';

export default function CrmConsultores() {
  const { data, filters } = useComercialDataContext();
  const navigate = useNavigate();

  return (
    <DashboardConsultores
      data={data}
      filters={filters}
      onSelectConsultor={(nome) => navigate(`/crm/consultores/${encodeURIComponent(nome)}`)}
    />
  );
}

