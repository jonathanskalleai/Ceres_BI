import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Lightbulb, RefreshCw, Loader2 } from "lucide-react";
import { parseISO } from "date-fns";
import { aiNegociosInsights } from "@/services/aiService";
import { toast } from "@/hooks/use-toast";
import type { DadosComerciais, Filters } from "@/types/comercial";
import { useNegociosCrm } from "@/hooks/useNegociosCrm";
import { NegociosKPIs } from "./negocios/NegociosKPIs";
import { NegociosFinancialAlerts } from "./negocios/NegociosFinancialAlerts";
import { NegociosConsultorTable } from "./negocios/NegociosConsultorTable";
import { NegociosCharts } from "./negocios/NegociosCharts";

interface Props {
  filters: Filters;
  crmData: DadosComerciais;
}

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

export const DashboardNegociosMensais = ({ filters, crmData }: Props) => {
  // Convert CRM Filters (ISO strings) to DateRange (Date objects) for the hook
  const dateRange = useMemo(() => {
    if (!filters.dateRange) return undefined;
    return {
      from: parseISO(filters.dateRange.from),
      to: parseISO(filters.dateRange.to),
    };
  }, [filters.dateRange]);

  const { data: result, isLoading, error } = useNegociosCrm({
    dateRange,
    cidade: filters.cidade || undefined,
    vendedor: undefined, // CRM Filters doesn't have vendedor for this view
  });
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const loadAIInsights = async () => {
    setAiLoading(true);
    try {
      const { data, error: fnErr } = await aiNegociosInsights();
      if (fnErr) throw new Error(fnErr);
      setAiAnalysis(data as AIAnalysis);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ title: "Erro ao gerar insights", description: msg, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">{error.message}</p>
      </div>
    );
  }

  if (isLoading || !result) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Negócios Mensais</h2>
        <p className="text-sm text-muted-foreground">Análise integrada de negócios e pedidos</p>
      </div>

      <NegociosKPIs summary={result.summary} />
      <NegociosFinancialAlerts summary={result.summary} porConsultor={result.porConsultor} />
      <NegociosCharts
        summary={result.summary}
        evolucaoMensal={result.evolucaoMensal}
        porConsultor={result.porConsultor}
        porRegiao={result.porRegiao}
        crmData={crmData}
      />
      <NegociosConsultorTable porConsultor={result.porConsultor} />

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
              Clique em &quot;Gerar Insights&quot; para uma análise detalhada com inteligência artificial
            </p>
          )}
          {aiAnalysis && (
            <AIInsightsPanel analysis={aiAnalysis} />
          )}
        </CardContent>
      </Card>
    </div>
  );
};

function AIInsightsPanel({ analysis }: { analysis: AIAnalysis }) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="font-semibold text-sm">Insights</h3>
        {analysis.insights.map((insight, i) => (
          <div key={i} className="p-3 rounded-lg bg-muted/50 border border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="text-xs">
                {insight.tipo === "padrao" ? "Padrao" : insight.tipo === "oportunidade" ? "Oportunidade" : insight.tipo === "gargalo" ? "Gargalo" : "Acao"}
              </Badge>
              <span className="font-medium text-sm">{insight.titulo}</span>
            </div>
            <p className="text-sm text-muted-foreground">{insight.descricao}</p>
          </div>
        ))}
      </div>
      {analysis.cruzamento_obs && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm">Cruzamento: Observacoes x Negocios</h3>
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-sm text-foreground">{analysis.cruzamento_obs}</p>
          </div>
        </div>
      )}
      <div className="space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Alertas
        </h3>
        {analysis.alertas.map((alerta, i) => (
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
  );
}
