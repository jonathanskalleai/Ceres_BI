import { ChartCard } from "@/components/bi/ChartCard";
import { VouxBarH } from "@/components/charts/voux";
import { fmtBRLKpi } from "@/lib/formatters";
import { fmtNum } from "@/lib/formatters";
import type { VolumePorTipoClienteItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: VolumePorTipoClienteItem[];
  loading?: boolean;
}

export function VolumePorTipoCliente({ data, loading }: Props) {
  return (
    <ChartCard
      title="Volume por Tipo de Cliente (PF vs. PJ)"
      description="Pessoa Física vs. Jurídica: volume total, valor ganho e ticket médio."
      loading={loading}
      footer={
        <div className="space-y-1">
          {data.map((item) => (
            <div key={item.tipo} className="flex justify-between text-[11px] font-mono">
              <span className="text-[var(--voux-text-muted)]">{item.tipo}</span>
              <div className="flex gap-4">
                <span>
                  {fmtNum(item.negocios)} neg /{" "}
                  <strong className="text-[var(--voux-text-primary)]">{fmtNum(item.ganhos)}</strong> ganhos
                </span>
                <span className="text-[var(--voux-text-secondary)]">
                  Ticket: <strong className="text-[var(--voux-text-primary)]">{fmtBRLKpi(item.ticket_medio_ganho ?? 0)}</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      }
    >
      <VouxBarH
        data={data.map((d) => ({ label: d.tipo, value: d.valor_total }))}
        color="#5ba3d9"
        valueFormatter={fmtBRLKpi}
      />
    </ChartCard>
  );
}
