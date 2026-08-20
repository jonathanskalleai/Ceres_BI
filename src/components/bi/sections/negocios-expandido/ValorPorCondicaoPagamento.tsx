import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartCard } from "@/components/bi/ChartCard";
import { VouxBarH } from "@/components/charts/voux";
import { fmtBRLKpi, fmtPct } from "@/lib/formatters";
import { fmtNum } from "@/lib/formatters";
import type { ValorPorCondicaoPagamentoItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: ValorPorCondicaoPagamentoItem[];
  loading?: boolean;
}

const PALETTE = ['#e06060', '#c97565', '#d4a05a', '#5ba3d9', '#1a8c3a', '#4caf7a', '#7a9b6f', '#8ea3b8'];

export function ValorPorCondicaoPagamento({ data, loading }: Props) {
  return (
    <ChartCard
      title="Valor por Condição de Pagamento"
      description="Valor total, ticket médio e taxa de conversão."
      loading={loading}
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
      <VouxBarH
        data={data.map((d, i) => ({ label: d.condicao, value: d.valor_total, color: PALETTE[i % PALETTE.length] }))}
        color="#d4a05a"
        valueFormatter={fmtBRLKpi}
      />
    </ChartCard>
  );
}
