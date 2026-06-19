import {
  TrendingUp, TrendingDown, Briefcase, Target, DollarSign, Ticket,
  ClipboardList, Eye, Wrench, Activity, Users, Clock, FileCheck,
  BarChart3, Percent, ShieldCheck,
} from "lucide-react";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { usePainelKPIs } from "@/hooks/bi/usePainelKPIs";
import { usePedidosKPIs } from "@/hooks/bi/usePedidosKPIs";
import { useClientesKPIs } from "@/hooks/bi/useClientesKPIs";
import { useServicosKPIs } from "@/hooks/bi/useServicosKPIs";
import { useCrossKPIs } from "@/hooks/bi/useCrossKPIs";
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

/** Format days */
function fmtDias(value: number): string {
  return `${Math.round(value)} dias`;
}

/** Check if a numeric KPI value is zero/empty (should hide the card) */
function isEmpty(v: number): boolean {
  return v === 0 || isNaN(v);
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
  const { dateRange, categoria, funil, vendedor, cidade } = useNegociosFilter();
  const { kpis, isLoading } = usePainelKPIs(dateRange, categoria, funil, vendedor || undefined, cidade || undefined);
  const { kpis: pedKpis, isLoading: pedLoading } = usePedidosKPIs(dateRange, categoria, funil);
  const { kpis: cliKpis, isLoading: cliLoading } = useClientesKPIs(dateRange);
  const { kpis: svcKpis, isLoading: svcLoading } = useServicosKPIs(dateRange);
  const { kpis: crossKpis, isLoading: crossLoading } = useCrossKPIs(dateRange, categoria, funil);

  // Cards aparecem todos juntos — sem cascata. Mostra skeleton até a última query terminar.
  const anyLoading = isLoading || pedLoading || cliLoading || svcLoading || crossLoading;

  return (
    <section className="p-8 space-y-2" style={{ background: "var(--voux-bg)" }}>
      {/* PRINCIPAL — grid unico (negocios + valores + faturamento + clientes + servicos) */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">

        {/* Negocios */}
        {!isEmpty(kpis.totalNegocios.value) && (
          <KPICard
            title="Total Negocios"
            value={fmtNum(kpis.totalNegocios.value)}
            icon={Briefcase}
            previousValue={fmtNum(kpis.totalNegocios.previousValue)}
            trend={kpis.totalNegocios.trend}
            loading={isLoading}
            formula="COUNT negocios unicos (dedup por numero)"
          />
        )}
        {!isEmpty(kpis.ganhos.value) && (
          <KPICard
            title="Ganhos"
            value={fmtNum(kpis.ganhos.value)}
            icon={TrendingUp}
            previousValue={fmtNum(kpis.ganhos.previousValue)}
            trend={kpis.ganhos.trend}
            loading={isLoading}
            accentColor="var(--voux-success, #4ade80)"
            formula="COUNT WHERE conclusao = ganho"
          />
        )}
        {!isEmpty(kpis.perdidos.value) && (
          <KPICard
            title="Perdidos"
            value={fmtNum(kpis.perdidos.value)}
            icon={TrendingDown}
            previousValue={fmtNum(kpis.perdidos.previousValue)}
            trend={kpis.perdidos.trend}
            invertTrend
            loading={isLoading}
            accentColor="var(--voux-danger, #f87171)"
            formula="COUNT WHERE conclusao = perda"
          />
        )}
        {!isEmpty(kpis.andamento.value) && (
          <KPICard
            title="Em Andamento"
            value={fmtNum(kpis.andamento.value)}
            icon={Activity}
            previousValue={fmtNum(kpis.andamento.previousValue)}
            trend={kpis.andamento.trend}
            loading={isLoading}
            formula="COUNT WHERE sem conclusao definitiva"
          />
        )}
        {!isEmpty(kpis.taxaConversao.value) && (
          <KPICard
            title="Taxa de Conversao"
            value={fmtPct(kpis.taxaConversao.value)}
            icon={Target}
            previousValue={fmtPct(kpis.taxaConversao.previousValue)}
            trend={kpis.taxaConversao.trend}
            loading={isLoading}
            formula="ganhos / (ganhos + perdidos) x 100"
          />
        )}
        {!isEmpty(crossKpis.cicloMedioVendas.value) && (
          <KPICard
            title="Ciclo Medio"
            value={fmtDias(crossKpis.cicloMedioVendas.value)}
            icon={Clock}
            previousValue={fmtDias(crossKpis.cicloMedioVendas.previousValue)}
            trend={crossKpis.cicloMedioVendas.trend}
            invertTrend
            loading={crossLoading}
            hint="Media dias ate fechar (ganhos)"
            formula="AVG(dias ate fechar) dos ganhos"
          />
        )}
        {!isEmpty(crossKpis.esforcoMedio.value) && (
          <KPICard
            title="Esforco Medio"
            value={fmtNum(crossKpis.esforcoMedio.value)}
            icon={ClipboardList}
            previousValue={fmtNum(crossKpis.esforcoMedio.previousValue)}
            trend={crossKpis.esforcoMedio.trend}
            invertTrend
            loading={crossLoading}
            hint="Acoes por negocio ganho"
            formula="AVG(qtd acoes) por negocio ganho"
          />
        )}
        {/* Valores */}
        {!isEmpty(kpis.valorGanho.value) && (
          <KPICard
            title="Valor Ganho"
            value={fmtBRL(kpis.valorGanho.value)}
            icon={DollarSign}
            previousValue={fmtBRL(kpis.valorGanho.previousValue)}
            trend={kpis.valorGanho.trend}
            loading={isLoading}
            accentColor="var(--voux-success, #4ade80)"
            formula="SUM(valor) dos negocios ganhos"
          />
        )}
        {!isEmpty(kpis.valorPerdido.value) && (
          <KPICard
            title="Valor Perdido"
            value={fmtBRL(kpis.valorPerdido.value)}
            icon={TrendingDown}
            previousValue={fmtBRL(kpis.valorPerdido.previousValue)}
            trend={kpis.valorPerdido.trend}
            invertTrend
            loading={isLoading}
            accentColor="var(--voux-danger, #f87171)"
            formula="SUM(valor) dos negocios perdidos"
          />
        )}
        {!isEmpty(kpis.pipelineAberto.value) && (
          <KPICard
            title="Pipeline Aberto"
            value={fmtBRL(kpis.pipelineAberto.value)}
            icon={Briefcase}
            previousValue={fmtBRL(kpis.pipelineAberto.previousValue)}
            trend={kpis.pipelineAberto.trend}
            loading={isLoading}
            formula="SUM(valor) dos negocios em andamento"
          />
        )}
        {!isEmpty(kpis.ticketMedio.value) && (
          <KPICard
            title="Ticket Medio"
            value={fmtBRL(kpis.ticketMedio.value)}
            icon={Ticket}
            previousValue={fmtBRL(kpis.ticketMedio.previousValue)}
            trend={kpis.ticketMedio.trend}
            loading={isLoading}
            formula="valor ganho / qtd ganhos"
          />
        )}
        {!isEmpty(crossKpis.receitaPorConsultor.value) && (
          <KPICard
            title="Receita/Consultor"
            value={fmtBRL(crossKpis.receitaPorConsultor.value)}
            icon={BarChart3}
            previousValue={fmtBRL(crossKpis.receitaPorConsultor.previousValue)}
            trend={crossKpis.receitaPorConsultor.trend}
            loading={crossLoading}
            hint="Media valor ganho por vendedor"
            formula="valor ganho / qtd vendedores com ganho"
          />
        )}
        {/* Faturamento */}
        {!isEmpty(pedKpis.faturamento.value) && (
          <KPICard
            title="Faturamento"
            value={fmtBRL(pedKpis.faturamento.value)}
            icon={DollarSign}
            previousValue={fmtBRL(pedKpis.faturamento.previousValue)}
            trend={pedKpis.faturamento.trend}
            loading={pedLoading}
            accentColor="var(--voux-success, #4ade80)"
            formula="SUM(valor pedido) WHERE aprovado"
          />
        )}
        {!isEmpty(pedKpis.totalPedidos.value) && (
          <KPICard
            title="Total Pedidos"
            value={fmtNum(pedKpis.totalPedidos.value)}
            icon={FileCheck}
            previousValue={fmtNum(pedKpis.totalPedidos.previousValue)}
            trend={pedKpis.totalPedidos.trend}
            loading={pedLoading}
            formula="COUNT pedidos no periodo"
          />
        )}
        {!isEmpty(pedKpis.taxaAprovacao.value) && (
          <KPICard
            title="Taxa Aprovacao"
            value={fmtPct(pedKpis.taxaAprovacao.value)}
            icon={ShieldCheck}
            previousValue={fmtPct(pedKpis.taxaAprovacao.previousValue)}
            trend={pedKpis.taxaAprovacao.trend}
            loading={pedLoading}
            formula="pedidos aprovados / total x 100"
          />
        )}
        {!isEmpty(pedKpis.mixFinanciamento.value) && (
          <KPICard
            title="Mix Financiamento"
            value={fmtPct(pedKpis.mixFinanciamento.value)}
            icon={Percent}
            previousValue={fmtPct(pedKpis.mixFinanciamento.previousValue)}
            trend={pedKpis.mixFinanciamento.trend}
            loading={pedLoading}
            hint="% valor financiado vs total"
            formula="valor financiado / (financiado + recurso proprio) x 100"
          />
        )}
        {!isEmpty(crossKpis.conversaoPedidoNegocio.value) && (
          <KPICard
            title="Conversao Pedido"
            value={fmtPct(crossKpis.conversaoPedidoNegocio.value)}
            icon={Target}
            previousValue={fmtPct(crossKpis.conversaoPedidoNegocio.previousValue)}
            trend={crossKpis.conversaoPedidoNegocio.trend}
            loading={crossLoading}
            hint="% ganhos com pedido emitido"
            formula="negocios ganhos com pedido / total ganhos x 100"
          />
        )}
        {/* Clientes */}
        {!isEmpty(cliKpis.clientesAtivos.value) && (
          <KPICard
            title="Clientes Ativos"
            value={fmtNum(cliKpis.clientesAtivos.value)}
            icon={Users}
            previousValue={fmtNum(cliKpis.clientesAtivos.previousValue)}
            trend={cliKpis.clientesAtivos.trend}
            loading={cliLoading}
            formula="COUNT carteira WHERE nao prospect"
          />
        )}
        {!isEmpty(cliKpis.prospects.value) && (
          <KPICard
            title="Prospects"
            value={fmtNum(cliKpis.prospects.value)}
            icon={Users}
            previousValue={fmtNum(cliKpis.prospects.previousValue)}
            trend={cliKpis.prospects.trend}
            loading={cliLoading}
            accentColor="var(--voux-champagne-400, #d4a574)"
            formula="COUNT carteira WHERE prospect = S"
          />
        )}
        {!isEmpty(cliKpis.parqueMaquinas.value) && (
          <KPICard
            title="Parque Maquinas"
            value={fmtNum(cliKpis.parqueMaquinas.value)}
            icon={Wrench}
            previousValue={fmtNum(cliKpis.parqueMaquinas.previousValue)}
            trend={cliKpis.parqueMaquinas.trend}
            loading={cliLoading}
            formula="SUM(qtd maquinas) da base"
          />
        )}
        {!isEmpty(cliKpis.coberturaComercial.value) && (
          <KPICard
            title="Cobertura Comercial"
            value={fmtPct(cliKpis.coberturaComercial.value)}
            icon={Target}
            previousValue={fmtPct(cliKpis.coberturaComercial.previousValue)}
            trend={cliKpis.coberturaComercial.trend}
            loading={cliLoading}
            hint="% clientes com acao no periodo"
            formula="clientes com acao no periodo / total ativos x 100"
          />
        )}
        {/* Servicos */}
        {!isEmpty(svcKpis.osAbertas.value) && (
          <KPICard
            title="OS Abertas"
            value={fmtNum(svcKpis.osAbertas.value)}
            icon={Wrench}
            previousValue={fmtNum(svcKpis.osAbertas.previousValue)}
            trend={svcKpis.osAbertas.trend}
            loading={svcLoading}
            formula="COUNT OS abertas no periodo"
          />
        )}
        {!isEmpty(svcKpis.osFechadas.value) && (
          <KPICard
            title="OS Fechadas"
            value={fmtNum(svcKpis.osFechadas.value)}
            icon={ShieldCheck}
            previousValue={fmtNum(svcKpis.osFechadas.previousValue)}
            trend={svcKpis.osFechadas.trend}
            loading={svcLoading}
            accentColor="var(--voux-success, #4ade80)"
            formula="COUNT OS encerradas no periodo"
          />
        )}
        {!isEmpty(svcKpis.tempoMedioResolucao.value) && (
          <KPICard
            title="Tempo Medio Resolucao"
            value={fmtDias(svcKpis.tempoMedioResolucao.value)}
            icon={Clock}
            previousValue={fmtDias(svcKpis.tempoMedioResolucao.previousValue)}
            trend={svcKpis.tempoMedioResolucao.trend}
            invertTrend
            loading={svcLoading}
            hint="Media dias para encerrar OS"
            formula="AVG(encerramento - abertura) em dias"
          />
        )}
      </div>

      {/* ACOES / OPERACIONAL — secao secundaria separada */}
      <SectionEyebrow label="ACOES / OPERACIONAL" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 opacity-90">
        {!isEmpty(kpis.totalAcoes.value) && (
          <KPICard
            title="Total Acoes"
            value={fmtNum(kpis.totalAcoes.value)}
            icon={ClipboardList}
            previousValue={fmtNum(kpis.totalAcoes.previousValue)}
            trend={kpis.totalAcoes.trend}
            loading={isLoading}
            formula="COUNT acoes concluidas no periodo"
          />
        )}
        {!isEmpty(kpis.totalVisitas.value) && (
          <KPICard
            title="Total Visitas"
            value={fmtNum(kpis.totalVisitas.value)}
            icon={Eye}
            previousValue={fmtNum(kpis.totalVisitas.previousValue)}
            trend={kpis.totalVisitas.trend}
            loading={isLoading}
            formula="COUNT acoes tipo visita"
          />
        )}
        {kpis.porTipoAcao
          .filter((tipo) => !isEmpty(tipo.value))
          .map((tipo) => (
            <KPICard
              key={tipo.name}
              title={tipo.name}
              value={fmtNum(tipo.value)}
              icon={ClipboardList}
              previousValue={fmtNum(tipo.previousValue)}
              trend={tipo.trend}
              loading={isLoading}
              formula={`COUNT acoes tipo ${tipo.name.toLowerCase()}`}
            />
          ))}
      </div>
    </section>
  );
}
