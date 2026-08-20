import { ChartCard } from "@/components/bi/ChartCard";
import { VouxBarH } from "@/components/charts/voux";
import { fmtBRLKpi } from "@/lib/formatters";
import type { TicketMedioPorFormaEntradaItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: TicketMedioPorFormaEntradaItem[];
  loading?: boolean;
}

export function TicketMedioPorFormaEntrada({ data, loading }: Props) {
  return (
    <ChartCard
      title="Ticket Médio por Forma de Entrada"
      description="Origem dos negócios ordenados por ticket médio. Ordenado por ticket_medio DESC."
      loading={loading}
      footer={
        <div className="text-[10px] text-[var(--voux-text-muted)] font-mono">
          Forma de entrada = como o negócio chegou (visita, campanha, telefone, etc.)
        </div>
      }
    >
      <VouxBarH
        data={data.map((d) => ({ label: d.forma, value: d.ticket_medio }))}
        color="#2970b3"
        valueFormatter={fmtBRLKpi}
      />
    </ChartCard>
  );
}
