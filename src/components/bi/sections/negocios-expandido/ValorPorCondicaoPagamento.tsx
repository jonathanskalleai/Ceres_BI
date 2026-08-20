import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartCard } from "@/components/bi/ChartCard";
import { HorizontalBarChart, type BarChartData } from "@/components/bi/charts";
import { fmtBRLKpi, fmtPct } from "@/lib/formatters";
import { fmtNum } from "@/lib/formatters";
import type { ValorPorCondicaoPagamentoItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: ValorPorCondicaoPagamentoItem[];
  loading?: boolean;
}

const SEQUENTIAL_AMBER = [
  "#8c5e1a", "#a67322", "#bf8a2e", "#d4a05a",
  "#e0b574", "#ebc98e", "#f2dba8", "#f8edc3",
];

export function ValorPorCondicaoPagamento({ data, loading }: Props) {
  const chartData: BarChartData[] = data.map((item) => ({
    name: item.condicao,
    valor_total: item.valor_total,
    ticket_medio: item.ticket_medio,
  }));

  const chartH = Math.min(400, Math.max(200, data.length * 40 + 40));

  return (
    <ChartCard
      title="Valor por Condição de Pagamento"
      description="Valor total, ticket médio e taxa de conversão por condição (Recurso Próprio, Financiado, etc.)."
      loading={loading}
      height={chartH + 120}
      footer={
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--voux-card-border)]">
              <TableHead className="text-[10px] font-semibold text-[var(--voux-text-muted)] uppercase tracking-wider">Condição</TableHead>
              <TableHead className="text-right text-[10px] font-semibold text-[var(--voux-text-muted)] uppercase tracking-wider">Negócios</TableHead>
              <TableHead className="text-right text-[10px] font-semibold text-[var(--voux-text-muted)] uppercase tracking-wider">Ticket Médio</TableHead>
              <TableHead className="text-right text-[10px] font-semibold text-[var(--voux-text-muted)] uppercase tracking-wider">Taxa Conv.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.slice(0, 6).map((item) => (
              <TableRow key={item.condicao} className="border-[var(--voux-card-border)]">
                <TableCell className="text-[12px] font-medium text-[var(--voux-text-primary)]">{item.condicao}</TableCell>
                <TableCell className="text-right tabular-nums text-[12px] text-[var(--voux-text-secondary)]">{fmtNum(item.negocios)}</TableCell>
                <TableCell className="text-right tabular-nums text-[12px] font-semibold text-[var(--voux-text-primary)]">{fmtBRLKpi(item.ticket_medio)}</TableCell>
                <TableCell className="text-right tabular-nums text-[12px] text-[var(--voux-text-secondary)]">{fmtPct(item.taxa_conversao)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    >
      <HorizontalBarChart
        data={chartData}
        keys={["valor_total"]}
        height={chartH}
        itemColors={SEQUENTIAL_AMBER}
        tooltipFormatter={(v) => fmtBRLKpi(v)}
        tooltipContentFormatter={(datum, _value, _keyLabel) => {
          const item = data.find((d) => d.condicao === datum.name);
          if (!item) return "";
          return `<div>
            <div style="font-weight:600;margin-bottom:4px">${datum.name}</div>
            <div style="color:var(--voux-tooltip-muted)">Valor total: <strong style="color:var(--voux-tooltip-text)">${fmtBRLKpi(item.valor_total)}</strong></div>
            <div style="color:var(--voux-tooltip-muted)">Ticket médio: <strong style="color:var(--voux-tooltip-text)">${fmtBRLKpi(item.ticket_medio)}</strong></div>
            <div style="color:var(--voux-tooltip-muted)">Taxa conv.: <strong style="color:var(--voux-tooltip-text)">${fmtPct(item.taxa_conversao)}</strong></div>
          </div>`;
        }}
      />
    </ChartCard>
  );
}
