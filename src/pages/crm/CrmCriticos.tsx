import { useMemo } from "react";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { useClientesCriticos } from "@/hooks/useClientesCriticos";
import type { RpcClienteCritico } from "@/hooks/useClientesCriticos";
import { DashboardClientesCriticos } from "@/components/dashboard/DashboardClientesCriticos";
import { Skeleton } from "@/components/ui/skeleton";

/** Threshold: clients with no contact beyond this many days are "critical" */
const DIAS_LIMITE = 90;

export interface ClienteCriticoView {
  nome: string;
  cidade: string;
  vendedor: string;
  diasSemContato: number;
  pipeline: number;
  totalAcoes: number;
  visitas: number;
  ultimaData: string;
  ultimaObs: string;
  ultimoTipoAcao: string;
}

function mapRpcToView(r: RpcClienteCritico): ClienteCriticoView {
  return {
    nome: r.cli_nome,
    cidade: r.emp_cidade ?? "",
    vendedor: r.aco_vendedor ?? "",
    diasSemContato: r.dias_sem_contato,
    pipeline: Number(r.pipeline) || 0,
    totalAcoes: Number(r.total_acoes) || 0,
    visitas: Number(r.total_visitas) || 0,
    ultimaData: r.ultima_acao_data ?? "—",
    ultimaObs: r.ultima_obs ?? "Sem observações registradas",
    ultimoTipoAcao: r.ultimo_tipo_acao ?? "—",
  };
}

export default function CrmCriticos() {
  const { cidade, tipoAcao } = useNegociosFilter();

  const { data: rpcData, isLoading } = useClientesCriticos({
    diasLimite: DIAS_LIMITE,
  });

  const criticos = useMemo(() => {
    if (!rpcData) return [];
    let items = rpcData.map(mapRpcToView);

    if (cidade) {
      items = items.filter((c) => c.cidade === cidade);
    }
    if (tipoAcao) {
      items = items.filter((c) => c.ultimoTipoAcao === tipoAcao);
    }

    return items.sort((a, b) => b.pipeline - a.pipeline || b.diasSemContato - a.diasSemContato);
  }, [rpcData, cidade, tipoAcao]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return <DashboardClientesCriticos criticos={criticos} />;
}
