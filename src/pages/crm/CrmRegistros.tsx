import { useComercialDataContext } from '@/contexts/ComercialDataContext';
import { DashboardRegistros } from '@/components/dashboard/DashboardRegistros';

export default function CrmRegistros() {
  // Usa allData (sem filtro de admin users) — a tabela de registros deve mostrar TODAS as ações,
  // incluindo usuários administrativos como DANIEL CESAR CANOTH.
  // O filtro admin (isAdminUser) é aplicado apenas em KPIs e gráficos de performance.
  const { data, allData, filters } = useComercialDataContext();

  return <DashboardRegistros data={allData ?? data} filters={filters} />;
}
