import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDateTimeBR } from "@/lib/dateUtils";
import type { TopCliente, Registro } from "@/types/comercial";

const BRL_EXACT = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fmtCurrency = (v: number) => {
  if (v == null || !Number.isFinite(v)) return "R$ 0,00";
  return BRL_EXACT.format(Number(v));
};

interface Props {
  cliente: TopCliente;
  rank: number;
  actions: Registro[];
  vendedorNome: string;
}

export function ConsultorClienteCard({ cliente: c, rank, actions, vendedorNome }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const requestAiAnalysis = async () => {
    if (aiAnalysis) return;
    setAiLoading(true);
    try {
      const acoes = actions.map((r) => ({
        dtConclusao: r.dtConclusao, tipoContato: r.tipoContato,
        tipoAcao: r.tipoAcao, negocioValor: r.negocioValor,
        negocioEtapa: r.negocioEtapa, obs: r.obs,
      }));
      const { data, error } = await supabase.functions.invoke("client-ai-analysis", {
        body: { clienteNome: c.nome, vendedorNome, acoes },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAiAnalysis(data.analysis);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao gerar análise de IA";
      toast.error(msg);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="border-b border-border/50">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="grid grid-cols-[32px_1fr_100px_60px_60px_90px_80px_80px_32px] items-center px-2 py-2.5 w-full text-left hover:bg-muted/30 transition-colors rounded"
      >
        <span className="text-xs font-semibold text-muted-foreground">{rank}</span>
        <span className="text-xs font-medium truncate pr-2">{c.nome}</span>
        <span className="text-xs text-muted-foreground">{c.cidade}</span>
        <span className="text-xs text-center">{c.acoes}</span>
        <span className="text-xs text-center">{c.visitas}</span>
        <span className="text-xs text-right font-semibold">{fmtCurrency(c.negocioValor)}</span>
        <span className="flex justify-center">
          <Badge variant={c.diasSemContato > 90 ? "destructive" : c.diasSemContato > 30 ? "outline" : "default"} className="text-[10px]">
            {c.diasSemContato}d
          </Badge>
        </span>
        <span className="text-xs text-center">
          {c.diasSemContato > 90 ? <span className="text-destructive font-medium">Parado</span>
            : c.negocioValor > 500000 ? <span className="text-success font-medium">Quente</span>
            : <span className="text-muted-foreground">Ativo</span>}
        </span>
        <span className="flex justify-center">
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2 bg-muted/20 rounded-b-lg space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div>
            <h5 className="text-xs font-semibold text-foreground mb-2">Últimas {actions.length} Ações Registradas</h5>
            {actions.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhuma ação encontrada nos registros.</p>
            ) : (
              <div className="space-y-2">
                {actions.map((a, idx) => (
                  <div key={idx} className="bg-card rounded-lg p-3 shadow-sm border border-border/50">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{formatDateTimeBR(a.dtConclusao)}</Badge>
                        <Badge variant="secondary" className="text-[10px] font-medium">{a.tipoContato || "—"}</Badge>
                        <Badge variant="secondary" className="text-[10px] font-medium">{a.tipoAcao || "—"}</Badge>
                      </div>
                      {a.negocioValor > 0 && <span className="text-xs font-bold text-warning">{fmtCurrency(a.negocioValor)}</span>}
                    </div>
                    {a.negocioEtapa && <p className="text-[10px] text-muted-foreground">Etapa: {a.negocioEtapa}</p>}
                    {a.obs && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.obs}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-border pt-3">
            {!aiAnalysis && !aiLoading && (
              <Button size="sm" variant="outline"
                onClick={(e) => { e.stopPropagation(); requestAiAnalysis(); }}
                className="gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                Gerar Análise de IA para este cliente
              </Button>
            )}
            {aiLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analisando dados do cliente...
              </div>
            )}
            {aiAnalysis && (
              <div className="bg-card rounded-lg p-4 shadow-sm border border-primary/20">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h5 className="text-xs font-semibold text-primary">Análise de IA</h5>
                </div>
                <div className="text-xs text-foreground whitespace-pre-line leading-relaxed">{aiAnalysis}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
