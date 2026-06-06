import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DollarSign, TrendingUp, Target, ShoppingCart, AlertTriangle,
  Lightbulb, RefreshCw, BarChart3, Loader2, ChevronDown,
  Wallet, ArrowDownUp, Percent,
} from "lucide-react";
import { BarChart, LineChart, PieChart, ComboChart } from "@/components/bi/charts";
import type { PieChartData } from "@/components/bi/charts";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Filters, DadosComerciais } from "@/types/comercial";
import { useNegociosData, NegociosSummary } from "@/hooks/useNegociosData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatMonthYear } from "@/lib/dateUtils";

interface Props {
  filters: Filters;
  crmData: DadosComerciais;
}


const fmtCurrency = (v: number) => {
  const n = isFinite(v) ? v : 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

const fmtCurrencyShort = (v: number) => {
  const n = isFinite(v) ? v : 0;
  if (n >= 1e6) return `R$ ${(n / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  if (n >= 1e3) return `R$ ${(n / 1e3).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}K`;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

interface AIInsight {
  titulo: string;
  descricao: string;
  tipo: string;
}
interface AIAlert {
  titulo: string;
  descricao: string;
  severidade: string;
}
interface AIAnalysis {
  insights: AIInsight[];
  alertas: AIAlert[];
  cruzamento_obs: string;
}

import type { ClienteDetalhe } from "@/hooks/useNegociosData";

interface ConsultorRow {
  nome: string;
  total: number;
  valor: number;
  ganhos: number;
  conversao: number;
  ticketMedio: number;
  clientesAtendidos: number;
  clientes: ClienteDetalhe[];
}

const ConsultorExpandableRow = ({ consultor: c }: { consultor: ConsultorRow }) => {
  const [open, setOpen] = useState(false);
  const totals = useMemo(() => {
    return c.clientes.reduce(
      (acc, cli) => ({
        valorTotal: acc.valorTotal + cli.valorTotal,
        recebido: acc.recebido + cli.recebido,
        valorUsado: acc.valorUsado + cli.valorUsado,
      }),
      { valorTotal: 0, recebido: 0, valorUsado: 0 }
    );
  }, [c.clientes]);

  return (
    <>
      <tr
        className="border-b border-border/50 hover:bg-muted/50 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <td className="py-2 px-3">
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </td>
        <td className="py-2 px-3 font-medium">{c.nome}</td>
        <td className="text-right py-2 px-3">{c.total}</td>
        <td className="text-right py-2 px-3">{c.ganhos}</td>
        <td className="text-right py-2 px-3">
          <div className="flex flex-col items-end">
            <Badge variant={c.conversao >= 50 ? "default" : c.conversao >= 25 ? "secondary" : "destructive"}>
              {c.conversao}%
            </Badge>
            <span className="text-[10px] text-muted-foreground mt-0.5">{c.total}/{c.clientesAtendidos || "?"}</span>
          </div>
        </td>
        <td className="text-right py-2 px-3">{fmtCurrency(c.valor)}</td>
        <td className="text-right py-2 px-3">{fmtCurrency(c.ticketMedio)}</td>
      </tr>
      {open && (
        <>
          <tr className="bg-muted/30">
            <td colSpan={2} className="py-1.5 px-3 pl-10 text-xs font-semibold text-muted-foreground">Cliente</td>
            <td className="text-right py-1.5 px-3 text-xs font-semibold text-muted-foreground" colSpan={2}>Valor do Negócio</td>
            <td className="text-right py-1.5 px-3 text-xs font-semibold text-muted-foreground">Recebido</td>
            <td className="text-right py-1.5 px-3 text-xs font-semibold text-muted-foreground">Valor Usado</td>
            <td></td>
          </tr>
          {c.clientes.map((cli) => (
            <tr key={cli.cliente} className="bg-muted/20 border-b border-border/30 hover:bg-muted/40">
              <td colSpan={2} className="py-1.5 px-3 pl-10 text-xs">{cli.cliente}</td>
              <td className="text-right py-1.5 px-3 text-xs" colSpan={2}>{fmtCurrency(cli.valorTotal)}</td>
              <td className="text-right py-1.5 px-3 text-xs">{fmtCurrency(cli.recebido)}</td>
              <td className="text-right py-1.5 px-3 text-xs">{fmtCurrency(cli.valorUsado)}</td>
              <td></td>
            </tr>
          ))}
          <tr className="bg-muted/40 border-b border-border font-semibold">
            <td colSpan={2} className="py-1.5 px-3 pl-10 text-xs">Total</td>
            <td className="text-right py-1.5 px-3 text-xs" colSpan={2}>{fmtCurrency(totals.valorTotal)}</td>
            <td className="text-right py-1.5 px-3 text-xs">{fmtCurrency(totals.recebido)}</td>
            <td className="text-right py-1.5 px-3 text-xs">{fmtCurrency(totals.valorUsado)}</td>
            <td></td>
          </tr>
        </>
      )}
    </>
  );
};

export const DashboardNegociosMensais = ({ filters, crmData }: Props) => {
  const { summary, isLoading, error } = useNegociosData(filters);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Cross-reference: visitas vs negocios per consultor
  const crossRef = useMemo(() => {
    if (!summary || !crmData) return [];
    const visitaMap = new Map<string, number>();
    for (const r of crmData.registrosRecentes) {
      if (r.tipoContato?.toLowerCase().includes("visita") && r.vendedor) {
        visitaMap.set(r.vendedor, (visitaMap.get(r.vendedor) || 0) + 1);
      }
    }
    return summary.porConsultor.map((c) => {
      // Normalize names for matching
      const normalName = c.nome.toUpperCase().trim();
      let visitas = 0;
      for (const [k, v] of visitaMap) {
        if (k.toUpperCase().trim() === normalName) { visitas = v; break; }
      }
      return { nome: c.nome.split(" ").slice(-1)[0], visitas, negocios: c.total, ganhos: c.ganhos, conversao: c.conversao, full: c.nome };
    }).filter((c) => c.visitas > 0 || c.negocios > 0).slice(0, 15);
  }, [summary, crmData]);

  // Tipo de ação vs fechamento (from CRM)
  const acaoVsFechamento = useMemo(() => {
    if (!summary || !crmData) return [];
    const tipoMap = new Map<string, { acoes: number; fechamentos: number }>();
    for (const r of crmData.registrosRecentes) {
      if (!r.tipoAcao) continue;
      if (!tipoMap.has(r.tipoAcao)) tipoMap.set(r.tipoAcao, { acoes: 0, fechamentos: 0 });
      tipoMap.get(r.tipoAcao)!.acoes++;
    }
    // Count negocios "Ganho" per etapa from CRM data
    for (const r of crmData.registrosRecentes) {
      if (r.tipoAcao && r.negocioValor > 0) {
        if (tipoMap.has(r.tipoAcao)) tipoMap.get(r.tipoAcao)!.fechamentos++;
      }
    }
    return Array.from(tipoMap.entries())
      .map(([tipo, v]) => ({ tipo, ...v, taxa: v.acoes > 0 ? Math.round((v.fechamentos / v.acoes) * 100) : 0 }))
      .sort((a, b) => b.acoes - a.acoes)
      .slice(0, 10);
  }, [summary, crmData]);

  const loadAIInsights = async () => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("negocios-insights");
      if (error) throw error;
      setAiAnalysis(data as AIAnalysis);
    } catch (err: any) {
      toast({ title: "Erro ao gerar insights", description: err.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (isLoading || !summary) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-5 gap-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        <div className="grid grid-cols-2 gap-6"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
      </div>
    );
  }

  const kpis = [
    { label: "Total Negócios", value: summary.totalNegocios.toString(), icon: ShoppingCart, color: "text-primary" },
    { label: "Total Negociado", value: fmtCurrencyShort(summary.totalValor), icon: DollarSign, color: "text-warning" },
    { label: "Ticket Médio", value: fmtCurrencyShort(summary.ticketMedio), icon: BarChart3, color: "text-info" },
    { label: "Conversão", value: `${summary.taxaConversao}%`, subtitle: `${summary.totalNegocios} neg / ${summary.clientesAtendidos} cli`, icon: Target, color: "text-accent" },
    { label: "Ganhos", value: summary.ganhos.toString(), icon: TrendingUp, color: "text-success" },
  ];

  // Financial performance classification
  const usadoClassification = summary.percentUsado <= 10 ? "healthy" : summary.percentUsado <= 16 ? "warning" : "critical";
  const usadoLabel = usadoClassification === "healthy" ? "✅ Saudável" : usadoClassification === "warning" ? "⚠️ Alerta" : "❌ Crítico";
  const usadoBorderColor = usadoClassification === "healthy" ? "border-l-green-500" : usadoClassification === "warning" ? "border-l-yellow-500" : "border-l-red-500";
  const usadoTextColor = usadoClassification === "healthy" ? "text-green-600" : usadoClassification === "warning" ? "text-yellow-600" : "text-red-600";

  // Automatic financial alerts
  const financialAlerts: { titulo: string; descricao: string; severidade: "alta" | "media" | "baixa" }[] = [];
  if (summary.totalValor > 0 && summary.totalRecebido < summary.totalValor * 0.5) {
    financialAlerts.push({ titulo: "Alerta de Caixa", descricao: `Alto volume de vendas (${fmtCurrency(summary.totalValor)}) com baixa entrada de caixa (${fmtCurrency(summary.totalRecebido)}). Dependência elevada da venda de equipamentos usados.`, severidade: "alta" });
  }
  if (summary.percentUsado > 16) {
    financialAlerts.push({ titulo: "Performance Comercial Comprometida", descricao: `% Usado sobre venda em ${summary.percentUsado.toFixed(1)}% (acima de 16%). Alto volume de usados nos negócios, impactando diretamente o caixa da empresa.`, severidade: "alta" });
  } else if (summary.percentUsado > 10) {
    financialAlerts.push({ titulo: "% Usado em Zona de Alerta", descricao: `% Usado sobre venda em ${summary.percentUsado.toFixed(1)}% (entre 10% e 16%). Monitorar para evitar impacto no caixa.`, severidade: "media" });
  }
  // Per-consultant alerts
  const consultoresAltoUsado = summary.porConsultor.filter(c => c.percentUsado > 16 && c.valor > 0);
  for (const c of consultoresAltoUsado.slice(0, 3)) {
    financialAlerts.push({ titulo: `Consultor ${c.nome.split(" ").slice(-1)[0]} – Alto Usado`, descricao: `Consultor ${c.nome} apresenta ${c.percentUsado.toFixed(1)}% de usado sobre vendas (${fmtCurrency(c.usado)} de usado em ${fmtCurrency(c.valor)} negociados), gerando baixa entrada de caixa (${fmtCurrency(c.recebido)}).`, severidade: "alta" });
  }

  const conclusaoData = [
    { name: "Ganho", value: summary.ganhos },
    { name: "Em andamento", value: summary.emAndamento },
    { name: "Perdido", value: summary.perdidos },
  ].filter((d) => d.value > 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Negócios Mensais</h2>
        <p className="text-sm text-muted-foreground">Análise integrada de negócios e pedidos</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              <p className="text-2xl font-bold mt-2">{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              {"subtitle" in kpi && (kpi as any).subtitle && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{(kpi as any).subtitle}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-green-600" />
              <p className="text-xs text-muted-foreground font-medium">💰 Valor Recebido</p>
            </div>
            <p className="text-2xl font-bold mt-2 text-green-600">{fmtCurrencyShort(summary.totalRecebido)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Entrada efetiva de caixa</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <ArrowDownUp className="h-5 w-5 text-orange-600" />
              <p className="text-xs text-muted-foreground font-medium">📦 Total de Usado</p>
            </div>
            <p className="text-2xl font-bold mt-2 text-orange-600">{fmtCurrencyShort(summary.totalUsado)}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Equipamentos usados recebidos</p>
          </CardContent>
        </Card>
        <Card className={`border-0 shadow-sm border-l-4 ${usadoBorderColor}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Percent className="h-5 w-5 ${usadoTextColor}" />
              <p className="text-xs text-muted-foreground font-medium">📉 % Usado sobre Venda</p>
            </div>
            <p className={`text-2xl font-bold mt-2 ${usadoTextColor}`}>{summary.percentUsado.toFixed(1)}%</p>
            <Badge variant={usadoClassification === "healthy" ? "default" : usadoClassification === "warning" ? "secondary" : "destructive"} className="text-[10px] mt-1">
              {usadoLabel}
            </Badge>
            <p className="text-[10px] text-muted-foreground mt-1">
              {usadoClassification === "healthy" ? "5-10% ideal" : usadoClassification === "warning" ? "10-16% atenção" : ">16% crítico"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Financial Alerts */}
      {financialAlerts.length > 0 && (
        <Card className="border-0 shadow-sm border-l-4 border-l-red-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Alertas Financeiros Automáticos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {financialAlerts.map((alerta, i) => (
              <div key={i} className={`p-3 rounded-lg border ${
                alerta.severidade === "alta" ? "bg-destructive/5 border-destructive/30" :
                alerta.severidade === "media" ? "bg-warning/5 border-warning/30" :
                "bg-muted/50 border-border/50"
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant={alerta.severidade === "alta" ? "destructive" : "secondary"} className="text-xs">
                    {alerta.severidade.toUpperCase()}
                  </Badge>
                  <span className="font-medium text-sm">{alerta.titulo}</span>
                </div>
                <p className="text-sm text-muted-foreground">{alerta.descricao}</p>
              </div>
            ))}
            <p className="text-xs text-muted-foreground mt-2">Calculado a partir dos negócios do período (VW_Ceres_Negocios_Mensais)</p>
          </CardContent>
        </Card>
      )}

      {/* Charts Row 1 */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Evolução Mensal */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Evolução Mensal de Negócios <InfoTooltip text="Por data de cadastro do negócio" /></CardTitle>
          </CardHeader>
          <CardContent>
            <ComboChart
              data={summary.evolucaoMensal.map((d) => ({ name: formatMonthYear(d.mes), total: d.total, ganhos: d.ganhos, valor: d.valor }))}
              barKeys={["total", "ganhos"]}
              lineKey="valor"
              seriesLabels={{ total: "Negócios", ganhos: "Ganhos", valor: "Valor" }}
              height={280}
              tooltipFormatter={(v, key) => key === "valor" ? fmtCurrency(v) : v.toString()}
            />
          </CardContent>
        </Card>

        {/* Ranking Consultores */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Ranking Consultores por Negócios</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={summary.porConsultor.slice(0, 10).map((c) => ({ name: c.nome.split(" ").slice(-1)[0], valor: c.valor }))}
              layout="horizontal"
              keys={["valor"]}
              height={280}
              tooltipFormatter={(v) => fmtCurrency(v)}
              seriesLabels={{ valor: "Valor" }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Status dos Negócios */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Status dos Negócios</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <PieChart
              data={conclusaoData.map((d): PieChartData => ({ id: d.name, name: d.name, value: d.value }))}
              height={220}
              enableLabels
              colors={["#26a503", "#3b82f6", "#ef4444"]}
            />
          </CardContent>
        </Card>

        {/* Regiões */}
        <Card className="border-0 shadow-sm col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Regiões por Volume de Negócios</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={summary.porRegiao.slice(0, 10).map((r) => ({ name: r.regiao, valor: r.valor }))}
              layout="vertical"
              keys={["valor"]}
              height={220}
              tooltipFormatter={(v) => fmtCurrency(v)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Comparativo Visitas vs Vendas */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Comparativo: Visitas CRM vs Negócios Fechados</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart
            data={crossRef.map((c) => ({ name: c.nome, visitas: c.visitas, negocios: c.negocios, ganhos: c.ganhos }))}
            layout="vertical"
            keys={["visitas", "negocios", "ganhos"]}
            height={300}
            seriesLabels={{ visitas: "Visitas (CRM)", negocios: "Negócios", ganhos: "Ganhos" }}
          />
        </CardContent>
      </Card>

      {/* Tipo de Ação vs Fechamento */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Relação Tipo de Ação vs Fechamento (CRM)</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart
            data={acaoVsFechamento.map((a) => ({ name: a.tipo, acoes: a.acoes, fechamentos: a.fechamentos }))}
            layout="horizontal"
            keys={["acoes", "fechamentos"]}
            height={250}
            seriesLabels={{ acoes: "Ações", fechamentos: "Com Negócio" }}
          />
        </CardContent>
      </Card>

      {/* Tabela Conversão por Consultor */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Taxa de Conversão e Ticket Médio por Consultor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium w-8"></th>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">Consultor</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Negócios</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Ganhos</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Conversão</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Valor Total</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">Ticket Médio</th>
                </tr>
              </thead>
              <tbody>
                {summary.porConsultor.map((c) => (
                  <ConsultorExpandableRow key={c.nome} consultor={c} />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* AI Insights Section */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-warning" />
              Insights com IA
            </CardTitle>
            <Button size="sm" variant="outline" onClick={loadAIInsights} disabled={aiLoading}>
              {aiLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              {aiLoading ? "Analisando..." : "Gerar Insights"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {!aiAnalysis && !aiLoading && (
            <p className="text-muted-foreground text-sm text-center py-8">
              Clique em "Gerar Insights" para uma análise detalhada com inteligência artificial
            </p>
          )}
          {aiAnalysis && (
            <div className="space-y-6">
              {/* Insights */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Insights</h3>
                {aiAnalysis.insights.map((insight, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/50 border border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-xs">
                        {insight.tipo === "padrao" ? "📊 Padrão" : insight.tipo === "oportunidade" ? "🎯 Oportunidade" : insight.tipo === "gargalo" ? "⚠️ Gargalo" : "🚀 Ação"}
                      </Badge>
                      <span className="font-medium text-sm">{insight.titulo}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{insight.descricao}</p>
                  </div>
                ))}
              </div>

              {/* Cruzamento Observações */}
              {aiAnalysis.cruzamento_obs && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Cruzamento: Observações × Negócios</h3>
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-sm text-foreground">{aiAnalysis.cruzamento_obs}</p>
                  </div>
                </div>
              )}

              {/* Alertas */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Alertas
                </h3>
                {aiAnalysis.alertas.map((alerta, i) => (
                  <div key={i} className={`p-3 rounded-lg border ${
                    alerta.severidade === "alta" ? "bg-destructive/5 border-destructive/30" :
                    alerta.severidade === "media" ? "bg-warning/5 border-warning/30" :
                    "bg-muted/50 border-border/50"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={alerta.severidade === "alta" ? "destructive" : "secondary"} className="text-xs">
                        {alerta.severidade.toUpperCase()}
                      </Badge>
                      <span className="font-medium text-sm">{alerta.titulo}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{alerta.descricao}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
