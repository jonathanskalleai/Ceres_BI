import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartCard } from "@/components/bi/ChartCard";
import { fmtBRLKpi } from "@/lib/formatters";
import { fmtNum } from "@/lib/formatters";
import type { RankingProdutosReceitaGanhaItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: RankingProdutosReceitaGanhaItem[];
  loading?: boolean;
}

export function RankingProdutosReceitaGanha({ data, loading }: Props) {
  return (
    <ChartCard
      title="Ranking de Produtos por Receita Ganha"
      description="TOP 10 produtos com maior valor ganho no período."
      loading={loading}
      height={Math.min(500, Math.max(260, data.length * 56 + 20))}
    >
      <Table>
        <TableHeader>
          <TableRow className="border-[var(--voux-card-border)]">
            <TableHead className="text-[10px] font-semibold text-[var(--voux-text-muted)] uppercase tracking-wider w-8">#</TableHead>
            <TableHead className="text-[10px] font-semibold text-[var(--voux-text-muted)] uppercase tracking-wider">Produto</TableHead>
            <TableHead className="text-[10px] font-semibold text-[var(--voux-text-muted)] uppercase tracking-wider hidden md:table-cell">Grupo</TableHead>
            <TableHead className="text-right text-[10px] font-semibold text-[var(--voux-text-muted)] uppercase tracking-wider">Neg.</TableHead>
            <TableHead className="text-right text-[10px] font-semibold text-[var(--voux-text-muted)] uppercase tracking-wider hidden sm:table-cell">Ganhos</TableHead>
            <TableHead className="text-right text-[10px] font-semibold text-[var(--voux-text-muted)] uppercase tracking-wider">Valor Ganho</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, idx) => (
            <TableRow key={item.produto} className="border-[var(--voux-card-border)] hover:bg-[var(--voux-card-border)]/40 transition-colors">
              <TableCell className="text-[11px] font-mono text-[var(--voux-text-muted)]">{idx + 1}</TableCell>
              <TableCell className="text-[12px] font-medium text-[var(--voux-text-primary)]">
                <div title={item.produto} className="truncate max-w-[200px]">{item.produto}</div>
                <div className="text-[10px] text-[var(--voux-text-muted)]">{item.marca}</div>
              </TableCell>
              <TableCell className="text-[11px] text-[var(--voux-text-secondary)] hidden md:table-cell">{item.grupo}</TableCell>
              <TableCell className="text-right tabular-nums text-[12px] text-[var(--voux-text-secondary)]">{fmtNum(item.negocios)}</TableCell>
              <TableCell className="text-right tabular-nums text-[12px] text-[var(--voux-text-secondary)] hidden sm:table-cell">{fmtNum(item.ganhos)}</TableCell>
              <TableCell className="text-right tabular-nums text-[12px] font-semibold text-[var(--voux-text-primary)]">{fmtBRLKpi(item.valor_ganho)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ChartCard>
  );
}
