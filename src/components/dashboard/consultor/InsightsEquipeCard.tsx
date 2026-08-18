import { useState, useEffect } from "react";
import { Sparkles, ChevronDown, ChevronUp, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { callAiEndpoint } from "@/services/aiService";
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

function formatDateShort(dateStr?: string) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

function InsightContent({ data }: { data: InsightEquipe }) {
  return (
    <div>
      {data.destaque_semana && (
        <p className="text-[17px] font-semibold leading-snug mb-4" style={{ color: "var(--voux-text-primary)" }}>
          {data.destaque_semana}
        </p>
      )}
      <div className="space-y-3">
        {data.insights?.map((insight, i) => (
          <p key={i} className="text-[15px] leading-relaxed" style={{ color: "var(--voux-text-primary)" }}>
            <span className="font-semibold">{insight.titulo}</span>
            {insight.consultor && insight.consultor !== "null" && (
              <span style={{ color: "var(--voux-text-muted)" }}> ({insight.consultor})</span>
            )}
            {" — "}
            <span style={{ color: "var(--voux-text-muted)" }}>{insight.descricao}</span>
          </p>
        ))}
      </div>
      {data.acoes_gestor && data.acoes_gestor.length > 0 && (
        <div className="mt-4 pt-4 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
          <p className="text-[11px] uppercase tracking-[0.12em] font-medium mb-2" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>
            Ações sugeridas
          </p>
          {data.acoes_gestor.map((acao, i) => (
            <p key={i} className="text-[15px] leading-relaxed" style={{ color: "var(--voux-text-primary)" }}>→ {acao}</p>
          ))}
        </div>
      )}
    </div>
  );
}

export function InsightsEquipeCard({ consultores = [] }: { consultores?: string[] }) {
  const [current, setCurrent] = useState<InsightEquipe | null>(null);
  const [historico, setHistorico] = useState<InsightEquipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistorico, setShowHistorico] = useState(false);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [showResumoModal, setShowResumoModal] = useState(false);
  const [selectedConsultor, setSelectedConsultor] = useState<string>("");

  useEffect(() => {
    // Buscar semana atual
    fetch("/api/ai/insights?tipo=equipe").then(r => r.json()).then(data => {
      if (data && !data.message) setCurrent(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const loadHistorico = () => {
    if (historico.length > 0) {
      setShowHistorico(!showHistorico);
      return;
    }
    fetch("/api/ai/insights?all=true").then(r => r.json()).then(data => {
      if (data?.semanas) {
        // Remove a semana atual (primeira) pois já está exibida
        setHistorico(data.semanas.slice(1));
      }
      setShowHistorico(true);
    });
  };

  if (loading) return <Skeleton className="h-24 rounded-2xl" />;
  if (!current || !current.insights?.length) return null;

  return (
    <div className="space-y-3">
      {/* Semana atual — sempre aberta */}
      <div
        className="rounded-2xl border p-5"
        style={{ borderColor: "var(--voux-card-border)", background: "var(--surface-raised)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4" style={{ color: "var(--voux-accent)" }} />
          <span className="text-[11px] uppercase tracking-[0.12em] font-medium" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}>
            Resumo semanal · IA
          </span>
          {current.semana_inicio && (
            <span className="text-[11px] ml-auto" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>
              {formatDateShort(current.semana_inicio)} a {formatDateShort(current.semana_fim)}
            </span>
          )}
        </div>

        <InsightContent data={current} />
      </div>

      {/* Botão para ver semanas anteriores */}
      <div className="flex items-center gap-2">
        <button
          onClick={loadHistorico}
          className="flex items-center gap-2 px-4 py-2 rounded-xl transition-colors hover:bg-[rgba(0,0,0,0.03)]"
          style={{ color: "var(--voux-text-muted)" }}
        >
          {showHistorico ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          <span className="text-[12px] font-medium" style={{ fontFamily: "var(--voux-font-mono)" }}>
            Semanas anteriores
          </span>
        </button>

        {consultores.length > 0 && (
          <button
            onClick={() => setShowResumoModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl transition-colors hover:bg-[rgba(0,0,0,0.03)] ml-auto"
            style={{ color: "var(--voux-accent)" }}
          >
            <User className="h-3.5 w-3.5" />
            <span className="text-[12px] font-medium" style={{ fontFamily: "var(--voux-font-mono)" }}>
              Resumo dos Consultores
            </span>
          </button>
        )}
      </div>

      {/* Histórico — expandir/recolher cada semana */}
      {showHistorico && historico.length > 0 && (
        <div className="space-y-2">
          {historico.map((semana, idx) => (
            <div
              key={idx}
              className="rounded-xl border overflow-hidden"
              style={{ borderColor: "var(--voux-card-border)", background: "var(--surface-raised)" }}
            >
              <button
                onClick={() => setExpandedWeek(expandedWeek === idx ? null : idx)}
                className="flex items-center justify-between w-full px-4 py-3 hover:bg-[rgba(0,0,0,0.02)] transition-colors"
              >
                <span className="text-[12px] font-medium" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-primary)" }}>
                  Semana {formatDateShort(semana.semana_inicio)} a {formatDateShort(semana.semana_fim)}
                </span>
                {expandedWeek === idx
                  ? <ChevronUp className="h-3.5 w-3.5" style={{ color: "var(--voux-text-muted)" }} />
                  : <ChevronDown className="h-3.5 w-3.5" style={{ color: "var(--voux-text-muted)" }} />
                }
              </button>
              {expandedWeek === idx && (
                <div className="px-4 pb-4">
                  <InsightContent data={semana} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showHistorico && historico.length === 0 && (
        <p className="text-[12px] px-4" style={{ color: "var(--voux-text-faint)" }}>
          Nenhuma semana anterior disponível ainda.
        </p>
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
