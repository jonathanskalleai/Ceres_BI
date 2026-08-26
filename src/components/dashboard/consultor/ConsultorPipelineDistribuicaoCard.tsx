import { memo, useMemo } from "react";
import { Package, MapPin } from "lucide-react";
import { useConsultorNegociosPipeline } from "@/hooks/useConsultoresRpc";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface Props {
  consultor: string;
}

const BRL_EXACT = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PCT_EXACT = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatBRL(value: number | null | undefined): string {
  if (value == null) return "R$ 0,00";
  return BRL_EXACT.format(Number(value));
}

function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "0,0%";
  return `${PCT_EXACT.format(Number(value))}%`;
}

export const ConsultorPipelineDistribuicaoCard = memo(function ConsultorPipelineDistribuicaoCard({
  consultor,
}: Props) {
  const { data: negocios, isLoading } = useConsultorNegociosPipeline({
    consultor,
    enabled: !!consultor,
  });

  // Agrupamento por Grupo de Produto
  const porProduto = useMemo(() => {
    const map = new Map<string, { valor: number; count: number; etapas: { oport: number; cot: number; prop: number } }>();
    let totalValor = 0;

    for (const n of negocios ?? []) {
      const grupo = (n.grupo_produto && n.grupo_produto.trim()) || (n.marca && n.marca.trim()) || "Outros";
      const valor = Number(n.valor || 0);
      totalValor += valor;

      if (!map.has(grupo)) {
        map.set(grupo, { valor: 0, count: 0, etapas: { oport: 0, cot: 0, prop: 0 } });
      }
      const item = map.get(grupo)!;
      item.valor += valor;
      item.count += 1;

      const u = (n.etapa || "").toUpperCase();
      if (u.includes("1-") || u.includes("OPORTUNIDADE")) item.etapas.oport += valor;
      else if (u.includes("2-") || u.includes("COTACAO") || u.includes("COTAÇÃO")) item.etapas.cot += valor;
      else if (u.includes("3-") || u.includes("PROPOSTA")) item.etapas.prop += valor;
    }

    const list = Array.from(map.entries())
      .map(([grupo, d]) => ({
        grupo,
        valor: d.valor,
        count: d.count,
        pct: totalValor > 0 ? (d.valor / totalValor) * 100 : 0,
        etapas: d.etapas,
      }))
      .sort((a, b) => b.valor - a.valor);

    return { list, totalValor };
  }, [negocios]);

  // Agrupamento por Cidade
  const porCidade = useMemo(() => {
    const map = new Map<string, { valor: number; count: number; uf: string }>();
    let totalValor = 0;

    for (const n of negocios ?? []) {
      const cidade = (n.cidade && n.cidade.trim()) || "Não informada";
      const uf = n.uf || "";
      const valor = Number(n.valor || 0);
      totalValor += valor;

      if (!map.has(cidade)) {
        map.set(cidade, { valor: 0, count: 0, uf });
      }
      const item = map.get(cidade)!;
      item.valor += valor;
      item.count += 1;
    }

    const list = Array.from(map.entries())
      .map(([cidade, d]) => ({
        cidade,
        uf: d.uf,
        valor: d.valor,
        count: d.count,
        pct: totalValor > 0 ? (d.valor / totalValor) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor);

    return { list, totalValor };
  }, [negocios]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!negocios || negocios.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
      {/* Card 1: Tabela de Pipeline por Grupo de Produto */}
      <div
        className="rounded-2xl border p-5 flex flex-col justify-between"
        style={{
          background: "var(--surface-raised)",
          borderColor: "var(--voux-card-border)",
          boxShadow: "var(--voux-card-shadow)",
        }}
      >
        <div>
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Package className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                  Pipeline por Grupo de Produto
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Volume negociado e quantidade de oportunidades em aberto
                </p>
              </div>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-background border text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
              {porProduto.list.length} grupos
            </span>
          </div>

          {/* Tabela de Produtos */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--voux-card-border)] hover:bg-transparent">
                  <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-8 font-mono">#</TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">Grupo de Produto</TableHead>
                  <TableHead className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono w-16">Qtd</TableHead>
                  <TableHead className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">Valor Total</TableHead>
                  <TableHead className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono w-28">% Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porProduto.list.map((item, idx) => (
                  <TableRow key={item.grupo} className="border-[var(--voux-card-border)] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <TableCell className="text-[11px] font-mono font-bold text-amber-500 py-2.5">{idx + 1}</TableCell>
                    <TableCell className="text-[12px] font-medium text-foreground py-2.5">
                      <span className="font-bold block truncate max-w-[200px]" title={item.grupo}>{item.grupo}</span>
                    </TableCell>
                    <TableCell className="text-center tabular-nums text-[12px] font-mono text-foreground font-semibold py-2.5">
                      {item.count}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-[12px] font-mono font-bold text-foreground py-2.5">
                      {formatBRL(item.valor)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-[11px] font-mono text-muted-foreground py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-bold text-foreground">{formatPct(item.pct)}</span>
                        <div className="w-12 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden shrink-0">
                          <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(item.pct, 100)}%` }} />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Footer Totalizador */}
        <div className="pt-3 mt-3 border-t flex items-center justify-between text-[11px] font-mono" style={{ borderColor: "var(--voux-card-border)" }}>
          <span className="text-muted-foreground">Total Negociado por Produto:</span>
          <span className="font-bold text-foreground text-xs">{formatBRL(porProduto.totalValor)}</span>
        </div>
      </div>

      {/* Card 2: Tabela de Pipeline por Cidade / Região */}
      <div
        className="rounded-2xl border p-5 flex flex-col justify-between"
        style={{
          background: "var(--surface-raised)",
          borderColor: "var(--voux-card-border)",
          boxShadow: "var(--voux-card-shadow)",
        }}
      >
        <div>
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500 border border-sky-500/20">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                  Pipeline por Cidade & Região
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Concentração geográfica das oportunidades ativas
                </p>
              </div>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-background border text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
              {porCidade.list.length} cidades
            </span>
          </div>

          {/* Tabela de Cidades */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--voux-card-border)] hover:bg-transparent">
                  <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-8 font-mono">#</TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">Cidade / Praça</TableHead>
                  <TableHead className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono w-16">Qtd</TableHead>
                  <TableHead className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">Valor Total</TableHead>
                  <TableHead className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono w-28">% Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porCidade.list.map((item, idx) => (
                  <TableRow key={item.cidade} className="border-[var(--voux-card-border)] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <TableCell className="text-[11px] font-mono font-bold text-sky-500 py-2.5">{idx + 1}</TableCell>
                    <TableCell className="text-[12px] font-medium text-foreground py-2.5">
                      <span className="font-bold block truncate max-w-[200px]" title={item.cidade}>{item.cidade}</span>
                      {item.uf && (
                        <span className="text-[10px] font-mono text-muted-foreground">Estado: {item.uf}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center tabular-nums text-[12px] font-mono text-foreground font-semibold py-2.5">
                      {item.count}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-[12px] font-mono font-bold text-foreground py-2.5">
                      {formatBRL(item.valor)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-[11px] font-mono text-muted-foreground py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-bold text-foreground">{formatPct(item.pct)}</span>
                        <div className="w-12 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden shrink-0">
                          <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.min(item.pct, 100)}%` }} />
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Footer Totalizador */}
        <div className="pt-3 mt-3 border-t flex items-center justify-between text-[11px] font-mono" style={{ borderColor: "var(--voux-card-border)" }}>
          <span className="text-muted-foreground">Total Negociado por Cidade:</span>
          <span className="font-bold text-foreground text-xs">{formatBRL(porCidade.totalValor)}</span>
        </div>
      </div>
    </div>
  );
});
