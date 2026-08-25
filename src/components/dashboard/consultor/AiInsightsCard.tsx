import { useState, useEffect } from "react";
import { Sparkles, ChevronDown, ChevronUp, User, History, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAI } from "@/lib/fetchAI";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InsightConsultorCard } from "./InsightConsultorCard";

interface InsightItem {
  tipo: string;
  titulo: string;
  descricao: string;
  consultor: string | null;
  prioridade: string;
}

interface InsightEquipe {
  destaque_semana?: string;
  insights?: InsightItem[];
  acoes_gestor?: string[];
  semana_inicio?: string;
  semana_fim?: string;
}

interface AiInsightsCardProps {
  consultores?: string[];
}

function formatDateShort(dateStr?: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
}

export function AiInsightsCard({ consultores = [] }: AiInsightsCardProps) {
  const [currentAi, setCurrentAi] = useState<InsightEquipe | null>(null);
  const [historico, setHistorico] = useState<InsightEquipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistorico, setShowHistorico] = useState(false);
  const [showResumoModal, setShowResumoModal] = useState(false);
  const [selectedConsultor, setSelectedConsultor] = useState<string>("");

  useEffect(() => {
    fetchAI("/api/ai/insights?tipo=equipe")
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.message) setCurrentAi(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const loadHistorico = () => {
    if (historico.length > 0) {
      setShowHistorico(!showHistorico);
      return;
    }
    fetchAI("/api/ai/insights?all=true")
      .then((r) => r.json())
      .then((data) => {
        if (data?.semanas) {
          setHistorico(data.semanas.slice(1));
        }
        setShowHistorico(true);
      });
  };

  return (
    <div
      className="flex flex-col justify-between h-full rounded-2xl border p-5 transition-all duration-200"
      style={{
        background: "var(--surface-raised)",
        borderColor: "var(--voux-card-border)",
        boxShadow: "var(--voux-card-shadow)",
      }}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-3.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            <h3
              className="text-[12px] font-semibold uppercase tracking-[0.12em]"
              style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}
            >
              Inteligência da Equipe · IA
            </h3>
          </div>
          {currentAi?.semana_inicio && (
            <span
              className="text-[11px] font-mono text-muted-foreground border px-2 py-0.5 rounded-full"
              style={{ borderColor: "var(--voux-card-border)" }}
            >
              {formatDateShort(currentAi.semana_inicio)} a {formatDateShort(currentAi.semana_fim)}
            </span>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        )}

        {/* Highlight 100% Unclipped */}
        {!loading && currentAi?.destaque_semana && (
          <div
            className="mb-3 p-3 rounded-xl border bg-black/[0.02] dark:bg-white/[0.02]"
            style={{ borderColor: "var(--voux-card-border)" }}
          >
            <p className="text-[13px] font-medium leading-relaxed text-foreground">
              {currentAi.destaque_semana}
            </p>
          </div>
        )}

        {/* Detailed Insights */}
        {!loading && currentAi?.insights && currentAi.insights.length > 0 && (
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {currentAi.insights.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 text-[12px] leading-relaxed text-foreground/90"
              >
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-foreground">{item.titulo}</span>
                  {item.consultor && item.consultor !== "null" && (
                    <span className="text-muted-foreground font-mono text-[11px]"> ({item.consultor})</span>
                  )}
                  {" — "}
                  <span className="text-muted-foreground">{item.descricao}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Ações sugeridas */}
        {!loading && currentAi?.acoes_gestor && currentAi.acoes_gestor.length > 0 && (
          <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
            <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Ações Sugeridas
            </p>
            <div className="space-y-1.5">
              {currentAi.acoes_gestor.slice(0, 2).map((acao, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-[11px] text-foreground font-medium">
                  <ArrowRight className="h-3 w-3 text-emerald-500 shrink-0" />
                  <span className="truncate">{acao}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && (!currentAi || !currentAi.insights?.length) && (
          <p className="text-[12px] text-muted-foreground">
            Acompanhamento semanal gerado por inteligência artificial a partir das ações e pedidos.
          </p>
        )}
      </div>

      {/* Footer Controls */}
      <div className="pt-3 mt-3 border-t flex flex-wrap items-center justify-between gap-2" style={{ borderColor: "var(--voux-card-border)" }}>
        <button
          type="button"
          onClick={loadHistorico}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <History className="h-3 w-3" />
          <span>{showHistorico ? "Ocultar semanas" : "Histórico IA"}</span>
          {showHistorico ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {consultores.length > 0 && (
          <button
            type="button"
            onClick={() => setShowResumoModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
          >
            <User className="h-3 w-3" />
            <span>Resumo Consultor</span>
          </button>
        )}
      </div>

      {/* Histórico expandido */}
      {showHistorico && historico.length > 0 && (
        <div className="space-y-1.5 max-h-40 overflow-y-auto mt-2 pt-2 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
          {historico.map((semana, idx) => (
            <div
              key={idx}
              className="rounded-lg border p-2 text-[11px]"
              style={{ borderColor: "var(--voux-card-border)", background: "var(--surface-base)" }}
            >
              <div className="flex items-center justify-between font-mono font-medium mb-1">
                <span>Semana {formatDateShort(semana.semana_inicio)} a {formatDateShort(semana.semana_fim)}</span>
              </div>
              <p className="text-muted-foreground">{semana.destaque_semana}</p>
            </div>
          ))}
        </div>
      )}

      {/* Modal — Resumo individual do consultor */}
      <Dialog open={showResumoModal} onOpenChange={setShowResumoModal}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle
              className="text-base font-bold"
              style={{ fontFamily: "var(--voux-font-display)", color: "var(--voux-text-heading)" }}
            >
              Resumo individual do Consultor
            </DialogTitle>
            <DialogDescription className="text-[13px]" style={{ color: "var(--voux-text-faint)" }}>
              Selecione um consultor para ver o resumo semanal com IA.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2">
            <Select value={selectedConsultor} onValueChange={setSelectedConsultor}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o consultor" />
              </SelectTrigger>
              <SelectContent>
                {consultores.map((nome) => (
                  <SelectItem key={nome} value={nome}>
                    {nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedConsultor && (
            <div className="mt-4">
              <InsightConsultorCard consultor={selectedConsultor} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
