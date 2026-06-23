import { useState } from "react";
import { useComercialData } from "@/hooks/useComercialData";
import { useNegociosData } from "@/hooks/useNegociosData";
import { usePerformanceMetrics } from "@/hooks/usePerformanceMetrics";
import { Filters } from "@/types/comercial";
import { fmtBRL, fmtPct } from "@/lib/formatters";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Target, TrendingUp, AlertTriangle, Flame, Zap, MapPin, Presentation, Banknote } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMeta } from "@/hooks/useMeta";
import { BarChart } from "@/components/bi/charts";
import { Apresentacao2026 } from "@/components/performance/Apresentacao2026";
import { BigCard, MetricCard, SectionTitle } from "@/components/performance/PerformanceCards";
import { StrategicMessage } from "@/components/performance/StrategicMessage";
import { ActionPlan } from "@/components/performance/ActionPlan";

const emptyFilters: Filters = { cidade: "", tipoAcao: "", categoria: "", funil: "", dateRange: undefined };

const PerformanceComercial = () => {
  const navigate = useNavigate();
  const { data, isLoading: loadingCRM, error: errorCRM } = useComercialData();
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [activeTab, setActiveTab] = useState<"dashboard" | "apresentacao">("dashboard");
  const { summary: negociosSummary, isLoading: loadingNeg, error: errorNeg } = useNegociosData(filters);
  const { metaAnual: META_ANUAL } = useMeta(2026);
  const metrics = usePerformanceMetrics(negociosSummary, data, filters, META_ANUAL);

  const isLoading = loadingCRM || loadingNeg;
  const error = errorCRM || errorNeg;

  if (error) {
    return (
      <div className="min-h-screen bg-[hsl(222,47%,6%)] flex items-center justify-center">
        <p className="text-destructive text-lg">{error}</p>
      </div>
    );
  }

  if (isLoading || !metrics) {
    return (
      <div className="min-h-screen bg-[hsl(222,47%,6%)] p-8 space-y-6">
        <Skeleton className="h-12 w-96 bg-[hsl(217,33%,17%)]" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 bg-[hsl(217,33%,17%)]" />)}
        </div>
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-64 bg-[hsl(217,33%,17%)]" />
          <Skeleton className="h-64 bg-[hsl(217,33%,17%)]" />
        </div>
      </div>
    );
  }

  const riskColor = metrics.pctAtingido >= 70 ? "hsl(152,69%,40%)" : metrics.pctAtingido >= 40 ? "hsl(38,92%,50%)" : "hsl(0,84%,60%)";
  const MESES_ANO = 12;

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] text-[hsl(210,40%,96%)] flex flex-col">
      {/* Header */}
      <div className="border-b border-[hsl(217,33%,17%)] px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-[hsl(210,40%,96%)] hover:bg-[hsl(217,33%,17%)]">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-black tracking-tight">PERFORMANCE COMERCIAL 2026</h1>
            <p className="text-xs text-[hsl(215,16%,57%)]">Painel de Guerra — Ceres Equipamentos Agricolas</p>
          </div>
          <div className="flex items-center gap-1 ml-6 bg-[hsl(217,33%,12%)] rounded-lg p-1">
            <button onClick={() => setActiveTab("dashboard")} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${activeTab === "dashboard" ? "bg-[hsl(217,91%,60%)] text-[hsl(0,0%,100%)]" : "text-[hsl(215,16%,57%)] hover:text-[hsl(210,40%,96%)]"}`}>
              Dashboard
            </button>
            <button onClick={() => setActiveTab("apresentacao")} className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === "apresentacao" ? "bg-[hsl(217,91%,60%)] text-[hsl(0,0%,100%)]" : "text-[hsl(215,16%,57%)] hover:text-[hsl(210,40%,96%)]"}`}>
              <Presentation className="h-4 w-4" />
              Apresentacao 2026
            </button>
          </div>
        </div>
        {activeTab === "dashboard" && (
          <div className="flex items-center gap-3">
            <Select value={filters.cidade || "all"} onValueChange={(v) => setFilters(f => ({ ...f, cidade: v === "all" ? "" : v }))}>
              <SelectTrigger className="w-44 bg-[hsl(217,33%,17%)] border-[hsl(217,33%,20%)] text-[hsl(210,40%,96%)]">
                <MapPin className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Regiao" />
              </SelectTrigger>
              <SelectContent className="bg-[hsl(222,47%,9%)] border-[hsl(217,33%,17%)]">
                <SelectItem value="all">Todas Regioes</SelectItem>
                {(data?.listaCidades || []).sort().map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Content */}
      {activeTab === "apresentacao" && negociosSummary && data ? (
        <div className="flex-1">
          <Apresentacao2026 crmData={data} negData={negociosSummary} />
        </div>
      ) : (
      <div className="p-6 space-y-8 max-w-[1600px] mx-auto overflow-auto flex-1">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <BigCard label="META ANUAL" value={fmtBRL(META_ANUAL)} icon={<Target className="h-6 w-6" />} color="hsl(217,91%,60%)" />
          <BigCard label="REALIZADO" value={fmtBRL(metrics.realizado)} icon={<TrendingUp className="h-6 w-6" />} color="hsl(152,69%,40%)" sub={fmtPct(metrics.pctAtingido) + " da meta"} />
          <BigCard label="RECEBIDO TOTAL" value={fmtBRL(metrics.totalRecebido)} icon={<Banknote className="h-6 w-6" />} color="hsl(38,92%,50%)" sub={`${fmtPct(metrics.pctRecebidoSobreVenda)} do vendido | Usados: ${fmtBRL(metrics.totalUsado)}`} />
          <BigCard label="GAP" value={fmtBRL(metrics.gap)} icon={<AlertTriangle className="h-6 w-6" />} color="hsl(0,84%,60%)" sub="Falta para bater" />
          <BigCard label="% ATINGIDO" value={fmtPct(metrics.pctAtingido)} icon={<Flame className="h-6 w-6" />} color={riskColor} large />
        </div>

        <SectionTitle icon={<Zap />} title="VELOCIDADE NECESSARIA" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard label="Media Mensal Necessaria" value={fmtBRL(metrics.mediaNecessaria)} status="neutral" />
          <MetricCard label="Media Atual de Vendas" value={fmtBRL(metrics.mediaAtual)} status={metrics.noRitmo ? "ok" : "danger"} />
          <MetricCard label="Diferenca" value={fmtBRL(metrics.mediaAtual - (META_ANUAL / MESES_ANO))} status={metrics.noRitmo ? "ok" : "danger"} sub={metrics.noRitmo ? "No ritmo" : "Abaixo do necessario"} />
        </div>

        <SectionTitle icon={<AlertTriangle />} title="PRESSAO DO RESULTADO" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[hsl(222,47%,9%)] border border-[hsl(217,33%,17%)] rounded-lg p-6">
            <p className="text-[hsl(215,16%,57%)] text-sm mb-3">Se continuarmos nesse ritmo...</p>
            <p className="text-4xl font-black" style={{ color: metrics.projecaoAnual >= META_ANUAL ? "hsl(152,69%,40%)" : "hsl(0,84%,60%)" }}>
              {fmtBRL(metrics.projecaoAnual)}
            </p>
            <p className="text-sm text-[hsl(215,16%,57%)] mt-1">Projecao de fechamento anual</p>
            <div className="mt-4 h-3 rounded-full bg-[hsl(217,33%,17%)] overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (metrics.projecaoAnual / META_ANUAL) * 100)}%`, background: metrics.projecaoAnual >= META_ANUAL ? "hsl(152,69%,40%)" : "hsl(0,84%,60%)" }} />
            </div>
            <div className="flex justify-between text-xs text-[hsl(215,16%,57%)] mt-1">
              <span>Projecao: {fmtPct((metrics.projecaoAnual / META_ANUAL) * 100)}</span>
              <span>Meta: {fmtBRL(META_ANUAL)}</span>
            </div>
          </div>
          <div className="bg-[hsl(222,47%,9%)] border border-[hsl(38,92%,25%)] rounded-lg p-6">
            <div className="flex items-center gap-2 mb-3">
              <Banknote className="h-4 w-4 text-[hsl(38,92%,50%)]" />
              <p className="text-[hsl(38,92%,50%)] text-sm font-bold">Projecao Recebido Total</p>
            </div>
            <p className="text-4xl font-black text-[hsl(38,92%,50%)]">{fmtBRL(metrics.projecaoRecebido)}</p>
            <p className="text-xs text-[hsl(215,16%,57%)] mt-2">Valor em dinheiro projetado para o ano (coluna Recebido)</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="bg-[hsl(217,33%,12%)] rounded p-2 text-center">
                <p className="text-xs text-[hsl(215,16%,57%)]">Usados Projetados</p>
                <p className="text-sm font-bold text-[hsl(0,84%,60%)]">{fmtBRL(metrics.projecaoAnual - metrics.projecaoRecebido)}</p>
              </div>
              <div className="bg-[hsl(217,33%,12%)] rounded p-2 text-center">
                <p className="text-xs text-[hsl(215,16%,57%)]">% em Usados</p>
                <p className="text-sm font-bold text-[hsl(0,84%,60%)]">{fmtPct(metrics.pctUsadoSobreVenda)}</p>
              </div>
            </div>
          </div>
          <div className="bg-[hsl(222,47%,9%)] border border-[hsl(217,33%,17%)] rounded-lg p-6">
            <p className="text-[hsl(215,16%,57%)] text-sm mb-3">Comparativo</p>
            <BarChart
              data={[
                { name: "Meta", valor: META_ANUAL },
                { name: "Projecao Venda", valor: metrics.projecaoAnual },
                { name: "Proj. Recebido", valor: metrics.projecaoRecebido },
                { name: "Realizado", valor: metrics.realizado },
                { name: "Recebido Total", valor: metrics.totalRecebido },
              ]}
              layout="horizontal"
              keys={["valor"]}
              height={220}
              itemColors={[
                "hsl(217,91%,60%)",
                metrics.projecaoAnual >= META_ANUAL ? "hsl(152,69%,40%)" : "hsl(38,92%,50%)",
                "hsl(38,92%,50%)",
                "hsl(152,69%,40%)",
                "hsl(38,72%,45%)",
              ]}
              tooltipFormatter={(v) => fmtBRL(v)}
            />
          </div>
        </div>

        <SectionTitle icon={<Target />} title="OPORTUNIDADES ESCONDIDAS" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[hsl(222,47%,9%)] border border-[hsl(217,33%,17%)] rounded-lg p-5">
            <h4 className="text-sm font-semibold text-[hsl(38,92%,50%)] mb-3">Negocios em Aberto</h4>
            <p className="text-3xl font-black">{metrics.negociosAbertos}</p>
            <p className="text-xs text-[hsl(215,16%,57%)] mt-1">Negocios em andamento aguardando fechamento</p>
          </div>
          <div className="bg-[hsl(222,47%,9%)] border border-[hsl(217,33%,17%)] rounded-lg p-5">
            <h4 className="text-sm font-semibold text-[hsl(38,92%,50%)] mb-3">Clientes com Potencial Nao Convertido</h4>
            {metrics.clientesPotencial.length > 0 ? (
              <ul className="space-y-1 text-sm max-h-40 overflow-auto scrollbar-thin">
                {metrics.clientesPotencial.map((c) => (
                  <li key={c.nome} className="flex justify-between">
                    <span className="truncate mr-2">{c.nome}</span>
                    <span className="text-[hsl(215,16%,57%)] whitespace-nowrap">{c.acoes} acoes</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-[hsl(215,16%,57%)]">Nenhum identificado</p>}
          </div>
          <div className="bg-[hsl(222,47%,9%)] border border-[hsl(217,33%,17%)] rounded-lg p-5">
            <h4 className="text-sm font-semibold text-[hsl(38,92%,50%)] mb-3">Regioes: Alta Atividade, Baixo Fechamento</h4>
            {metrics.regioesOportunidade.length > 0 ? (
              <ul className="space-y-1 text-sm max-h-40 overflow-auto scrollbar-thin">
                {metrics.regioesOportunidade.map((r) => (
                  <li key={r.cidade} className="flex justify-between">
                    <span className="truncate mr-2">{r.cidade}</span>
                    <span className="text-[hsl(215,16%,57%)] whitespace-nowrap">{r.totalAcoes} acoes</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-[hsl(215,16%,57%)]">Nenhuma identificada</p>}
          </div>
        </div>

        {metrics.alertas.length > 0 && (
          <>
            <SectionTitle icon={<AlertTriangle />} title="ALERTAS CRITICOS" />
            <div className="bg-[hsl(0,84%,10%)] border border-[hsl(0,84%,25%)] rounded-lg p-5 space-y-2">
              {metrics.alertas.map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-[hsl(0,84%,60%)] mt-0.5 shrink-0" />
                  <span>{a}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <SectionTitle icon={<Flame />} title="MENSAGEM ESTRATEGICA" />
        <div className="bg-gradient-to-br from-[hsl(222,47%,9%)] to-[hsl(217,33%,12%)] border border-[hsl(217,33%,20%)] rounded-lg p-6">
          <StrategicMessage metrics={metrics} metaAnual={META_ANUAL} />
        </div>

        <SectionTitle icon={<Zap />} title="PLANO DE ACAO — PROXIMOS 7 DIAS" />
        <ActionPlan metrics={metrics} />
      </div>
      )}
    </div>
  );
};

export default PerformanceComercial;
