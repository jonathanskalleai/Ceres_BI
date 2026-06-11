import {
  TrendingUp, TrendingDown, Briefcase, Target, DollarSign, Ticket,
  ClipboardList, Eye, Wrench, Activity,
} from "lucide-react";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { usePainelKPIs } from "@/hooks/bi/usePainelKPIs";
import { KPICard } from "@/components/bi/KPICard";

/** Format currency in R$ pt-BR style */
function fmtBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Format percentage */
function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** Format integer with thousands separator */
function fmtNum(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

function SectionEyebrow({ label }: { label: string }) {
  return (
    <h2
      className="text-[10px] tracking-[0.22em] uppercase mb-4 mt-8 first:mt-0"
      style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}
    >
      {"— "}{label}
    </h2>
  );
}

export default function BiPainel() {
  const { dateRange, categoria, funil } = useNegociosFilter();
  const { kpis, isLoading } = usePainelKPIs(dateRange, categoria, funil);

  return (
    <section className="p-8 space-y-2" style={{ background: "var(--voux-bg)" }}>
      {/* NEGOCIOS */}
      <SectionEyebrow label="NEGOCIOS" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPICard
          title="Total Negocios"
          value={fmtNum(kpis.totalNegocios.value)}
          icon={Briefcase}
          delta={kpis.totalNegocios.delta}
          trend={kpis.totalNegocios.trend}
          loading={isLoading}
          hero
        />
        <KPICard
          title="Ganhos"
          value={fmtNum(kpis.ganhos.value)}
          icon={TrendingUp}
          delta={kpis.ganhos.delta}
          trend={kpis.ganhos.trend}
          loading={isLoading}
          accentColor="var(--voux-success, #4ade80)"
        />
        <KPICard
          title="Perdidos"
          value={fmtNum(kpis.perdidos.value)}
          icon={TrendingDown}
          delta={kpis.perdidos.delta}
          trend={kpis.perdidos.trend}
          invertTrend
          loading={isLoading}
          accentColor="var(--voux-danger, #f87171)"
        />
        <KPICard
          title="Em Andamento"
          value={fmtNum(kpis.andamento.value)}
          icon={Activity}
          delta={kpis.andamento.delta}
          trend={kpis.andamento.trend}
          loading={isLoading}
        />
        <KPICard
          title="Taxa de Conversao"
          value={fmtPct(kpis.taxaConversao.value)}
          icon={Target}
          delta={kpis.taxaConversao.delta}
          trend={kpis.taxaConversao.trend}
          loading={isLoading}
          hero
        />
      </div>

      {/* VALORES */}
      <SectionEyebrow label="VALORES" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPICard
          title="Valor Ganho"
          value={fmtBRL(kpis.valorGanho.value)}
          icon={DollarSign}
          delta={kpis.valorGanho.delta}
          trend={kpis.valorGanho.trend}
          loading={isLoading}
          hero
          accentColor="var(--voux-success, #4ade80)"
        />
        <KPICard
          title="Valor Perdido"
          value={fmtBRL(kpis.valorPerdido.value)}
          icon={TrendingDown}
          delta={kpis.valorPerdido.delta}
          trend={kpis.valorPerdido.trend}
          invertTrend
          loading={isLoading}
          accentColor="var(--voux-danger, #f87171)"
        />
        <KPICard
          title="Pipeline Aberto"
          value={fmtBRL(kpis.pipelineAberto.value)}
          icon={Briefcase}
          delta={kpis.pipelineAberto.delta}
          trend={kpis.pipelineAberto.trend}
          loading={isLoading}
        />
        <KPICard
          title="Ticket Medio"
          value={fmtBRL(kpis.ticketMedio.value)}
          icon={Ticket}
          delta={kpis.ticketMedio.delta}
          trend={kpis.ticketMedio.trend}
          loading={isLoading}
        />
      </div>

      {/* ACOES / OPERACIONAL */}
      <SectionEyebrow label="ACOES / OPERACIONAL" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KPICard
          title="Total Acoes"
          value={fmtNum(kpis.totalAcoes.value)}
          icon={ClipboardList}
          delta={kpis.totalAcoes.delta}
          trend={kpis.totalAcoes.trend}
          loading={isLoading}
        />
        <KPICard
          title="Total Visitas"
          value={fmtNum(kpis.totalVisitas.value)}
          icon={Eye}
          delta={kpis.totalVisitas.delta}
          trend={kpis.totalVisitas.trend}
          loading={isLoading}
        />
        <KPICard
          title="Eventos Agenda (OS)"
          value={fmtNum(kpis.totalOS.value)}
          icon={Wrench}
          delta={kpis.totalOS.delta}
          trend={kpis.totalOS.trend}
          loading={isLoading}
        />
        {kpis.porTipoAcao.map((tipo) => (
          <KPICard
            key={tipo.name}
            title={tipo.name}
            value={fmtNum(tipo.value)}
            icon={ClipboardList}
            delta={tipo.delta}
            trend={tipo.trend}
            loading={isLoading}
          />
        ))}
      </div>
    </section>
  );
}
