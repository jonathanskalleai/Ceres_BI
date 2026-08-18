import { useMemo } from "react";
import type { Vendedor, Registro } from "@/types/comercial";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ConsultorCharts } from "./consultor/ConsultorCharts";
import { ConsultorClienteCard } from "./consultor/ConsultorClienteCard";
import { InsightConsultorCard } from "./consultor/InsightConsultorCard";
import type { RpcConsultorResumoAcoes } from "@/types/consultoresRpc";
import { cn } from "@/lib/utils";

interface Props {
  vendedor: Vendedor;
  resumo: RpcConsultorResumoAcoes;
  registros: Registro[];
  from: string;
  to: string;
  onBack: () => void;
}

const fmtCurrency = (v: number) =>
  v >= 1e6
    ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}mi`
    : v >= 1e3
      ? `R$ ${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}k`
      : `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

const fmtFull = (v: number) =>
  `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

const CARD = "rounded-2xl border bg-[var(--surface-raised)]";

export const DashboardConsultorDetail = ({ vendedor: v, resumo, registros, from, to, onBack }: Props) => {
  const gradeColor = v.crmQuality >= 70 ? "#1f6e3f" : v.crmQuality >= 50 ? "#9c5e1c" : "#b8421c";
  const gradeBg = v.crmQuality >= 70 ? "rgba(31,110,63,0.08)" : v.crmQuality >= 50 ? "rgba(156,94,28,0.08)" : "rgba(184,66,28,0.08)";
  const gradeLabel = v.crmQuality >= 70 ? "A" : v.crmQuality >= 50 ? "B" : v.crmQuality >= 30 ? "C" : "D";

  const clientActions = useMemo(() => {
    const map = new Map<string, Registro[]>();
    const vendedorRegs = registros
      .filter((r) => r.vendedor === v.nome)
      .sort((a, b) => (b.dtConclusao || "").localeCompare(a.dtConclusao || ""));
    for (const r of vendedorRegs) {
      if (!map.has(r.cliente)) map.set(r.cliente, []);
      const arr = map.get(r.cliente)!;
      if (arr.length < 5) arr.push(r);
    }
    return map;
  }, [registros, v.nome]);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header — nome + badge CRM */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full h-9 w-9 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3 min-w-0">
          <h2
            className="text-lg font-bold tracking-tight truncate"
            style={{ color: "var(--voux-text-primary)" }}
          >
            {v.nome}
          </h2>
          <span
            className="shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-md text-[12px] font-bold"
            style={{ background: gradeBg, color: gradeColor, fontFamily: "var(--voux-font-mono)" }}
            title={`CRM Quality: ${v.crmQuality}%`}
          >
            {gradeLabel}
          </span>
        </div>
      </div>

      {/* KPIs — grid compacto */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Vendas", value: fmtCurrency(Number(resumo.valor_ganho)), sub: `${resumo.ganhos} pedidos`, accent: true, raw: Number(resumo.valor_ganho) },
          { label: "Carteira", value: fmtCurrency(Number(resumo.carteira_ativa_trabalhada)), sub: `${resumo.negocios_abertos_tocados} abertos`, accent: false, raw: Number(resumo.carteira_ativa_trabalhada) },
          { label: "Conversão", value: resumo.taxa_ganho == null ? "—" : `${resumo.taxa_ganho}%`, sub: `${resumo.ganhos}/${resumo.oportunidades_geradas}`, accent: false },
          { label: "Ações", value: Number(resumo.acoes).toLocaleString("pt-BR"), sub: "período", accent: false },
          { label: "Visitas", value: Number(resumo.visitas).toLocaleString("pt-BR"), sub: "presenciais", accent: false },
          { label: "Clientes", value: Number(resumo.clientes).toLocaleString("pt-BR"), sub: "únicos", accent: false },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className={cn(CARD, "px-4 py-3")}
            style={{ borderColor: "var(--voux-card-border)" }}
          >
            <p
              className="text-[11px] tracking-[0.12em] uppercase mb-1.5 font-medium"
              style={{
                fontFamily: "var(--voux-font-mono)",
                color: kpi.accent ? "#1f6e3f" : "var(--voux-text-muted)",
              }}
            >
              {kpi.label}
            </p>
            <p
              className="text-xl font-bold leading-none tabular-nums"
              style={{ fontFamily: "var(--voux-font-sans)", color: "var(--voux-text-primary)" }}
              title={kpi.raw ? fmtFull(kpi.raw) : undefined}
            >
              {kpi.value}
            </p>
            <p
              className="text-[12px] mt-1 leading-none"
              style={{ fontFamily: "var(--voux-font-sans)", color: "var(--voux-text-faint)" }}
            >
              {kpi.sub}
            </p>
          </div>
        ))}
      </div>

      {/* Insight IA individual */}
      <InsightConsultorCard consultor={v.nome} />

      {/* Gráficos */}
      <ConsultorCharts evolucao={v.evolucao} tiposAcao={v.tiposAcao} regioes={v.regioes} consultorNome={v.nome} />

      {/* Tabela de clientes */}
      <div
        className={cn(CARD, "p-0 overflow-hidden")}
        style={{ borderColor: "var(--voux-card-border)", boxShadow: "var(--voux-card-shadow)" }}
      >
        <div className="px-5 pt-4 pb-2 flex items-baseline justify-between">
          <h3
            className="text-sm font-semibold"
            style={{ color: "var(--voux-text-primary)", fontFamily: "var(--voux-font-sans)" }}
          >
            Clientes atendidos
          </h3>
          <span
            className="text-[12px] tabular-nums"
            style={{ fontFamily: "var(--voux-font-sans)", color: "var(--voux-text-faint)" }}
          >
            {v.topClientes.length} clientes
          </span>
        </div>
        <div className="px-4 pb-4">
          <div
            className="grid grid-cols-[32px_1fr_100px_60px_60px_90px_80px_80px_32px] items-center px-2 py-2 border-b text-[11px] tracking-[0.14em] uppercase font-medium"
            style={{ borderColor: "var(--voux-card-border)", fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}
          >
            <span>#</span><span>Cliente</span><span>Cidade</span>
            <span className="text-center">Ações</span><span className="text-center">Visitas</span>
            <span className="text-right">Valor vinculado</span><span className="text-center">Dias s/ Contato</span>
            <span className="text-center">Status</span><span></span>
          </div>
          {v.topClientes.map((c, i) => (
            <ConsultorClienteCard
              key={c.nome}
              cliente={c}
              rank={i + 1}
              actions={clientActions.get(c.nome) || []}
              vendedorNome={v.nome}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
