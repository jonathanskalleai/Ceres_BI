import { useMemo } from "react";
import type { Vendedor, Registro } from "@/types/comercial";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { ConsultorCharts } from "./consultor/ConsultorCharts";
import { ConsultorClienteCard } from "./consultor/ConsultorClienteCard";
import type { RpcConsultorResumoAcoes } from "@/types/consultoresRpc";
import { formatDateBR } from "@/lib/dateUtils";
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
  v >= 1e6 ? `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi` : v >= 1e3 ? `R$ ${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil` : `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;

const CARD = "rounded-xl border bg-white p-5";

export const DashboardConsultorDetail = ({ vendedor: v, resumo, registros, from, to, onBack }: Props) => {
  const gradeColor = v.crmQuality >= 70 ? "#1f6e3f" : v.crmQuality >= 50 ? "#9c5e1c" : "#b8421c";
  const gradeLabel = v.crmQuality >= 70 ? "A — Excelente" : v.crmQuality >= 50 ? "B — Bom" : v.crmQuality >= 30 ? "C — Regular" : "D — Insuficiente";

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
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="rounded-full">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold tracking-tight" style={{ color: "var(--voux-text-primary)" }}>{v.nome}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px]"
              style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-accent)", borderColor: "var(--voux-card-border)" }}
            >
              <CalendarDays className="h-3 w-3" />
              {formatDateBR(from)} a {formatDateBR(to)}
            </span>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded border"
              style={{ borderColor: gradeColor, color: gradeColor, fontFamily: "var(--voux-font-mono)" }}
            >
              CRM {gradeLabel}
            </span>
          </div>
        </div>
      </div>

      {/* KPIs principais — estilo screenshot (eyebrow + valor grande + hint) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { eyebrow: "VENDAS", value: fmtCurrency(Number(resumo.valor_ganho)), hint: `${resumo.ganhos} pedidos aprovados`, color: "#1f6e3f" },
          { eyebrow: "PIPELINE ABERTO", value: fmtCurrency(Number(resumo.pipeline_aberto_gerado)), hint: `${resumo.oportunidades_abertas} oportunidades abertas`, color: "var(--voux-accent)" },
          { eyebrow: "CONVERSÃO", value: resumo.taxa_ganho == null ? "—" : `${resumo.taxa_ganho}%`, hint: `${resumo.ganhos} ganhos ÷ ${resumo.oportunidades_geradas} oportunidades`, color: "var(--voux-text-primary)" },
          { eyebrow: "AÇÕES", value: Number(resumo.acoes).toLocaleString("pt-BR"), hint: "concluídas no período", color: "var(--voux-text-primary)" },
          { eyebrow: "VISITAS", value: Number(resumo.visitas).toLocaleString("pt-BR"), hint: "ações presenciais", color: "var(--voux-text-primary)" },
          { eyebrow: "CLIENTES ATENDIDOS", value: Number(resumo.clientes).toLocaleString("pt-BR"), hint: "clientes únicos", color: "var(--voux-text-primary)" },
        ].map((kpi) => (
          <div
            key={kpi.eyebrow}
            className={cn(CARD)}
            style={{ borderColor: "var(--voux-card-border)", boxShadow: "var(--voux-card-shadow)" }}
          >
            <p
              className="text-[10px] tracking-[0.18em] uppercase font-medium mb-2"
              style={{ fontFamily: "var(--voux-font-mono)", color: kpi.color }}
            >
              {kpi.eyebrow}
            </p>
            <p
              className="text-2xl font-bold leading-none tracking-tight tabular-nums"
              style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-primary)" }}
            >
              {kpi.value}
            </p>
            <p
              className="mt-2 text-[11px]"
              style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}
            >
              {kpi.hint}
            </p>
          </div>
        ))}
      </div>

      {/* Gestão da Carteira */}
      <div
        className={cn(CARD, "space-y-4")}
        style={{ borderColor: "var(--voux-card-border)", boxShadow: "var(--voux-card-shadow)" }}
      >
        <div>
          <p
            className="text-[10px] tracking-[0.18em] uppercase font-medium"
            style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}
          >
            GESTÃO DA CARTEIRA
          </p>
          <h3 className="text-base font-bold mt-1" style={{ color: "var(--voux-text-primary)" }}>
            Carteira ativa e oportunidades
          </h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "CARTEIRA TRABALHADA", value: fmtCurrency(Number(resumo.carteira_ativa_trabalhada)), hint: `${resumo.negocios_abertos_tocados} negócios tocados` },
            { label: "OPORTUNIDADES GERADAS", value: Number(resumo.oportunidades_geradas).toLocaleString("pt-BR"), hint: `${resumo.oportunidades_abertas} continuam abertas` },
            { label: "PERDIDOS", value: fmtCurrency(Number(resumo.valor_perdido)), hint: `${resumo.perdidos} negócios perdidos` },
            { label: "QUALIDADE CRM", value: `${resumo.crm_quality}%`, hint: gradeLabel },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border p-3" style={{ borderColor: "var(--voux-card-border)" }}>
              <p
                className="text-[9px] tracking-[0.14em] uppercase mb-2"
                style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}
              >
                {item.label}
              </p>
              <p className="text-lg font-bold leading-none tabular-nums" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-primary)" }}>
                {item.value}
              </p>
              <p className="mt-1.5 text-[10px]" style={{ color: "var(--voux-text-faint)" }}>
                {item.hint}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Gráficos */}
      <ConsultorCharts evolucao={v.evolucao} tiposAcao={v.tiposAcao} regioes={v.regioes} />

      {/* Tabela de clientes */}
      <div
        className={cn(CARD, "p-0 overflow-hidden")}
        style={{ borderColor: "var(--voux-card-border)", boxShadow: "var(--voux-card-shadow)" }}
      >
        <div className="px-5 pt-5 pb-3">
          <p
            className="text-[10px] tracking-[0.18em] uppercase font-medium"
            style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}
          >
            POR CLIENTE
          </p>
          <h3 className="text-base font-bold mt-1" style={{ color: "var(--voux-text-primary)" }}>
            Clientes atendidos no período
          </h3>
        </div>
        <div className="px-4 pb-4">
          <div
            className="grid grid-cols-[32px_1fr_100px_60px_60px_90px_80px_80px_32px] items-center px-2 py-2 border-b text-[9px] tracking-[0.14em] uppercase font-medium"
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
