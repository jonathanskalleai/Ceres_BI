import { useMemo } from "react";
import type { DadosComerciais, Filters } from "@/types/comercial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/bi/KPICard";
import { Badge } from "@/components/ui/badge";
import { MessageSquareText, ThumbsUp, ThumbsDown, Package } from "lucide-react";
import { BarChart } from "@/components/bi/charts";
import { filterRegistros } from "@/lib/filterUtils";
import {
  countKeywords, rankKeywords,
  POSITIVE_KEYWORDS, NEGATIVE_KEYWORDS, PRODUCT_KEYWORDS,
  COLORS_POS, COLORS_NEG, INSIGHT_CHART_COLORS,
} from "@/lib/insightsSentiment";
import { InsightsObsHistory } from "./insights/InsightsObsHistory";

interface Props {
  data: DadosComerciais;
  filters: Filters;
}

export const DashboardInsights = ({ data, filters }: Props) => {
  const filtered = useMemo(() => filterRegistros(data.registrosRecentes, filters), [data, filters]);
  const allObs = useMemo(() => filtered.map((r) => r.obs || "").join(" "), [filtered]);

  const obsWithContent = useMemo(
    () => filtered
      .filter((r) => r.obs && r.obs.length > 10)
      .sort((a, b) => (b.dtConclusao || "").localeCompare(a.dtConclusao || "")),
    [filtered],
  );

  const positiveWords = useMemo(() => rankKeywords(countKeywords(allObs, POSITIVE_KEYWORDS)), [allObs]);
  const negativeWords = useMemo(() => rankKeywords(countKeywords(allObs, NEGATIVE_KEYWORDS)), [allObs]);
  const products      = useMemo(() => rankKeywords(countKeywords(allObs, PRODUCT_KEYWORDS)),  [allObs]);

  const consultorSentiment = useMemo(() => {
    const map = new Map<string, { pos: number; neg: number }>();
    for (const r of filtered) {
      if (!r.obs) continue;
      const lower = r.obs.toLowerCase();
      if (!map.has(r.vendedor)) map.set(r.vendedor, { pos: 0, neg: 0 });
      const entry = map.get(r.vendedor)!;
      for (const kw of POSITIVE_KEYWORDS) if (lower.includes(kw)) entry.pos++;
      for (const kw of NEGATIVE_KEYWORDS) if (lower.includes(kw)) entry.neg++;
    }
    return Array.from(map.entries())
      .map(([vendedor, s]) => ({ vendedor: vendedor.split(" ").slice(-1)[0], ...s }))
      .filter((s) => s.pos + s.neg > 0)
      .sort((a, b) => (b.pos + b.neg) - (a.pos + a.neg))
      .slice(0, 12);
  }, [filtered]);

  const totalPos = positiveWords.reduce((s, w) => s + w.value, 0);
  const totalNeg = negativeWords.reduce((s, w) => s + w.value, 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MessageSquareText className="h-6 w-6 text-primary" />
          Análise de Observações
        </h2>
        <p className="text-sm text-muted-foreground">
          Análise de sentimento, produtos de interesse e histórico ({filtered.length} registros)
        </p>
        <p className="text-xs text-muted-foreground">
          Baseada no campo 'Atividade Executada' das ações do CRM
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Obs. com Conteúdo"    value={obsWithContent.length.toString()} icon={MessageSquareText} accentColor="#3b82f6" />
        <KPICard title="Menções Positivas"     value={totalPos.toString()}              icon={ThumbsUp}          accentColor={COLORS_POS} />
        <KPICard title="Menções Negativas"     value={totalNeg.toString()}              icon={ThumbsDown}        accentColor={COLORS_NEG} />
        <KPICard title="Produtos Identificados" value={products.length.toString()}      icon={Package}           accentColor="#eab308" />
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Produtos com Maior Interesse
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-2 gap-6">
            <BarChart data={products.slice(0, 10).map((p) => ({ name: p.name, value: p.value }))}
              layout="horizontal" keys={["value"]} height={280}
              itemColors={INSIGHT_CHART_COLORS} seriesLabels={{ value: "Menções" }} />
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Ranking</p>
              {products.slice(0, 10).map((p, i) => (
                <div key={p.name} className="flex items-center justify-between py-1.5 border-b border-border/30">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                    <span className="text-sm font-medium capitalize">{p.name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">{p.value} menções</Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-success" />Palavras Positivas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {positiveWords.length > 0 ? (
              <>
                <BarChart data={positiveWords.slice(0, 8).map((w) => ({ name: w.name, value: w.value }))}
                  layout="horizontal" keys={["value"]} height={220}
                  colors={[COLORS_POS]} seriesLabels={{ value: "Ocorrências" }} />
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {positiveWords.map((w) => (
                    <Badge key={w.name} className="bg-success/10 text-success border-success/30 text-[10px]">
                      {w.name} ({w.value})
                    </Badge>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma palavra positiva encontrada</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ThumbsDown className="h-4 w-4 text-destructive" />Palavras Negativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {negativeWords.length > 0 ? (
              <>
                <BarChart data={negativeWords.slice(0, 8).map((w) => ({ name: w.name, value: w.value }))}
                  layout="horizontal" keys={["value"]} height={220}
                  colors={[COLORS_NEG]} seriesLabels={{ value: "Ocorrências" }} />
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {negativeWords.map((w) => (
                    <Badge key={w.name} className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">
                      {w.name} ({w.value})
                    </Badge>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma palavra negativa encontrada</p>
            )}
          </CardContent>
        </Card>
      </div>

      {consultorSentiment.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Sentimento por Consultor</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={consultorSentiment.map((s) => ({ name: s.vendedor, pos: s.pos, neg: s.neg }))}
              layout="vertical" keys={["pos", "neg"]}
              colors={[COLORS_POS, COLORS_NEG]} groupMode="stacked" height={280}
              seriesLabels={{ pos: "Positivas", neg: "Negativas" }} />
          </CardContent>
        </Card>
      )}

      <InsightsObsHistory obsWithContent={obsWithContent} />
    </div>
  );
};
