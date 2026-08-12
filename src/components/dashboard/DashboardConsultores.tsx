import { useMemo, useState } from "react";
import type { Vendedor, Registro, Filters } from "@/types/comercial";
import { Button } from "@/components/ui/button";
import { ArrowRight, Trophy, Sparkles, TrendingUp, Users, DollarSign, CalendarDays, Target } from "lucide-react";
import { filterRegistros, hasActiveFilters } from "@/lib/filterUtils";
import { ConsultorReportSheet } from "./ConsultorReportSheet";
import { RankingClientesNovos } from "./RankingClientesNovos";
import { ConsultoresValidationTable } from "./ConsultoresValidationTable";
import { cn } from "@/lib/utils";
import type { RpcConsultorResumoAcoes } from "@/types/consultoresRpc";
import { formatDateBR } from "@/lib/dateUtils";

interface DashboardConsultoresProps {
  vendedores: Vendedor[];
  registros: Registro[];
  filters: Filters;
  resumo: RpcConsultorResumoAcoes[];
  onSelectConsultor: (nome: string) => void;
}

const formatCurrency = (v: number) => {
  if (v >= 1e6) return `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
};

const CARD_BASE =
  "relative overflow-hidden rounded-[20px] p-[22px_24px] border";

function CrmBadge({ q }: { q: number }) {
  const grade = q >= 70 ? "A" : q >= 50 ? "B" : q >= 30 ? "C" : "D";
  const colors: Record<string, string> = {
    A: "border-[var(--voux-success)] text-[var(--voux-success)]",
    B: "border-[var(--voux-warning)] text-[var(--voux-warning)]",
    C: "border-[var(--voux-warning)] text-[var(--voux-warning)]",
    D: "border-[var(--voux-danger)] text-[var(--voux-danger)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-5 h-5 rounded-full border font-mono text-[10px] font-bold",
        colors[grade],
      )}
    >
      {grade}
    </span>
  );
}

export const DashboardConsultores = ({ vendedores, registros, filters, resumo, onSelectConsultor }: DashboardConsultoresProps) => {
  const isFiltered = hasActiveFilters(filters);
  const [sheetOpen, setSheetOpen] = useState(false);

  const vendedoresRanked = useMemo(() => {
    // Ranking comercial objetivo: valor vendido, visitas e acoes. Os valores
    // chegam agregados da RPC; nunca sao somados por acao no navegador.
    const resumoPorConsultor = new Map(resumo.map((item) => [item.consultor, item]));
    return [...vendedores].sort((a, b) => {
      const aResumo = resumoPorConsultor.get(a.nome);
      const bResumo = resumoPorConsultor.get(b.nome);
      return Number(bResumo?.valor_ganho ?? 0) - Number(aResumo?.valor_ganho ?? 0)
        || b.visitas - a.visitas
        || b.totalAcoes - a.totalAcoes
        || a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [vendedores, resumo]);

  const resumoPorConsultor = useMemo(
    () => new Map(resumo.map((item) => [item.consultor, item])),
    [resumo],
  );

  const periodoLabel = filters.dateRange
    ? `${formatDateBR(filters.dateRange.from)} a ${formatDateBR(filters.dateRange.to)}`
    : "Período selecionado";

  // Topo do ranking segue exatamente a mesma ordem comercial da tabela.
  const top5 = vendedoresRanked.slice(0, 5);
  const rankLabel = ["01", "02", "03", "04", "05"];

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho e contexto do calendário */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight" style={{ color: "var(--voux-text-primary)" }}>Desempenho dos consultores</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px]" style={{ color: "var(--voux-accent)", borderColor: "var(--voux-card-border)" }}>
              <CalendarDays className="h-3 w-3" />
              {periodoLabel}
            </span>
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--voux-text-faint)" }}>
            {vendedoresRanked.length} consultores exibidos · ranking por vendas, visitas e ações
          </p>
        </div>
        <Button
          onClick={() => setSheetOpen(true)}
          className="rounded-full shadow-md font-semibold text-sm px-5"
          style={{
            backgroundColor: "var(--voux-accent)",
            color: "var(--voux-card-to)",
          }}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Insights de IA
        </Button>
      </div>

      <ConsultorReportSheet open={sheetOpen} onOpenChange={setSheetOpen} vendedores={vendedores} />

      {/* Top 5 ranking */}
      {top5.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5" style={{ color: "var(--voux-accent)" }} />
            <span className="font-mono text-[10px] tracking-[0.22em] uppercase" style={{ color: "var(--voux-text-faint)" }}>
              Ranking comercial · vendas, visitas e ações
            </span>
          </div>
          <div
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
          >
            {top5.map((v, i) => (
              <button
                key={v.nome}
                onClick={() => onSelectConsultor(v.nome)}
                className={cn(CARD_BASE, "text-left transition-colors")}
                style={{
                  background: "linear-gradient(to bottom, var(--voux-card-from), var(--voux-card-to))",
                  borderColor: "var(--voux-card-border)",
                  boxShadow: "var(--voux-card-shadow)",
                  borderLeftColor: "var(--voux-accent)",
                  borderLeftWidth: 3,
                }}
              >
                {/* Eyebrow */}
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-[10px] tracking-[0.22em]" style={{ color: "var(--voux-accent)" }}>
                    {rankLabel[i]} ·
                  </span>
                  <Trophy className="h-3 w-3 opacity-30" style={{ color: "var(--voux-text-faint)" }} />
                </div>
                {/* Nome */}
                <p className="text-sm font-bold leading-tight tracking-[-0.02em] mb-2" style={{ color: "var(--voux-text-primary)" }}>
                  {v.nome}
                </p>
                {/* Hint */}
                <p className="font-mono text-[11px]" style={{ color: "var(--voux-text-faint)" }}>
                  {formatCurrency(Number(resumoPorConsultor.get(v.nome)?.valor_ganho ?? 0))} vendidos · {v.visitas} visitas · {v.totalAcoes} ações
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cards de consultores */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold" style={{ color: "var(--voux-text-primary)" }}>Todos os consultores</h3>
            <p className="text-xs" style={{ color: "var(--voux-text-faint)" }}>Vendas, pipeline, atividade e conversão no calendário selecionado.</p>
          </div>
        </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {vendedoresRanked.map((v) => (
          <div
            key={v.nome}
            className={cn(CARD_BASE, "cursor-pointer group transition-colors")}
            style={{
              background: "linear-gradient(to bottom, var(--voux-card-from), var(--voux-card-to))",
              borderColor: "var(--voux-card-border)",
              boxShadow: "var(--voux-card-shadow)",
            }}
            onClick={() => onSelectConsultor(v.nome)}
          >
            {/* Nome + badge */}
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-sm truncate flex-1" style={{ color: "var(--voux-text-primary)" }}>{v.nome}</h4>
              <CrmBadge q={v.crmQuality} />
            </div>

            {/* Resultado comercial: pipeline e vendas no topo; esforço e conversão abaixo. */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <DollarSign className="h-3 w-3" style={{ color: "var(--voux-text-faint)" }} />
                  <span className="font-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: "var(--voux-text-faint)" }}>Vendas</span>
                </div>
                <p className="text-[18px] font-bold leading-none" style={{ color: "var(--voux-accent)" }}>{formatCurrency(Number(resumoPorConsultor.get(v.nome)?.valor_ganho ?? 0))}</p>
                <span className="mt-1 block text-[10px] text-muted-foreground">{resumoPorConsultor.get(v.nome)?.ganhos ?? 0} pedidos aprovados</span>
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Target className="h-3 w-3" style={{ color: "var(--voux-text-faint)" }} />
                  <span className="font-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: "var(--voux-text-faint)" }}>Pipeline aberto</span>
                </div>
                <p className="text-[18px] font-bold leading-none" style={{ color: "var(--voux-text-primary)" }}>{formatCurrency(Number(resumoPorConsultor.get(v.nome)?.pipeline_aberto_gerado ?? 0))}</p>
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  {resumoPorConsultor.get(v.nome)?.oportunidades_abertas ?? 0} oportunidades abertas
                </span>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 border-t pt-4" style={{ borderColor: "var(--voux-card-border)" }}>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <TrendingUp className="h-3 w-3" style={{ color: "var(--voux-text-faint)" }} />
                  <span className="font-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: "var(--voux-text-faint)" }}>Ações</span>
                </div>
                <p className="text-xl font-bold leading-none" style={{ color: "var(--voux-text-primary)" }}>{v.totalAcoes}</p>
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Users className="h-3 w-3" style={{ color: "var(--voux-text-faint)" }} />
                  <span className="font-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: "var(--voux-text-faint)" }}>Visitas</span>
                </div>
                <p className="text-xl font-bold leading-none" style={{ color: "var(--voux-text-primary)" }}>{v.visitas}</p>
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Target className="h-3 w-3" style={{ color: "var(--voux-text-faint)" }} />
                  <span className="font-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: "var(--voux-text-faint)" }}>Conversão</span>
                </div>
                <p className="text-xl font-bold leading-none" style={{ color: "var(--voux-text-primary)" }}>{v.conversao == null ? "—" : `${v.conversao}%`}</p>
              </div>
            </div>

            {/* Rodapé */}
            <div className="mt-4 flex items-center justify-between">
              <span className="font-mono text-[10px]" style={{ color: "var(--voux-text-faint)" }}>
                {v.clientes} clientes atendidos
              </span>
              <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-all" style={{ color: "var(--voux-text-faint)" }} />
            </div>
          </div>
        ))}
      </div>
      </section>

      <RankingClientesNovos
        registros={isFiltered ? filterRegistros(registros, filters) : registros}
        filters={filters}
      />

      {/* Quadro auditavel fica ao final para nao substituir a visao de cards. */}
      <ConsultoresValidationTable
        resumo={resumo}
        from={filters.dateRange?.from ?? ""}
        to={filters.dateRange?.to ?? ""}
        onSelectConsultor={onSelectConsultor}
      />
    </div>
  );
};
