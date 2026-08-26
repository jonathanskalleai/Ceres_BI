import { memo, useMemo } from "react";
import { Package, MapPin, Users, Flame } from "lucide-react";
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
    const map = new Map<
      string,
      {
        valor: number;
        count: number;
        quentes: number;
        etapas: { oport: number; cot: number; prop: number };
      }
    >();
    let totalValor = 0;
    let totalQtd = 0;

    for (const n of negocios ?? []) {
      const grupo = (n.grupo_produto && n.grupo_produto.trim()) || (n.marca && n.marca.trim()) || "Outros";
      const valor = Number(n.valor || 0);
      totalValor += valor;
      totalQtd += 1;

      if (!map.has(grupo)) {
        map.set(grupo, {
          valor: 0,
          count: 0,
          quentes: 0,
          etapas: { oport: 0, cot: 0, prop: 0 },
        });
      }
      const item = map.get(grupo)!;
      item.valor += valor;
      item.count += 1;
      if (Number(n.estrelas || 0) >= 4) item.quentes += 1;

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
        quentes: d.quentes,
        ticketMedio: d.count > 0 ? d.valor / d.count : 0,
        pct: totalValor > 0 ? (d.valor / totalValor) * 100 : 0,
        etapas: d.etapas,
      }))
      .sort((a, b) => b.valor - a.valor);

    return { list, totalValor, totalQtd };
  }, [negocios]);

  // Agrupamento por Cidade
  const porCidade = useMemo(() => {
    const map = new Map<
      string,
      {
        valor: number;
        count: number;
        uf: string;
        clientes: Set<string>;
      }
    >();
    let totalValor = 0;
    let totalQtd = 0;

    for (const n of negocios ?? []) {
      const cidade = (n.cidade && n.cidade.trim()) || "Não informada";
      const uf = n.uf || "";
      const valor = Number(n.valor || 0);
      const cliente = n.cliente || "Cliente";
      totalValor += valor;
      totalQtd += 1;

      if (!map.has(cidade)) {
        map.set(cidade, {
          valor: 0,
          count: 0,
          uf,
          clientes: new Set<string>(),
        });
      }
      const item = map.get(cidade)!;
      item.valor += valor;
      item.count += 1;
      item.clientes.add(cliente);
    }

    const list = Array.from(map.entries())
      .map(([cidade, d]) => ({
        cidade,
        uf: d.uf,
        valor: d.valor,
        count: d.count,
        clientesCount: d.clientes.size,
        ticketMedio: d.count > 0 ? d.valor / d.count : 0,
        pct: totalValor > 0 ? (d.valor / totalValor) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor);

    return { list, totalValor, totalQtd };
  }, [negocios]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Skeleton className="h-[420px] rounded-2xl" />
        <Skeleton className="h-[420px] rounded-2xl" />
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
        className="rounded-2xl border p-5 flex flex-col justify-between h-[420px]"
        style={{
          background: "var(--surface-raised)",
          borderColor: "var(--voux-card-border)",
          boxShadow: "var(--voux-card-shadow)",
        }}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b shrink-0" style={{ borderColor: "var(--voux-card-border)" }}>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Package className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                  Pipeline por Grupo de Produto
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Volume financeiro, ticket médio e concentração no funil
                </p>
              </div>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-background border text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
              {porProduto.list.length} grupos
            </span>
          </div>

          {/* Tabela com Rolagem Interna caso exceda */}
          <div className="flex-1 overflow-y-auto overflow-x-auto pr-1">
            <Table>
              <TableHeader className="sticky top-0 bg-[var(--surface-raised)] z-10">
                <TableRow className="border-[var(--voux-card-border)] hover:bg-transparent">
                  <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-7 font-mono">#</TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">Grupo de Produto</TableHead>
                  <TableHead className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono w-12">Qtd</TableHead>
                  <TableHead className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">Ticket Médio</TableHead>
                  <TableHead className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">Valor Total</TableHead>
                  <TableHead className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono w-24">% Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porProduto.list.map((item, idx) => (
                  <TableRow key={item.grupo} className="border-[var(--voux-card-border)] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <TableCell className="text-[11px] font-mono font-bold text-amber-500 py-2.5">{idx + 1}</TableCell>
                    <TableCell className="text-[12px] font-medium text-foreground py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold truncate max-w-[170px]" title={item.grupo}>{item.grupo}</span>
                        {item.quentes > 0 && (
                          <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" title={`${item.quentes} oportunidades quentes (4★ ou 5★)`}>
                            <Flame className="h-2.5 w-2.5 text-amber-500" />
                            {item.quentes}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center tabular-nums text-[12px] font-mono text-foreground font-semibold py-2.5">
                      {item.count}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-[11px] font-mono text-muted-foreground py-2.5">
                      {formatBRL(item.ticketMedio)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-[12px] font-mono font-bold text-foreground py-2.5">
                      {formatBRL(item.valor)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-[11px] font-mono text-muted-foreground py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="font-bold text-foreground">{formatPct(item.pct)}</span>
                        <div className="w-10 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden shrink-0">
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

        {/* Footer Totalizador Fixo na Base */}
        <div className="pt-2.5 mt-2 border-t flex items-center justify-between text-[11px] font-mono shrink-0" style={{ borderColor: "var(--voux-card-border)" }}>
          <span className="text-muted-foreground">
            {porProduto.totalQtd} oportunidades · Total por Produto:
          </span>
          <span className="font-bold text-foreground text-xs">{formatBRL(porProduto.totalValor)}</span>
        </div>
      </div>

      {/* Card 2: Tabela de Pipeline por Cidade / Região */}
      <div
        className="rounded-2xl border p-5 flex flex-col justify-between h-[420px]"
        style={{
          background: "var(--surface-raised)",
          borderColor: "var(--voux-card-border)",
          boxShadow: "var(--voux-card-shadow)",
        }}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b shrink-0" style={{ borderColor: "var(--voux-card-border)" }}>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500 border border-sky-500/20">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                  Pipeline por Cidade & Região
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Concentração geográfica, clientes e ticket médio por praça
                </p>
              </div>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-background border text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
              {porCidade.list.length} cidades
            </span>
          </div>

          {/* Tabela com Rolagem Interna caso exceda */}
          <div className="flex-1 overflow-y-auto overflow-x-auto pr-1">
            <Table>
              <TableHeader className="sticky top-0 bg-[var(--surface-raised)] z-10">
                <TableRow className="border-[var(--voux-card-border)] hover:bg-transparent">
                  <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider w-7 font-mono">#</TableHead>
                  <TableHead className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">Cidade / Praça</TableHead>
                  <TableHead className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono w-14">Clientes</TableHead>
                  <TableHead className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono w-12">Qtd</TableHead>
                  <TableHead className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">Ticket Médio</TableHead>
                  <TableHead className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">Valor Total</TableHead>
                  <TableHead className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono w-24">% Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porCidade.list.map((item, idx) => (
                  <TableRow key={item.cidade} className="border-[var(--voux-card-border)] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                    <TableCell className="text-[11px] font-mono font-bold text-sky-500 py-2.5">{idx + 1}</TableCell>
                    <TableCell className="text-[12px] font-medium text-foreground py-2.5">
                      <span className="font-bold block truncate max-w-[150px]" title={item.cidade}>{item.cidade}</span>
                      {item.uf && (
                        <span className="text-[10px] font-mono text-muted-foreground">Estado: {item.uf}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center tabular-nums text-[11px] font-mono text-muted-foreground py-2.5">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                        {item.clientesCount}
                      </span>
                    </TableCell>
                    <TableCell className="text-center tabular-nums text-[12px] font-mono text-foreground font-semibold py-2.5">
                      {item.count}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-[11px] font-mono text-muted-foreground py-2.5">
                      {formatBRL(item.ticketMedio)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-[12px] font-mono font-bold text-foreground py-2.5">
                      {formatBRL(item.valor)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-[11px] font-mono text-muted-foreground py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="font-bold text-foreground">{formatPct(item.pct)}</span>
                        <div className="w-10 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden shrink-0">
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

        {/* Footer Totalizador Fixo na Base */}
        <div className="pt-2.5 mt-2 border-t flex items-center justify-between text-[11px] font-mono shrink-0" style={{ borderColor: "var(--voux-card-border)" }}>
          <span className="text-muted-foreground">
            {porCidade.totalQtd} oportunidades · Total por Cidade:
          </span>
          <span className="font-bold text-foreground text-xs">{formatBRL(porCidade.totalValor)}</span>
        </div>
      </div>
    </div>
  );
});
