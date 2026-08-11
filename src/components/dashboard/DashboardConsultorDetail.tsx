import { useMemo } from "react";
import type { Vendedor, Registro } from "@/types/comercial";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, Eye, Users, DollarSign, Target, BarChart3 } from "lucide-react";
import { ConsultorCharts } from "./consultor/ConsultorCharts";
import { ConsultorClienteCard } from "./consultor/ConsultorClienteCard";
import { KPICard } from "@/components/bi/KPICard";
import { SectionEyebrow } from "@/components/bi/SectionEyebrow";

interface Props {
  vendedor: Vendedor;
  registros: Registro[];
  onBack: () => void;
}

const fmtCurrency = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(0)}K` : `R$ ${v.toFixed(0)}`;

function GradeBadge({ q }: { q: number }) {
  const grade = q >= 70 ? "A" : q >= 50 ? "B" : q >= 30 ? "C" : "D";
  const labels: Record<string, string> = {
    A: "Excelente",
    B: "Bom",
    C: "Regular",
    D: "Insuficiente",
  };
  const colors: Record<string, string> = {
    A: "var(--voux-success, #1f6e3f)",
    B: "var(--voux-warning, #9c5e1c)",
    C: "var(--voux-warning, #9c5e1c)",
    D: "var(--voux-danger, #b8421c)",
  };
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex items-center justify-center w-7 h-7 rounded-full border-2 font-mono text-xs font-bold"
        style={{ borderColor: colors[grade], color: colors[grade] }}
      >
        {grade}
      </span>
      <span
        className="text-[11px] font-medium"
        style={{ color: colors[grade], fontFamily: "var(--voux-font-mono)" }}
      >
        {labels[grade]}
      </span>
    </div>
  );
}

export const DashboardConsultorDetail = ({ vendedor: v, registros, onBack }: Props) => {
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
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="rounded-full mt-1"
          style={{ color: "var(--voux-text-muted)" }}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2
            className="text-2xl font-bold tracking-[-0.02em] leading-tight"
            style={{ color: "var(--voux-text-heading)" }}
          >
            {v.nome}
          </h2>
          <div className="flex items-center gap-4 mt-2">
            <GradeBadge q={v.crmQuality} />
            <span
              className="text-[11px]"
              style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}
            >
              {v.negocios} negócios registrados
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards — usando o mesmo componente do BI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KPICard
          title="Total Ações"
          value={v.totalAcoes.toLocaleString("pt-BR")}
          icon={TrendingUp}
          accentColor="var(--voux-accent)"
        />
        <KPICard
          title="Visitas"
          value={v.visitas.toLocaleString("pt-BR")}
          icon={Eye}
          accentColor="#6a2f99"
        />
        <KPICard
          title="Clientes"
          value={v.clientes.toLocaleString("pt-BR")}
          icon={Users}
          accentColor="#1d4f8a"
        />
        <KPICard
          title="Pipeline"
          value={fmtCurrency(v.pipeline)}
          icon={DollarSign}
          accentColor="#1f6e3f"
        />
        <KPICard
          title="Conversão"
          value={`${v.conversao}%`}
          icon={Target}
          accentColor="#9c5e1c"
        />
        <KPICard
          title="CRM Quality"
          value={`${v.crmQuality}%`}
          icon={BarChart3}
          accentColor={v.crmQuality >= 70 ? "#1f6e3f" : v.crmQuality >= 50 ? "#9c5e1c" : "#b8421c"}
          hint={v.crmQuality >= 70 ? "Excelente" : v.crmQuality >= 50 ? "Bom" : v.crmQuality >= 30 ? "Regular" : "Insuficiente"}
        />
      </div>

      {/* Charts Section */}
      <ConsultorCharts evolucao={v.evolucao} tiposAcao={v.tiposAcao} regioes={v.regioes} />

      {/* Top Clientes */}
      <div className="space-y-4">
        <SectionEyebrow label="Top 10 Clientes" />
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "var(--surface-raised)",
            border: "1px solid var(--voux-card-border)",
            boxShadow: "var(--voux-card-shadow)",
          }}
        >
          {/* Table header */}
          <div
            className="grid grid-cols-[32px_1fr_100px_60px_60px_90px_80px_80px_32px] items-center px-5 py-3"
            style={{ borderBottom: "1px solid var(--voux-card-border)" }}
          >
            {[
              { label: "#", align: "" },
              { label: "Cliente", align: "" },
              { label: "Cidade", align: "" },
              { label: "Ações", align: "text-center" },
              { label: "Visitas", align: "text-center" },
              { label: "Pipeline", align: "text-right" },
              { label: "S/ Contato", align: "text-center" },
              { label: "Status", align: "text-center" },
              { label: "", align: "" },
            ].map((col, idx) => (
              <span
                key={idx}
                className={`text-[9px] tracking-[0.14em] uppercase font-medium ${col.align}`}
                style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}
              >
                {col.label}
              </span>
            ))}
          </div>
          {/* Table rows */}
          <div className="px-2">
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
    </div>
  );
};
