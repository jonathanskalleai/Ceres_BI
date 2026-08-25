import { useState, useEffect } from "react";
import { Sparkles, TrendingUp, DollarSign, AlertCircle, Users, CheckCircle2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAI } from "@/lib/fetchAI";

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
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
}

export function AiInsightsOpportunitiesCard() {
  const [currentAi, setCurrentAi] = useState<InsightEquipe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAI("/api/ai/insights?tipo=equipe")
      .then((r) => r.json())
      .then((data) => {
        if (data && !data.message) setCurrentAi(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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
              className="text-[12px] font-semibold tracking-tight text-foreground"
              style={{ fontFamily: "var(--voux-font-sans)" }}
            >
              Inteligência da Equipe & Oportunidades
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

        {/* Loading State */}
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        )}

        {/* Highlight Headline */}
        {!loading && currentAi?.destaque_semana && (
          <div
            className="mb-3.5 p-3 rounded-xl border bg-black/[0.02] dark:bg-white/[0.02]"
            style={{ borderColor: "var(--voux-card-border)" }}
          >
            <p className="text-[13px] font-medium leading-relaxed text-foreground">
              {currentAi.destaque_semana}
            </p>
          </div>
        )}

        {/* Detailed Insights List - 100% Visible without clipping */}
        {!loading && currentAi?.insights && currentAi.insights.length > 0 && (
          <div className="space-y-2.5">
            {currentAi.insights.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 text-[12px] leading-relaxed text-foreground/90"
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

        {/* Empty state */}
        {!loading && (!currentAi || !currentAi.insights?.length) && (
          <p className="text-[12px] text-muted-foreground">
            Acompanhamento de inteligência de negócios sincronizado com os dados do CRM e pedidos.
          </p>
        )}
      </div>

      <div className="pt-3 mt-3 border-t text-[11px] font-mono text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
        Atualizado automaticamente com base nas oportunidades e fechamentos semanais.
      </div>
    </div>
  );
}
