import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartCard } from "@/components/bi/ChartCard";
import { fmtBRLKpi } from "@/lib/formatters";
import { fmtNum } from "@/lib/formatters";
import type { PalavrasChaveObservacaoItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: PalavrasChaveObservacaoItem[];
  loading?: boolean;
}

export function PalavrasChaveObservacao({ data, loading }: Props) {
  const maxFreq = Math.max(...data.map((d) => d.freq), 1);

  return (
    <ChartCard
      title="Termos Mais Frequentes nas Observações"
      description="Keywords extraídas de ngo_obsnegocio. Stop-words PT-BR filtradas. Tamanho = frequência."
      loading={loading}
      height={Math.min(500, Math.max(280, data.length * 52 + 20))}
    >
      <div className="space-y-2 overflow-y-auto pr-1">
        {data.map((item) => {
          const size = 9 + (item.freq / maxFreq) * 10;
          return (
            <div
              key={item.termo}
              className="flex items-baseline justify-between gap-3"
            >
              <span
                className="font-medium leading-none"
                style={{
                  fontSize: size,
                  color: item.freq / maxFreq > 0.5 ? "var(--voux-text-primary)" : "var(--voux-text-secondary)",
                }}
                title={`Frequência: ${item.freq} | Valor total: ${fmtBRLKpi(item.valor)}`}
              >
                {item.termo}
              </span>
              <div className="flex shrink-0 gap-4 text-[11px] font-mono tabular-nums">
                <span className="text-[var(--voux-text-muted)]">{fmtNum(item.freq)}x</span>
                <span className="text-[var(--voux-text-secondary)]">{fmtBRLKpi(item.valor)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </ChartCard>
  );
}
