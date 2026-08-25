import { useState, useEffect, useMemo } from "react";
import { ArrowRight, ChevronDown, ChevronUp, User, History, CheckSquare, Target } from "lucide-react";
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
import type { RpcConsultorResumoAcoes } from "@/types/consultoresRpc";
import { formatBRL } from "@/lib/dateUtils";

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

interface AiSuggestedActionsCardProps {
  resumo: RpcConsultorResumoAcoes[];
  consultores: string[];
}

function formatDateShort(dateStr?: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
}

export function AiSuggestedActionsCard({ resumo, consultores = [] }: AiSuggestedActionsCardProps) {
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

  const totais = useMemo(() => {
    return resumo.reduce(
      (acc, item) => ({
        totalVendido: acc.totalVendido + Number(item.valor_ganho || 0),
        totalGanhos: acc.totalGanhos + Number(item.ganhos || 0),
        totalAcoes: acc.totalAcoes + Number(item.acoes || 0),
        totalVisitas: acc.totalVisitas + Number(item.visitas || 0),
        totalClientes: acc.totalClientes + Number(item.clientes || 0),
      }),
      {
        totalVendido: 0,
        totalGanhos: 0,
        totalAcoes: 0,
        totalVisitas: 0,
        totalClientes: 0,
      }
    );
  }, [resumo]);

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
            <CheckSquare className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            <h3
              className="text-[12px] font-semibold tracking-tight text-foreground"
              style={{ fontFamily: "var(--voux-font-sans)" }}
            >
              Ações Sugeridas para a Gestão
            </h3>
          </div>

          {/* Quick Real Stats Pill */}
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="font-bold text-foreground tabular-nums">
              {formatBRL(totais.totalVendido)}
            </span>
            <span className="text-muted-foreground">({totais.totalGanhos} pedidos)</span>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        )}

        {/* Suggested Actions List - 100% visible */}
        {!loading && currentAi?.acoes_gestor && currentAi.acoes_gestor.length > 0 && (
          <div className="space-y-2">
            {currentAi.acoes_gestor.map((acao, idx) => (
              <div
                key={idx}
                className="group flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                style={{ borderColor: "var(--voux-card-border)", background: "var(--surface-base)" }}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1 text-[12px] text-foreground font-medium">
                  <span className="font-mono text-emerald-500 font-bold">0{idx + 1}.</span>
                  <span className="truncate">{acao}</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            ))}
          </div>
        )}

        {/* Fallback default actions if API is quiet */}
        {!loading && (!currentAi || !currentAi.acoes_gestor?.length) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2.5 rounded-xl border text-[12px] text-foreground" style={{ borderColor: "var(--voux-card-border)", background: "var(--surface-base)" }}>
              <span>Acompanhar oportunidades com propostas pendentes no período</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl border text-[12px] text-foreground" style={{ borderColor: "var(--voux-card-border)", background: "var(--surface-base)" }}>
              <span>Priorizar visitas em clientes com alto potencial de renovação</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Action Controls in Footer */}
      <div className="pt-3 mt-3 border-t flex flex-wrap items-center justify-between gap-2" style={{ borderColor: "var(--voux-card-border)" }}>
        <button
          type="button"
          onClick={loadHistorico}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <History className="h-3 w-3" />
          <span>{showHistorico ? "Ocultar semanas" : "Histórico semanal"}</span>
          {showHistorico ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        {consultores.length > 0 && (
          <button
            type="button"
            onClick={() => setShowResumoModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-mono font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 transition-colors"
          >
            <User className="h-3 w-3" />
            <span>Resumo do Consultor</span>
          </button>
        )}
      </div>

      {/* Histórico expandido */}
      {showHistorico && historico.length > 0 && (
        <div className="space-y-1.5 max-h-48 overflow-y-auto mt-2 pt-2 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
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
