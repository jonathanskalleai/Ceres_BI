import { useState, useMemo } from "react";
import { useComercialData } from "@/hooks/useComercialData";
import { useNegociosData } from "@/hooks/useNegociosData";
import { isAdminUser } from "@/lib/adminUsers";
import { filterRegistros } from "@/lib/filterUtils";
import { Filters } from "@/types/comercial";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Target, TrendingUp, AlertTriangle, Flame, Zap, Users, MapPin, Presentation, Banknote } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMeta } from "@/hooks/useMeta";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";
import { Apresentacao2026 } from "@/components/performance/Apresentacao2026";

const REALIZADO = 6_300_000;
const MESES_ANO = 12;

interface ClientePotencial { nome: string; acoes: number; valor: number; cidade: string }
interface RegiaoOportunidade { cidade: string; totalAcoes: number; pipeline: number }
interface Metrics {
  realizado: number; pctAtingido: number; gap: number; mesesPassados: number; mesesRestantes: number;
  mediaAtual: number; mediaNecessaria: number; projecaoAnual: number; noRitmo: boolean;
  clientesPotencial: ClientePotencial[]; regioesOportunidade: RegiaoOportunidade[]; alertas: string[];
  taxaConversao: number; negociosAbertos: number;
  totalRecebido: number; totalUsado: number; projecaoRecebido: number; pctUsadoSobreVenda: number; pctRecebidoSobreVenda: number;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const emptyFilters: Filters = { vendedor: "", cidade: "", periodo: "", ano: "2026", mes: "", tipoAcao: "" };

const PerformanceComercial = () => {
  const navigate = useNavigate();
  const { data, isLoading: loadingCRM, error: errorCRM } = useComercialData();
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [activeTab, setActiveTab] = useState<"dashboard" | "apresentacao">("dashboard");
  const { summary: negociosSummary, isLoading: loadingNeg, error: errorNeg } = useNegociosData(filters);
  const { metaAnual: META_ANUAL } = useMeta(2026);

  const isLoading = loadingCRM || loadingNeg;
  const error = errorCRM || errorNeg;

  // Derived data
  const metrics = useMemo(() => {
    if (!negociosSummary || !data) return null;

    const realizado = negociosSummary.totalValor || REALIZADO;
    const pctAtingido = (realizado / META_ANUAL) * 100;
    const gap = META_ANUAL - realizado;
    const mesesPassados = negociosSummary.evolucaoMensal.length || 3;
    const mesesRestantes = Math.max(1, MESES_ANO - mesesPassados);
    const mediaAtual = mesesPassados > 0 ? realizado / mesesPassados : 0;
    const mediaNecessaria = mesesRestantes > 0 ? gap / mesesRestantes : 0;
    const projecaoAnual = mediaAtual * MESES_ANO;
    const noRitmo = mediaAtual >= (META_ANUAL / MESES_ANO);

    // Total Recebido (soma direta da coluna recebido) e Usados
    const totalRecebido = negociosSummary.registros.reduce((s, r) => s + (r.recebido || 0), 0);
    const totalUsado = negociosSummary.registros.reduce((s, r) => s + (r.pdo_vlr_recurso_proprio || 0), 0);
    const projecaoRecebido = mesesPassados > 0 ? (totalRecebido / mesesPassados) * MESES_ANO : 0;
    const pctUsadoSobreVenda = realizado > 0 ? (totalUsado / realizado) * 100 : 0;
    const pctRecebidoSobreVenda = realizado > 0 ? (totalRecebido / realizado) * 100 : 0;

    // Consultores filtrados (usados no cálculo de alertas)
    const consultores = (negociosSummary.porConsultor || []).filter(c => !isAdminUser(c.nome));

    // Registros filtrados
    const regs = data ? filterRegistros(data.registrosRecentes, filters) : [];

    // Clientes com potencial (alto volume de ações sem negócio fechado)
    const clienteAcoes = new Map<string, { acoes: number; valor: number; cidade: string }>();
    for (const r of regs) {
      if (!clienteAcoes.has(r.cliente)) clienteAcoes.set(r.cliente, { acoes: 0, valor: 0, cidade: r.cidade });
      const c = clienteAcoes.get(r.cliente)!;
      c.acoes++;
      c.valor += r.negocioValor;
    }
    const clientesPotencial = Array.from(clienteAcoes.entries())
      .filter(([, c]) => c.acoes >= 3 && c.valor === 0)
      .sort((a, b) => b[1].acoes - a[1].acoes)
      .slice(0, 10)
      .map(([nome, c]) => ({ nome, ...c }));

    // Regiões com alta atividade e baixo fechamento
    const regioesOportunidade = (data?.regioes || [])
      .filter(r => r.totalAcoes > 5 && r.pipeline === 0)
      .sort((a, b) => b.totalAcoes - a.totalAcoes)
      .slice(0, 8);

    // Alertas
    const alertas: string[] = [];
    for (const c of consultores) {
      if (c.conversao < 5 && c.total > 0) alertas.push(`${c.nome}: conversão de apenas ${c.conversao}%`);
    }
    // Consultores com muitas visitas e poucos resultados
    const vendedoresCRM = (data?.vendedores || []).filter(v => !isAdminUser(v.nome));
    for (const v of vendedoresCRM) {
      const neg = consultores.find(c => c.nome === v.nome);
      if (v.visitas > 20 && (!neg || neg.total === 0)) {
        alertas.push(`${v.nome}: ${v.visitas} visitas sem nenhum negócio fechado`);
      }
    }

    // Alerta de exposição a usados
    if (pctUsadoSobreVenda > 30) {
      alertas.push(`⚠️ ${fmtPct(pctUsadoSobreVenda)} do faturamento está comprometido com equipamentos usados recebidos como parte de pagamento`);
    }

    return {
      realizado, pctAtingido, gap, mesesPassados, mesesRestantes,
      mediaAtual, mediaNecessaria, projecaoAnual, noRitmo,
      clientesPotencial, regioesOportunidade, alertas,
      taxaConversao: negociosSummary.taxaConversao,
      negociosAbertos: negociosSummary.emAndamento,
      totalRecebido,
      totalUsado,
      projecaoRecebido,
      pctUsadoSobreVenda,
      pctRecebidoSobreVenda,
    };
  }, [negociosSummary, data, filters, META_ANUAL]);

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

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] text-[hsl(210,40%,96%)] flex flex-col">
      {/* Header */}
      <div className="border-b border-[hsl(217,33%,17%)] px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-[hsl(210,40%,96%)] hover:bg-[hsl(217,33%,17%)]">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-black tracking-tight">⚡ PERFORMANCE COMERCIAL 2026</h1>
            <p className="text-xs text-[hsl(215,16%,57%)]">Painel de Guerra — Ceres Equipamentos Agrícolas</p>
          </div>
          {/* Tabs */}
          <div className="flex items-center gap-1 ml-6 bg-[hsl(217,33%,12%)] rounded-lg p-1">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${activeTab === "dashboard" ? "bg-[hsl(217,91%,60%)] text-[hsl(0,0%,100%)]" : "text-[hsl(215,16%,57%)] hover:text-[hsl(210,40%,96%)]"}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab("apresentacao")}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all flex items-center gap-2 ${activeTab === "apresentacao" ? "bg-[hsl(217,91%,60%)] text-[hsl(0,0%,100%)]" : "text-[hsl(215,16%,57%)] hover:text-[hsl(210,40%,96%)]"}`}
            >
              <Presentation className="h-4 w-4" />
              Apresentação 2026
            </button>
          </div>
        </div>
        {activeTab === "dashboard" && (
          <div className="flex items-center gap-3">
            <Select value={filters.vendedor || "all"} onValueChange={(v) => setFilters(f => ({ ...f, vendedor: v === "all" ? "" : v }))}>
              <SelectTrigger className="w-48 bg-[hsl(217,33%,17%)] border-[hsl(217,33%,20%)] text-[hsl(210,40%,96%)]">
                <Users className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Consultor" />
              </SelectTrigger>
              <SelectContent className="bg-[hsl(222,47%,9%)] border-[hsl(217,33%,17%)]">
                <SelectItem value="all">Todos Consultores</SelectItem>
                {(data?.listaVendedores || []).filter(v => !isAdminUser(v)).sort().map(v => (
                  <SelectItem key={v} value={v}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.cidade || "all"} onValueChange={(v) => setFilters(f => ({ ...f, cidade: v === "all" ? "" : v }))}>
              <SelectTrigger className="w-44 bg-[hsl(217,33%,17%)] border-[hsl(217,33%,20%)] text-[hsl(210,40%,96%)]">
                <MapPin className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Região" />
              </SelectTrigger>
              <SelectContent className="bg-[hsl(222,47%,9%)] border-[hsl(217,33%,17%)]">
                <SelectItem value="all">Todas Regiões</SelectItem>
                {(data?.listaCidades || []).sort().map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <a
              href="/"
              className="ml-auto text-xs text-[hsl(215,16%,57%)] hover:text-[hsl(210,40%,96%)] flex items-center gap-1"
              title="Ver análise de funil e ranking no Dashboard BI"
            >
              Ver análise completa no BI →
            </a>
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
        {/* Section 1: Big Numbers */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <BigCard label="META ANUAL" value={fmt(META_ANUAL)} icon={<Target className="h-6 w-6" />} color="hsl(217,91%,60%)" />
          <BigCard label="REALIZADO" value={fmt(metrics.realizado)} icon={<TrendingUp className="h-6 w-6" />} color="hsl(152,69%,40%)" sub={fmtPct(metrics.pctAtingido) + " da meta"} />
          <BigCard label="RECEBIDO TOTAL" value={fmt(metrics.totalRecebido)} icon={<Banknote className="h-6 w-6" />} color="hsl(38,92%,50%)" sub={`${fmtPct(metrics.pctRecebidoSobreVenda)} do vendido | Usados: ${fmt(metrics.totalUsado)}`} />
          <BigCard label="GAP" value={fmt(metrics.gap)} icon={<AlertTriangle className="h-6 w-6" />} color="hsl(0,84%,60%)" sub="Falta para bater" />
          <BigCard label="% ATINGIDO" value={fmtPct(metrics.pctAtingido)} icon={<Flame className="h-6 w-6" />} color={riskColor} large />
        </div>

        {/* Section 2: Velocidade */}
        <SectionTitle icon={<Zap />} title="VELOCIDADE NECESSÁRIA" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard label="Média Mensal Necessária" value={fmt(metrics.mediaNecessaria)} status="neutral" />
          <MetricCard label="Média Atual de Vendas" value={fmt(metrics.mediaAtual)} status={metrics.noRitmo ? "ok" : "danger"} />
          <MetricCard label="Diferença" value={fmt(metrics.mediaAtual - (META_ANUAL / MESES_ANO))} status={metrics.noRitmo ? "ok" : "danger"} sub={metrics.noRitmo ? "No ritmo ✅" : "Abaixo do necessário ⚠️"} />
        </div>

        {/* Section 4: Pressão do Resultado */}
        <SectionTitle icon={<AlertTriangle />} title="PRESSÃO DO RESULTADO" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[hsl(222,47%,9%)] border border-[hsl(217,33%,17%)] rounded-lg p-6">
            <p className="text-[hsl(215,16%,57%)] text-sm mb-3">Se continuarmos nesse ritmo...</p>
            <p className="text-4xl font-black" style={{ color: metrics.projecaoAnual >= META_ANUAL ? "hsl(152,69%,40%)" : "hsl(0,84%,60%)" }}>
              {fmt(metrics.projecaoAnual)}
            </p>
            <p className="text-sm text-[hsl(215,16%,57%)] mt-1">Projeção de fechamento anual</p>
            <div className="mt-4 h-3 rounded-full bg-[hsl(217,33%,17%)] overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, (metrics.projecaoAnual / META_ANUAL) * 100)}%`, background: metrics.projecaoAnual >= META_ANUAL ? "hsl(152,69%,40%)" : "hsl(0,84%,60%)" }} />
            </div>
            <div className="flex justify-between text-xs text-[hsl(215,16%,57%)] mt-1">
              <span>Projeção: {fmtPct((metrics.projecaoAnual / META_ANUAL) * 100)}</span>
              <span>Meta: {fmt(META_ANUAL)}</span>
            </div>
          </div>
          <div className="bg-[hsl(222,47%,9%)] border border-[hsl(38,92%,25%)] rounded-lg p-6">
            <div className="flex items-center gap-2 mb-3">
              <Banknote className="h-4 w-4 text-[hsl(38,92%,50%)]" />
              <p className="text-[hsl(38,92%,50%)] text-sm font-bold">Projeção Recebido Total</p>
            </div>
            <p className="text-4xl font-black text-[hsl(38,92%,50%)]">
              {fmt(metrics.projecaoRecebido)}
            </p>
            <p className="text-xs text-[hsl(215,16%,57%)] mt-2">Valor em dinheiro projetado para o ano (coluna Recebido)</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="bg-[hsl(217,33%,12%)] rounded p-2 text-center">
                <p className="text-xs text-[hsl(215,16%,57%)]">Usados Projetados</p>
                <p className="text-sm font-bold text-[hsl(0,84%,60%)]">{fmt(metrics.projecaoAnual - metrics.projecaoRecebido)}</p>
              </div>
              <div className="bg-[hsl(217,33%,12%)] rounded p-2 text-center">
                <p className="text-xs text-[hsl(215,16%,57%)]">% em Usados</p>
                <p className="text-sm font-bold text-[hsl(0,84%,60%)]">{fmtPct(metrics.pctUsadoSobreVenda)}</p>
              </div>
            </div>
          </div>
          <div className="bg-[hsl(222,47%,9%)] border border-[hsl(217,33%,17%)] rounded-lg p-6">
            <p className="text-[hsl(215,16%,57%)] text-sm mb-3">Comparativo</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={[
                { name: "Meta", valor: META_ANUAL },
                { name: "Projeção Venda", valor: metrics.projecaoAnual },
                { name: "Proj. Recebido", valor: metrics.projecaoRecebido },
                { name: "Realizado", valor: metrics.realizado },
                { name: "Recebido Total", valor: metrics.totalRecebido },
              ]} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(217,33%,17%)" />
                <XAxis type="number" tick={{ fill: "hsl(215,16%,57%)", fontSize: 11 }} tickFormatter={(v) => `${(v / 1e6).toFixed(0)}M`} />
                <YAxis type="category" dataKey="name" tick={{ fill: "hsl(210,40%,96%)", fontSize: 11, fontWeight: 600 }} width={100} />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "hsl(222,47%,9%)", border: "1px solid hsl(217,33%,17%)", borderRadius: 8, color: "hsl(210,40%,96%)" }} />
                <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                  <Cell fill="hsl(217,91%,60%)" />
                  <Cell fill={metrics.projecaoAnual >= META_ANUAL ? "hsl(152,69%,40%)" : "hsl(38,92%,50%)"} />
                  <Cell fill="hsl(38,92%,50%)" />
                  <Cell fill="hsl(152,69%,40%)" />
                  <Cell fill="hsl(38,72%,45%)" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Section 6: Oportunidades */}
        <SectionTitle icon={<Target />} title="OPORTUNIDADES ESCONDIDAS" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[hsl(222,47%,9%)] border border-[hsl(217,33%,17%)] rounded-lg p-5">
            <h4 className="text-sm font-semibold text-[hsl(38,92%,50%)] mb-3">Negócios em Aberto</h4>
            <p className="text-3xl font-black">{metrics.negociosAbertos}</p>
            <p className="text-xs text-[hsl(215,16%,57%)] mt-1">Negócios em andamento aguardando fechamento</p>
          </div>
          <div className="bg-[hsl(222,47%,9%)] border border-[hsl(217,33%,17%)] rounded-lg p-5">
            <h4 className="text-sm font-semibold text-[hsl(38,92%,50%)] mb-3">Clientes com Potencial Não Convertido</h4>
            {metrics.clientesPotencial.length > 0 ? (
              <ul className="space-y-1 text-sm max-h-40 overflow-auto scrollbar-thin">
                {metrics.clientesPotencial.map((c) => (
                  <li key={c.nome} className="flex justify-between">
                    <span className="truncate mr-2">{c.nome}</span>
                    <span className="text-[hsl(215,16%,57%)] whitespace-nowrap">{c.acoes} ações</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-[hsl(215,16%,57%)]">Nenhum identificado</p>}
          </div>
          <div className="bg-[hsl(222,47%,9%)] border border-[hsl(217,33%,17%)] rounded-lg p-5">
            <h4 className="text-sm font-semibold text-[hsl(38,92%,50%)] mb-3">Regiões: Alta Atividade, Baixo Fechamento</h4>
            {metrics.regioesOportunidade.length > 0 ? (
              <ul className="space-y-1 text-sm max-h-40 overflow-auto scrollbar-thin">
                {metrics.regioesOportunidade.map((r) => (
                  <li key={r.cidade} className="flex justify-between">
                    <span className="truncate mr-2">{r.cidade}</span>
                    <span className="text-[hsl(215,16%,57%)] whitespace-nowrap">{r.totalAcoes} ações</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-[hsl(215,16%,57%)]">Nenhuma identificada</p>}
          </div>
        </div>

        {/* Section 7: Alertas */}
        {metrics.alertas.length > 0 && (
          <>
            <SectionTitle icon={<AlertTriangle />} title="ALERTAS CRÍTICOS" />
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

        {/* Section 8: Mensagem Estratégica */}
        <SectionTitle icon={<Flame />} title="MENSAGEM ESTRATÉGICA" />
        <div className="bg-gradient-to-br from-[hsl(222,47%,9%)] to-[hsl(217,33%,12%)] border border-[hsl(217,33%,20%)] rounded-lg p-6">
          <StrategicMessage metrics={metrics} metaAnual={META_ANUAL} />
        </div>

        {/* Section 9: Plano de Ação */}
        <SectionTitle icon={<Zap />} title="PLANO DE AÇÃO — PRÓXIMOS 7 DIAS" />
        <ActionPlan metrics={metrics} />
      </div>
      )}
    </div>
  );
};

// --- Sub-components ---

function BigCard({ label, value, icon, color, sub, large }: { label: string; value: string; icon: React.ReactNode; color: string; sub?: string; large?: boolean }) {
  return (
    <div className="bg-[hsl(222,47%,9%)] border border-[hsl(217,33%,17%)] rounded-lg p-5 flex flex-col">
      <div className="flex items-center gap-2 mb-2" style={{ color }}>{icon}<span className="text-xs font-bold tracking-widest uppercase">{label}</span></div>
      <p className={`font-black ${large ? "text-5xl" : "text-3xl"}`} style={{ color }}>{value}</p>
      {sub && <p className="text-xs text-[hsl(215,16%,57%)] mt-1">{sub}</p>}
    </div>
  );
}

function MetricCard({ label, value, status, sub }: { label: string; value: string; status: "ok" | "danger" | "neutral"; sub?: string }) {
  const borderColor = status === "ok" ? "hsl(152,69%,25%)" : status === "danger" ? "hsl(0,84%,25%)" : "hsl(217,33%,17%)";
  const textColor = status === "ok" ? "hsl(152,69%,40%)" : status === "danger" ? "hsl(0,84%,60%)" : "hsl(210,40%,96%)";
  return (
    <div className="bg-[hsl(222,47%,9%)] rounded-lg p-5" style={{ border: `1px solid ${borderColor}` }}>
      <p className="text-xs font-semibold text-[hsl(215,16%,57%)] mb-1 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-black" style={{ color: textColor }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: textColor }}>{sub}</p>}
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <span className="text-[hsl(217,91%,60%)]">{icon}</span>
      <h2 className="text-lg font-black tracking-wide uppercase">{title}</h2>
      <div className="flex-1 h-px bg-[hsl(217,33%,17%)]" />
    </div>
  );
}

function StrategicMessage({ metrics, metaAnual }: { metrics: Metrics; metaAnual: number }) {
  const gap = metrics.gap;
  const mesesRestantes = metrics.mesesRestantes;
  const pct = metrics.pctAtingido;
  const proj = metrics.projecaoAnual;

  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <p className="text-lg font-bold text-[hsl(0,84%,60%)]">
        ⚠️ ATENÇÃO, TIME COMERCIAL
      </p>
      <p>
        Estamos com <strong>{fmtPct(pct)}</strong> da meta anual realizada. Faltam <strong>{fmt(gap)}</strong> para atingir a meta.
      </p>
      <p>
        No ritmo atual, a projeção de fechamento é de <strong>{fmt(proj)}</strong> — {proj >= metaAnual
          ? <span className="text-[hsl(152,69%,40%)] font-bold">estamos no caminho certo.</span>
          : <span className="text-[hsl(0,84%,60%)] font-bold">NÃO atingiremos a meta.</span>
        }
      </p>
      <p>
        Temos <strong>{mesesRestantes} meses</strong> restantes. Cada dia sem resultado é um dia mais perto de fechar abaixo do esperado.
      </p>
      <p className="text-[hsl(38,92%,50%)] font-bold">
        Não existe meio resultado. Ou entregamos, ou explicamos. O mercado não espera. O cliente não espera. A concorrência não para.
      </p>
      <p>
        Cada consultor precisa olhar para sua carteira AGORA. Não amanhã. AGORA. Onde estão os negócios que podem ser fechados essa semana?
        Onde estão os clientes que já foram visitados mas não receberam proposta?
      </p>
      <p className="font-bold text-lg">
        🎯 O desafio é claro. A responsabilidade é de TODOS. Vamos fazer acontecer.
      </p>
    </div>
  );
}

function ActionPlan({ metrics }: { metrics: Metrics }) {
  const actions = [
    {
      titulo: "Revisar todos os negócios em aberto",
      desc: `Existem ${metrics.negociosAbertos} negócios em andamento. Priorize os de maior valor e defina ações concretas para cada um.`,
      prazo: "Até sexta-feira",
    },
    {
      titulo: "Atacar clientes com potencial não convertido",
      desc: `${metrics.clientesPotencial.length} clientes com múltiplas interações e zero negócio fechado. Agende contato imediato.`,
      prazo: "Próximos 3 dias",
    },
    {
      titulo: "Aumentar taxa de conversão",
      desc: `Taxa atual: ${fmtPct(metrics.taxaConversao)}. Consultores com baixa conversão precisam de acompanhamento intensivo.`,
      prazo: "Contínuo",
    },
    {
      titulo: "Concentrar esforço nas regiões de alto potencial",
      desc: `${metrics.regioesOportunidade.length} regiões com alta atividade e baixo fechamento identificadas. Redirecionar foco comercial.`,
      prazo: "Próximos 7 dias",
    },
    {
      titulo: "Reunião de alinhamento semanal",
      desc: "Apresentar este painel toda segunda-feira. Cobrar metas individuais e definir compromissos semanais.",
      prazo: "Segunda-feira",
    },
  ];

  return (
    <div className="space-y-3">
      {actions.map((a, i) => (
        <div key={i} className="bg-[hsl(222,47%,9%)] border border-[hsl(217,33%,17%)] rounded-lg p-4 flex items-start gap-4">
          <span className="w-8 h-8 rounded-full bg-[hsl(217,91%,60%)] flex items-center justify-center text-sm font-bold text-[hsl(0,0%,100%)] shrink-0">
            {i + 1}
          </span>
          <div className="flex-1">
            <p className="font-bold text-sm">{a.titulo}</p>
            <p className="text-xs text-[hsl(215,16%,57%)] mt-0.5">{a.desc}</p>
          </div>
          <span className="text-xs bg-[hsl(217,33%,17%)] px-2 py-1 rounded whitespace-nowrap">{a.prazo}</span>
        </div>
      ))}
    </div>
  );
}

export default PerformanceComercial;
