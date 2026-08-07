import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MessageSquareText, Search } from "lucide-react";
import { formatDateBR } from "@/lib/dateUtils";
import { POSITIVE_KEYWORDS, NEGATIVE_KEYWORDS } from "@/lib/insightsSentiment";
import type { Registro } from "@/types/comercial";

interface Props {
  obsWithContent: Registro[];
}

export function InsightsObsHistory({ obsWithContent }: Props) {
  const [searchObs, setSearchObs] = useState("");

  const displayObs = useMemo(() => {
    if (!searchObs) return obsWithContent.slice(0, 50);
    const s = searchObs.toLowerCase();
    return obsWithContent.filter((r) => r.obs.toLowerCase().includes(s)).slice(0, 50);
  }, [obsWithContent, searchObs]);

  return (
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
                  <span className="text-[10px] font-mono text-muted-foreground">{formatDateBR(r.dtConclusao)}</span>
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
  );
}
