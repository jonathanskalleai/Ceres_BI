import { useParams, useNavigate } from 'react-router-dom';
import { useComercialDataContext } from '@/contexts/ComercialDataContext';
import { DashboardConsultorDetail } from '@/components/dashboard/DashboardConsultorDetail';

export default function CrmConsultorDetail() {
  const { vendedor: vendedorParam } = useParams<{ vendedor: string }>();
  const navigate = useNavigate();
  const { data } = useComercialDataContext();

  const vendedor = data.vendedores.find(
    (v) => v.nome === decodeURIComponent(vendedorParam || ''),
  );

  if (!vendedor) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-muted-foreground">Consultor nao encontrado.</p>
      </div>
    );
  }

  return (
    <DashboardConsultorDetail
      vendedor={vendedor}
      registros={data.registrosRecentes}
      onBack={() => navigate('/crm/consultores')}
    />
  );
}
