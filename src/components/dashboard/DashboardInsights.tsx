import { useMemo } from "react";
import { DadosComerciais, Filters } from "@/types/comercial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquareText, ThumbsUp, ThumbsDown, Package, Search } from "lucide-react";
import { BarChart } from "@/components/bi/charts";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { filterRegistros } from "@/lib/filterUtils";

interface Props {
  data: DadosComerciais;
  filters: Filters;
}

const POSITIVE_KEYWORDS = [
  "venda", "negócio", "interesse", "fechamento", "intenção", "pedido",
  "interessado", "comprar", "aprovado", "parceria", "gostou", "confirmar",
  "confirmou", "faturar", "avançar", "definiu", "fechou", "satisfeito",
];

const NEGATIVE_KEYWORDS = [
  "não", "problema", "dificuldade", "cancelar", "desistiu", "reclamação",
  "atraso", "atrasado", "caro", "preço alto", "concorrência", "concorrente",
  "financeiro", "sem condição", "safra ruim", "parado", "negou", "indeciso",
  "defeito", "quebrou", "prejuízo", "insatisfeito", "sem interesse",
];

const PRODUCT_KEYWORDS = [
  "plataforma", "plantadeira", "colheitadeira", "trator", "pulverizador",
  "descompactador", "drone", "gps", "piloto", "semeadeira", "distribuidor",
  "calcário", "terrus", "draper", "ap 360", "gts", "hardox", "precisão",
  "fertilizante", "adubo", "silo", "autopilot",
];

const COLORS_POS = "hsl(152, 69%, 40%)";
const COLORS_NEG = "hsl(0, 84%, 60%)";
const INSIGHT_CHART_COLORS = [
  "#3b82f6", "#26a503", "#f59e0b",
  "#a855f7", "#ef4444", "#0ea5e9",
  "#ec4899", "#eab308",
];

function countKeywords(text: string, keywords: string[]): Record<string, number> {
  const lower = text.toLowerCase();
  const result: Record<string, number> = {};
  for (const kw of keywords) {
    let count = 0;
    let idx = 0;
    while ((idx = lower.indexOf(kw, idx)) !== -1) {
      count++;
      idx += kw.length;
    }
    if (count > 0) result[kw] = count;
  }
  return result;
}


export const DashboardInsights = ({ data, filters }: Props) => {
  const [searchObs, setSearchObs] = useState("");

  const filtered = useMemo(() => filterRegistros(data.registrosRecentes, filters), [data, filters]);
  const allObs = useMemo(() => filtered.map((r) => r.obs || "").join(" "), [filtered]);
  const obsWithContent = useMemo(() => filtered.filter((r) => r.obs && r.obs.length > 10), [filtered]);

  const positiveWords = useMemo(() => {
    const counts = countKeywords(allObs, POSITIVE_KEYWORDS);
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [allObs]);

  const negativeWords = useMemo(() => {
    const counts = countKeywords(allObs, NEGATIVE_KEYWORDS);
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [allObs]);

  const products = useMemo(() => {
    const counts = countKeywords(allObs, PRODUCT_KEYWORDS);
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [allObs]);

  // Per-consultant sentiment
  const consultorSentiment = useMemo(() => {
    const map = new Map<string, { pos: number; neg: number }>();
    for (const r of filtered) {
      if (!r.obs) continue;
      const lower = r.obs.toLowerCase();
      const v = r.vendedor;
      if (!map.has(v)) map.set(v, { pos: 0, neg: 0 });
      const entry = map.get(v)!;
      for (const kw of POSITIVE_KEYWORDS) if (lower.includes(kw)) entry.pos++;
      for (const kw of NEGATIVE_KEYWORDS) if (lower.includes(kw)) entry.neg++;
    }
    return Array.from(map.entries())
      .map(([vendedor, s]) => ({ vendedor: vendedor.split(" ").slice(-1)[0], ...s, full: vendedor }))
      .filter((s) => s.pos + s.neg > 0)
      .sort((a, b) => (b.pos + b.neg) - (a.pos + a.neg))
      .slice(0, 12);
  }, [filtered]);

  // Filtered obs for history
  const displayObs = useMemo(() => {
    if (!searchObs) return obsWithContent.slice(0, 50);
    const s = searchObs.toLowerCase();
    return obsWithContent.filter((r) => r.obs.toLowerCase().includes(s)).slice(0, 50);
  }, [obsWithContent, searchObs]);

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
          Análise de sentimento, produtos de interesse e histórico de observações ({filtered.length} registros)
        </p>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm border-l-4 border-l-primary">
          <CardContent className="p-4">
            <p className="text-3xl font-bold text-primary">{obsWithContent.length}</p>
            <p className="text-xs text-muted-foreground">Observações com Conteúdo</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm border-l-4" style={{ borderLeftColor: COLORS_POS }}>
          <CardContent className="p-4">
            <p className="text-3xl font-bold text-success">{totalPos}</p>
            <p className="text-xs text-muted-foreground">Menções Positivas</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm border-l-4" style={{ borderLeftColor: COLORS_NEG }}>
          <CardContent className="p-4">
            <p className="text-3xl font-bold text-destructive">{totalNeg}</p>
            <p className="text-xs text-muted-foreground">Menções Negativas</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm border-l-4 border-l-warning">
          <CardContent className="p-4">
            <p className="text-3xl font-bold text-warning">{products.length}</p>
            <p className="text-xs text-muted-foreground">Produtos Identificados</p>
          </CardContent>
        </Card>
      </div>

      {/* Products of Interest */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Produtos com Maior Interesse dos Clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid lg:grid-cols-2 gap-6">
            <BarChart
              data={products.slice(0, 10).map((p) => ({ name: p.name, value: p.value }))}
              layout="horizontal"
              keys={["value"]}
              height={280}
              itemColors={INSIGHT_CHART_COLORS}
              seriesLabels={{ value: "Menções" }}
            />
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Ranking de Produtos</p>
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

      {/* Positive & Negative Words */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-success" />
              Palavras Positivas Encontradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {positiveWords.length > 0 ? (
              <>
                <BarChart
                  data={positiveWords.slice(0, 8).map((w) => ({ name: w.name, value: w.value }))}
                  layout="horizontal"
                  keys={["value"]}
                  height={220}
                  colors={[COLORS_POS]}
                  seriesLabels={{ value: "Ocorrências" }}
                />
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {positiveWords.map((w) => (
                    <Badge key={w.name} className="bg-success/10 text-success border-success/30 text-[10px]">
                      {w.name} ({w.value})
                    </Badge>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma palavra positiva encontrada nos registros filtrados</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ThumbsDown className="h-4 w-4 text-destructive" />
              Palavras Negativas Encontradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {negativeWords.length > 0 ? (
              <>
                <BarChart
                  data={negativeWords.slice(0, 8).map((w) => ({ name: w.name, value: w.value }))}
                  layout="horizontal"
                  keys={["value"]}
                  height={220}
                  colors={[COLORS_NEG]}
                  seriesLabels={{ value: "Ocorrências" }}
                />
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {negativeWords.map((w) => (
                    <Badge key={w.name} className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">
                      {w.name} ({w.value})
                    </Badge>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma palavra negativa encontrada nos registros filtrados</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sentiment per Consultant */}
      {consultorSentiment.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Sentimento por Consultor</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={consultorSentiment.map((s) => ({ name: s.vendedor, pos: s.pos, neg: s.neg }))}
              layout="vertical"
              keys={["pos", "neg"]}
              colors={[COLORS_POS, COLORS_NEG]}
              groupMode="stacked"
              height={280}
              seriesLabels={{ pos: "Positivas", neg: "Negativas" }}
            />
          </CardContent>
        </Card>
      )}

      {/* Observations History */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <MessageSquareText className="h-4 w-4" />
              Histórico de Observações
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nas observações..."
                className="pl-9 h-8 text-xs"
                value={searchObs}
                onChange={(e) => setSearchObs(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[500px] overflow-auto">
            {displayObs.map((r, i) => {
              const obsLower = r.obs.toLowerCase();
              const hasPos = POSITIVE_KEYWORDS.some((kw) => obsLower.includes(kw));
              const hasNeg = NEGATIVE_KEYWORDS.some((kw) => obsLower.includes(kw));
              return (
                <div key={i} className={`p-3 rounded-lg border ${hasNeg ? "border-destructive/30 bg-destructive/5" : hasPos ? "border-success/30 bg-success/5" : "border-border/50 bg-muted/20"}`}>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] font-mono text-muted-foreground">{r.dtConclusao}</span>
                    <Badge variant="outline" className="text-[9px]">{r.vendedor.split(" ").slice(-1)[0]}</Badge>
                    <Badge variant="outline" className="text-[9px]">{r.tipoAcao || "—"}</Badge>
                    <span className="text-[10px] text-muted-foreground">{r.cliente}</span>
                    {hasPos && <Badge className="bg-success/20 text-success text-[9px] border-0">✓ Positivo</Badge>}
                    {hasNeg && <Badge className="bg-destructive/20 text-destructive text-[9px] border-0">⚠ Negativo</Badge>}
                  </div>
                  <p className="text-xs text-foreground leading-relaxed">{r.obs}</p>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">
            Mostrando {displayObs.length} de {obsWithContent.length} observações
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
