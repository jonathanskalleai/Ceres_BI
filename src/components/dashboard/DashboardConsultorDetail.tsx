import { useState, useMemo } from "react";
import { Vendedor, Registro } from "@/types/comercial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, ChevronUp, Sparkles, Loader2 } from "lucide-react";
import { LineChart, BarChart, PieChart } from "@/components/bi/charts";
import type { PieChartData } from "@/components/bi/charts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatMonthYear } from "@/lib/dateUtils";

interface Props {
  vendedor: Vendedor;
  registros: Registro[];
  onBack: () => void;
}

const formatCurrency = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(0)}K` : `R$ ${v.toFixed(0)}`;

const crmGrade = (q: number) => {
  if (q >= 70) return { label: "A - Excelente", className: "bg-success text-success-foreground" };
  if (q >= 50) return { label: "B - Bom", className: "bg-warning text-warning-foreground" };
  if (q >= 30) return { label: "C - Regular", className: "bg-destructive/80 text-destructive-foreground" };
  return { label: "D - Insuficiente", className: "bg-destructive text-destructive-foreground" };
};

const formatDate = (d: string) => {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
};

export const DashboardConsultorDetail = ({ vendedor: v, registros, onBack }: Props) => {
  const grade = crmGrade(v.crmQuality);
  const tiposAcao = Object.entries(v.tiposAcao).map(([name, value]) => ({ name, value }));
  const [expandedClient, setExpandedClient] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});

  // Pre-compute last 5 actions per client from registros
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

  const toggleClient = (nome: string) => {
    setExpandedClient((prev) => (prev === nome ? null : nome));
  };

  const requestAiAnalysis = async (clienteNome: string) => {
    if (aiAnalysis[clienteNome]) return;
    setAiLoading((prev) => ({ ...prev, [clienteNome]: true }));

    try {
      const acoes = (clientActions.get(clienteNome) || []).map((r) => ({
        dtConclusao: r.dtConclusao,
        tipoContato: r.tipoContato,
        tipoAcao: r.tipoAcao,
        negocioValor: r.negocioValor,
        negocioEtapa: r.negocioEtapa,
        obs: r.obs,
      }));

      const { data, error } = await supabase.functions.invoke("client-ai-analysis", {
        body: { clienteNome, vendedorNome: v.nome, acoes },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAiAnalysis((prev) => ({ ...prev, [clienteNome]: data.analysis }));
    } catch (e: any) {
      console.error("AI analysis error:", e);
      toast.error(e.message || "Erro ao gerar análise de IA");
    } finally {
      setAiLoading((prev) => ({ ...prev, [clienteNome]: false }));
    }
  };

  const kpis = [
    { label: "Total Ações", value: v.totalAcoes.toString(), color: "text-primary" },
    { label: "Visitas", value: v.visitas.toString(), color: "text-accent" },
    { label: "Clientes", value: v.clientes.toString(), color: "text-info" },
    { label: "Pipeline", value: formatCurrency(v.pipeline), color: "text-warning" },
    { label: "Conversão", value: `${v.conversao}%`, color: "text-chart-4" },
    { label: "CRM Quality", value: `${v.crmQuality}%`, color: grade.className.includes("success") ? "text-success" : "text-destructive" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">{v.nome}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={grade.className}>{grade.label}</Badge>
            <span className="text-xs text-muted-foreground">{v.negocios} negócios registrados</span>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-[10px] text-muted-foreground">{k.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Evolução */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Evolução Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              series={[
                { name: "Ações", data: v.evolucao.map((d) => ({ x: formatMonthYear(d.YearMonth), y: d.acoes })) },
                { name: "Visitas", data: v.evolucao.map((d) => ({ x: formatMonthYear(d.YearMonth), y: d.visitas })) },
              ]}
              height={250}
            />
          </CardContent>
        </Card>

        {/* Tipos de Ação */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tipos de Ação</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <PieChart
              data={tiposAcao.map((t): PieChartData => ({ id: t.name, name: t.name, value: t.value }))}
              height={250}
              enableLabels
            />
          </CardContent>
        </Card>
      </div>

      {/* Top 10 Clientes — Expandable */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Top 10 Clientes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {/* Header */}
            <div className="grid grid-cols-[32px_1fr_100px_60px_60px_90px_80px_80px_32px] items-center px-2 py-2 border-b border-border text-xs font-semibold text-muted-foreground">
              <span>#</span>
              <span>Cliente</span>
              <span>Cidade</span>
              <span className="text-center">Ações</span>
              <span className="text-center">Visitas</span>
              <span className="text-right">Pipeline</span>
              <span className="text-center">Dias s/ Contato</span>
              <span className="text-center">Status</span>
              <span></span>
            </div>

            {v.topClientes.map((c, i) => {
              const isExpanded = expandedClient === c.nome;
              const actions = clientActions.get(c.nome) || [];
              const analysis = aiAnalysis[c.nome];
              const loading = aiLoading[c.nome];

              return (
                <div key={c.nome} className="border-b border-border/50">
                  {/* Main row */}
                  <button
                    onClick={() => toggleClient(c.nome)}
                    className="grid grid-cols-[32px_1fr_100px_60px_60px_90px_80px_80px_32px] items-center px-2 py-2.5 w-full text-left hover:bg-muted/30 transition-colors rounded"
                  >
                    <span className="text-xs font-semibold text-muted-foreground">{i + 1}</span>
                    <span className="text-xs font-medium truncate pr-2">{c.nome}</span>
                    <span className="text-xs text-muted-foreground">{c.cidade}</span>
                    <span className="text-xs text-center">{c.acoes}</span>
                    <span className="text-xs text-center">{c.visitas}</span>
                    <span className="text-xs text-right font-semibold">{formatCurrency(c.negocioValor)}</span>
                    <span className="flex justify-center">
                      <Badge variant={c.diasSemContato > 90 ? "destructive" : c.diasSemContato > 30 ? "outline" : "default"}
                        className="text-[10px]">
                        {c.diasSemContato}d
                      </Badge>
                    </span>
                    <span className="text-xs text-center">
                      {c.diasSemContato > 90 ? (
                        <span className="text-destructive font-medium">⚠️ Parado</span>
                      ) : c.negocioValor > 500000 ? (
                        <span className="text-success font-medium">🔥 Quente</span>
                      ) : (
                        <span className="text-muted-foreground">📋 Ativo</span>
                      )}
                    </span>
                    <span className="flex justify-center">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </span>
                  </button>

                  {/* Expanded content */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 bg-muted/20 rounded-b-lg space-y-4 animate-in slide-in-from-top-2 duration-200">
                      {/* Last 5 actions */}
                      <div>
                        <h5 className="text-xs font-semibold text-foreground mb-2">
                          Últimas {actions.length} Ações Registradas
                        </h5>
                        {actions.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">Nenhuma ação encontrada nos registros.</p>
                        ) : (
                          <div className="space-y-2">
                            {actions.map((a, idx) => (
                              <div key={idx} className="bg-card rounded-lg p-3 shadow-sm border border-border/50">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[10px]">{formatDate(a.dtConclusao)}</Badge>
                                    <Badge className="text-[10px] bg-primary/10 text-primary border-0">{a.tipoContato || "—"}</Badge>
                                    <Badge className="text-[10px] bg-accent/10 text-accent border-0">{a.tipoAcao || "—"}</Badge>
                                  </div>
                                  {a.negocioValor > 0 && (
                                    <span className="text-xs font-bold text-warning">{formatCurrency(a.negocioValor)}</span>
                                  )}
                                </div>
                                {a.negocioEtapa && (
                                  <p className="text-[10px] text-muted-foreground">Etapa: {a.negocioEtapa}</p>
                                )}
                                {a.obs && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.obs}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* AI Analysis */}
                      <div className="border-t border-border pt-3">
                        {!analysis && !loading && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              requestAiAnalysis(c.nome);
                            }}
                            className="gap-2"
                          >
                            <Sparkles className="h-3.5 w-3.5" />
                            Gerar Análise de IA para este cliente
                          </Button>
                        )}
                        {loading && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Analisando dados do cliente...
                          </div>
                        )}
                        {analysis && (
                          <div className="bg-card rounded-lg p-4 shadow-sm border border-primary/20">
                            <div className="flex items-center gap-2 mb-3">
                              <Sparkles className="h-4 w-4 text-primary" />
                              <h5 className="text-xs font-semibold text-primary">Análise de IA</h5>
                            </div>
                            <div className="text-xs text-foreground whitespace-pre-line leading-relaxed">
                              {analysis}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Regiões */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Regiões de Atuação</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart
            data={v.regioes.map((r) => ({ name: r.cidade, acoes: r.acoes }))}
            layout="vertical"
            keys={["acoes"]}
            height={200}
            tooltipFormatter={(val) => `${val} ações`}
          />
        </CardContent>
      </Card>
    </div>
  );
};
