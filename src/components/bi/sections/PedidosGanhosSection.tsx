import { useState } from "react";
import { DollarSign, ShoppingCart, TrendingUp } from "lucide-react";
import { type DateRange } from "react-day-picker";

import { AcoesPedidosTable } from "@/components/bi/AcoesPedidosTable";
import { KPICard } from "@/components/bi/KPICard";
import { useAcoesBIRpc } from "@/hooks/bi/useAcoesBIRpc";
import { usePedidosGanhosRpc } from "@/hooks/bi/usePedidosGanhosRpc";
import { toISODate } from "@/lib/dateUtils";
import { fmtBRLKpi } from "@/lib/formatters";
import type { AcoesBIKpis } from "@/types/biRpc";

interface Props {
  active: boolean;
  dateRange?: DateRange;
  vendedor?: string;
  cidade?: string;
}

const EMPTY_KPIS: AcoesBIKpis = {
  totalAcoes: 0,
  cidades: 0,
  consultores: 0,
  visitas: 0,
  clientes: 0,
  tiposAcaoDistintos: 0,
  valorGanho: 0,
  negociosGanho: 0,
  valorPerdido: 0,
  negociosPerdido: 0,
  negociosOutrosStatus: 0,
  tempoMedioContato: 0,
};

/** Pedidos aprovados que sustentam o card de ganho da composição comercial. */
export default function PedidosGanhosSection({ active, dateRange, vendedor, cidade }: Props) {
  const [page, setPage] = useState(1);
  const from = toISODate(dateRange?.from);
  const to = toISODate(dateRange?.to ?? dateRange?.from);
  const enabled = active && !!from && !!to;

  const { data: acoesData, isLoading: kpisLoading } = useAcoesBIRpc({
    from,
    to,
    vendedor,
    cidade,
    enabled,
  });
  const { data: pedidosData, isLoading: pedidosLoading, error: pedidosError } = usePedidosGanhosRpc({
    from,
    to,
    vendedor,
    cidade,
    page,
    enabled,
  });

  const kpis = acoesData?.kpis ?? EMPTY_KPIS;
  const ticketMedio = kpis.negociosGanho > 0 ? kpis.valorGanho / kpis.negociosGanho : 0;

  return (
    <div className="space-y-6 pt-4">
      <p className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
        <strong className="text-foreground">Pedidos comerciais válidos:</strong>{" "}
        somente pedidos aprovados na data de aprovação, ligados a negócio Ganho e sem Repasse de Máquina.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KPICard
          title="Pedidos Aprovados"
          value={kpis.negociosGanho.toLocaleString("pt-BR")}
          icon={ShoppingCart}
          loading={kpisLoading}
          hint="pedidos únicos no período"
          dataSource="crm_pedidos deduplicado por pdo_codigointerno · Aprovado por pdo_dthaprovacao · sem REPASSE DE MAQUINA"
        />
        <KPICard
          title="Faturamento Aprovado"
          value={fmtBRLKpi(kpis.valorGanho)}
          icon={DollarSign}
          loading={kpisLoading}
          hint="valor dos pedidos aprovados"
          dataSource="SUM(pdo_vlrpedido) dos pedidos aprovados válidos"
        />
        <KPICard
          title="Ticket Médio"
          value={fmtBRLKpi(ticketMedio)}
          icon={TrendingUp}
          loading={kpisLoading}
          hint="por pedido aprovado"
          dataSource="faturamento aprovado / pedidos aprovados"
        />
      </div>

      <AcoesPedidosTable
        rows={pedidosData?.rows ?? []}
        total={pedidosData?.total ?? 0}
        page={page}
        onPageChange={setPage}
        loading={pedidosLoading}
        error={pedidosError}
      />
    </div>
  );
}
