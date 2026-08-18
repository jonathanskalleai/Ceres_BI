import { useState } from "react";
import { AlertTriangle, Lightbulb, Loader2, RefreshCw } from "lucide-react";
import { aiNegociosInsights } from "@/services/aiService";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Insight {
  titulo: string;
  descricao: string;
  tipo: string;
}

interface Alerta {
  titulo: string;
  descricao: string;
  severidade: string;
}

interface Analysis {
  insights: Insight[];
  alertas: Alerta[];
  cruzamento_obs?: string;
}

/** Único ponto de IA da Fase 1; não duplica o resumo de IA já existente em Equipe. */
export function ComercialAiInsightsCard() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadInsights = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await aiNegociosInsights();
      if (error || !data) throw new Error(error ?? "A IA não retornou dados.");
      setAnalysis(data as Analysis);
    } catch (error: unknown) {
      toast({
        title: "Erro ao gerar insights",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/[0.025]">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Recomendações executivas com IA
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Conversão, velocidade, perdas e desvios comerciais sintetizados pelo motor de IA.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={loadInsights} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
            {isLoading ? "Analisando..." : analysis ? "Atualizar" : "Gerar insights"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!analysis && !isLoading && (
          <p className="py-3 text-sm text-muted-foreground">
            Gere a análise para priorizar oportunidades, gargalos de conversão e ações da diretoria comercial.
          </p>
        )}
        {analysis && (
          <div className="space-y-4">
            {analysis.insights.length > 0 && (
              <div className="space-y-2">
                {analysis.insights.map((insight, index) => (
                  <article key={`${insight.titulo}-${index}`} className="rounded-md border border-border/60 bg-background/70 p-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">{insight.tipo || "Insight"}</Badge>
                      <h3 className="text-sm font-medium">{insight.titulo}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{insight.descricao}</p>
                  </article>
                ))}
              </div>
            )}
            {analysis.cruzamento_obs && (
              <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                <strong>Cruzamento de observações: </strong>{analysis.cruzamento_obs}
              </div>
            )}
            {analysis.alertas.length > 0 && (
              <div className="space-y-2">
                <h3 className="flex items-center gap-2 text-sm font-medium"><AlertTriangle className="h-4 w-4 text-destructive" />Alertas</h3>
                {analysis.alertas.map((alerta, index) => (
                  <article key={`${alerta.titulo}-${index}`} className="rounded-md border border-destructive/20 bg-destructive/5 p-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge variant={alerta.severidade === "alta" ? "destructive" : "secondary"} className="text-[10px]">
                        {(alerta.severidade || "atenção").toUpperCase()}
                      </Badge>
                      <h3 className="text-sm font-medium">{alerta.titulo}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">{alerta.descricao}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
