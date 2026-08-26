import { memo, useMemo } from "react";
import { Package, MapPin, Layers, DollarSign, TrendingUp } from "lucide-react";
import { useConsultorNegociosPipeline } from "@/hooks/useConsultoresRpc";
import { Skeleton } from "@/components/ui/skeleton";
import { VouxBarH } from "@/components/charts/voux/VouxBarH";
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

  const chartDataProdutos = porProduto.list.slice(0, 6).map((p) => ({
    label: p.grupo,
    value: p.valor,
  }));

  const chartDataCidades = porCidade.list.slice(0, 6).map((c) => ({
    label: c.cidade,
    value: c.valor,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
      {/* Card 1: Pipeline por Grupo de Produto */}
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
          <div className="flex items-center justify-between gap-2 mb-3.5 pb-2.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                <Package className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                  Pipeline por Grupo de Produto
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Concentração de valor e máquinas em aberto no funil
                </p>
              </div>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-background border text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
              {porProduto.list.length} grupos
            </span>
          </div>

          {/* Gráfico de Barras Voux */}
          <div className="mb-4">
            <VouxBarH
              data={chartDataProdutos}
              color="#f59e0b"
              valueFormatter={formatBRL}
            />
          </div>

          {/* Lista Detalhada das Principais Categorias */}
          <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
            {porProduto.list.slice(0, 4).map((p) => (
              <div
                key={p.grupo}
                className="flex items-center justify-between p-2 rounded-lg bg-black/[0.015] dark:bg-white/[0.015] border text-xs"
                style={{ borderColor: "var(--voux-card-border)" }}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-foreground truncate">{p.grupo}</span>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      ({p.count} {p.count === 1 ? "negócio" : "negócios"})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground mt-0.5">
                    {p.etapas.oport > 0 && <span>Oport: {formatBRL(p.etapas.oport)}</span>}
                    {p.etapas.cot > 0 && <span>· Cotaç: {formatBRL(p.etapas.cot)}</span>}
                    {p.etapas.prop > 0 && <span className="text-purple-500">· Prop: {formatBRL(p.etapas.prop)}</span>}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono font-bold text-foreground block">{formatBRL(p.valor)}</span>
                  <span className="text-[10px] font-mono text-amber-500 font-semibold">{formatPct(p.pct)} do total</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totalizador */}
        <div className="pt-3 mt-3 border-t flex items-center justify-between text-[11px] font-mono" style={{ borderColor: "var(--voux-card-border)" }}>
          <span className="text-muted-foreground">Total Negociado por Produto:</span>
          <span className="font-bold text-foreground text-xs">{formatBRL(porProduto.totalValor)}</span>
        </div>
      </div>

      {/* Card 2: Pipeline por Cidade / Região */}
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
          <div className="flex items-center justify-between gap-2 mb-3.5 pb-2.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-500 border border-sky-500/20">
                <MapPin className="h-4 w-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                  Pipeline por Cidade & Região
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Distribuição geográfica das oportunidades abertas
                </p>
              </div>
            </div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-background border text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
              {porCidade.list.length} cidades
            </span>
          </div>

          {/* Gráfico de Barras Voux */}
          <div className="mb-4">
            <VouxBarH
              data={chartDataCidades}
              color="#0ea5e9"
              valueFormatter={formatBRL}
            />
          </div>

          {/* Lista Detalhada das Principais Cidades */}
          <div className="space-y-2 pt-2 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
            {porCidade.list.slice(0, 4).map((c) => (
              <div
                key={c.cidade}
                className="flex items-center justify-between p-2 rounded-lg bg-black/[0.015] dark:bg-white/[0.015] border text-xs"
                style={{ borderColor: "var(--voux-card-border)" }}
              >
                <div className="min-w-0 flex-1 pr-2">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-foreground truncate">{c.cidade}</span>
                    {c.uf && <span className="text-[10px] font-mono text-muted-foreground">({c.uf})</span>}
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground block">
                    {c.count} {c.count === 1 ? "oportunidade ativa" : "oportunidades ativas"}
                  </span>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-mono font-bold text-foreground block">{formatBRL(c.valor)}</span>
                  <span className="text-[10px] font-mono text-sky-500 font-semibold">{formatPct(c.pct)} do total</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totalizador */}
        <div className="pt-3 mt-3 border-t flex items-center justify-between text-[11px] font-mono" style={{ borderColor: "var(--voux-card-border)" }}>
          <span className="text-muted-foreground">Total Negociado por Cidade:</span>
          <span className="font-bold text-foreground text-xs">{formatBRL(porCidade.totalValor)}</span>
        </div>
      </div>
    </div>
  );
});
