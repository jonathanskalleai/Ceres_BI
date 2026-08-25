import { useMemo, memo } from "react";
import { Users, ShoppingBag, CalendarCheck, DollarSign } from "lucide-react";
import type { RpcConsultorResumoAcoes } from "@/types/consultoresRpc";
import { formatBRL } from "@/lib/dateUtils";

interface ResumoExecutivoCardProps {
  resumo: RpcConsultorResumoAcoes[];
}

export const ResumoExecutivoCard = memo(function ResumoExecutivoCard({ resumo }: ResumoExecutivoCardProps) {
  // Aggregated totals from real RPC data
  const totais = useMemo(() => {
    let totalVendido = 0;
    let totalGanhos = 0;
    let totalAcoes = 0;
    let totalVisitas = 0;
    let totalClientes = 0;
    let totalPipeline = 0;

    for (let i = 0; i < resumo.length; i++) {
      const item = resumo[i];
      totalVendido += Number(item.valor_ganho || 0);
      totalGanhos += Number(item.ganhos || 0);
      totalAcoes += Number(item.acoes || 0);
      totalVisitas += Number(item.visitas || 0);
      totalClientes += Number(item.clientes || 0);
      totalPipeline += Number(item.pipeline_aberto_gerado || 0);
    }

    return {
      totalVendido,
      totalGanhos,
      totalAcoes,
      totalVisitas,
      totalClientes,
      totalPipeline,
    };
  }, [resumo]);

  return (
    <div
      className="flex flex-col justify-between h-full rounded-2xl border p-5 transition-all duration-200"
      style={{
        background: "var(--surface-raised)",
        borderColor: "var(--voux-card-border)",
        boxShadow: "var(--voux-card-shadow)",
      }}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-3.5">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            <h3
              className="text-[12px] font-semibold uppercase tracking-[0.12em]"
              style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}
            >
              Resumo Executivo
            </h3>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            {resumo.length} consultores
          </span>
        </div>

        {/* Headline KPI: Total Vendido */}
        <div className="mb-5">
          <p
            className="text-2xl lg:text-3xl font-bold tracking-tight tabular-nums"
            style={{ fontFamily: "var(--voux-font-display)", color: "var(--voux-text-heading)" }}
          >
            {formatBRL(totais.totalVendido)}
          </p>
          <div className="flex items-center justify-between text-[12px] mt-1 mb-2.5" style={{ color: "var(--voux-text-faint)" }}>
            <span>Total faturado no período</span>
            <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
              {totais.totalGanhos} pedidos ganhos
            </span>
          </div>
          {/* Accent Gold/Champagne Progress Bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300"
              style={{ width: "100%" }}
            />
          </div>
        </div>

        {/* Sub-KPIs Strip with Mini Bars */}
        <div className="space-y-4 pt-3 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
          {/* Clientes Únicos */}
          <div>
            <div className="flex items-center justify-between text-[12px] mb-1.5">
              <span className="flex items-center gap-1.5 font-medium" style={{ color: "var(--voux-text-primary)" }}>
                <Users className="h-3.5 w-3.5 text-sky-500" />
                Clientes atendidos
              </span>
              <span className="font-mono font-bold tabular-nums" style={{ color: "var(--voux-text-heading)" }}>
                {totais.totalClientes.toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <div className="h-full rounded-full bg-sky-500" style={{ width: "85%" }} />
            </div>
          </div>

          {/* Vendas Fechadas (Ganhos) */}
          <div>
            <div className="flex items-center justify-between text-[12px] mb-1.5">
              <span className="flex items-center gap-1.5 font-medium" style={{ color: "var(--voux-text-primary)" }}>
                <ShoppingBag className="h-3.5 w-3.5 text-emerald-500" />
                Deals fechados
              </span>
              <span className="font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {totais.totalGanhos.toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: "90%" }} />
            </div>
          </div>

          {/* Ações & Visitas */}
          <div>
            <div className="flex items-center justify-between text-[12px] mb-1.5">
              <span className="flex items-center gap-1.5 font-medium" style={{ color: "var(--voux-text-primary)" }}>
                <CalendarCheck className="h-3.5 w-3.5 text-purple-500" />
                Ações de campo & visitas
              </span>
              <span className="font-mono font-bold tabular-nums" style={{ color: "var(--voux-text-heading)" }}>
                {totais.totalAcoes.toLocaleString("pt-BR")}{" "}
                <span className="text-[11px] font-normal text-muted-foreground">({totais.totalVisitas} vis.)</span>
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <div className="h-full rounded-full bg-purple-500" style={{ width: "75%" }} />
            </div>
          </div>
        </div>
      </div>

      <div className="pt-3 mt-4 border-t text-[11px] font-mono text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
        Totais calculados diretamente das oportunidades do CRM.
      </div>
    </div>
  );
});
