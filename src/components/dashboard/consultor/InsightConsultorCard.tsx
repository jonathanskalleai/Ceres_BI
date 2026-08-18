import { useState, useEffect } from "react";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAI } from "@/lib/fetchAI";

interface InsightData {
  nota?: string;
  frase_impacto?: string;
  pontos_fortes?: string[];
  pontos_atencao?: string[];
  acoes_recomendadas?: string[];
  clientes_prioritarios?: string[];
  semana_inicio?: string;
  semana_fim?: string;
}

function formatDateShort(dateStr?: string) {
  if (!dateStr) return "";
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

function InsightContent({ data }: { data: InsightData }) {
  const notaColor = data.nota === "A" ? "#1f6e3f" : data.nota === "B" ? "#2d6b9c" : data.nota === "C" ? "#9c5e1c" : "#b8421c";

  return (
    <div>
      {/* Nota + frase */}
      <div className="flex items-start gap-3 mb-4">
        {data.nota && (
          <span
            className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md text-[14px] font-bold"
            style={{ background: `${notaColor}14`, color: notaColor, fontFamily: "var(--voux-font-mono)" }}
          >
            {data.nota}
          </span>
        )}
        {data.frase_impacto && (
          <p className="text-[16px] font-medium leading-snug" style={{ color: "var(--voux-text-primary)" }}>
            {data.frase_impacto}
          </p>
        )}
      </div>

      {/* Pontos fortes e atenção */}
      <div className="space-y-2 mb-4">
        {data.pontos_fortes?.map((p, i) => (
          <p key={`f-${i}`} className="text-[15px] leading-relaxed" style={{ color: "var(--voux-text-primary)" }}>
            <span className="font-semibold" style={{ color: "#1f6e3f" }}>+</span> {p}
          </p>
        ))}
        {data.pontos_atencao?.map((p, i) => (
          <p key={`a-${i}`} className="text-[15px] leading-relaxed" style={{ color: "var(--voux-text-primary)" }}>
            <span className="font-semibold" style={{ color: "#b8421c" }}>!</span> {p}
          </p>
        ))}
      </div>

      {/* Ações */}
      {data.acoes_recomendadas && data.acoes_recomendadas.length > 0 && (
        <div className="pt-3 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
          <p className="text-[11px] uppercase tracking-[0.12em] font-medium mb-2" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>
            Ações recomendadas
          </p>
          {data.acoes_recomendadas.map((a, i) => (
            <p key={i} className="text-[15px] leading-relaxed" style={{ color: "var(--voux-text-primary)" }}>→ {a}</p>
          ))}
        </div>
      )}

      {/* Clientes */}
      {data.clientes_prioritarios && data.clientes_prioritarios.length > 0 && (
        <div className="mt-2 pt-2 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
          <p className="text-[10px] uppercase tracking-[0.12em] font-medium mb-1.5" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>
            Clientes prioritários
          </p>
          {data.clientes_prioritarios.map((c, i) => (
            <p key={i} className="text-[13px] leading-relaxed" style={{ color: "var(--voux-text-primary)" }}>• {c}</p>
          ))}
        </div>
      )}
    </div>
  );
}

export function InsightConsultorCard({ consultor }: { consultor: string }) {
  const [current, setCurrent] = useState<InsightData | null>(null);
  const [historico, setHistorico] = useState<InsightData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistorico, setShowHistorico] = useState(false);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  useEffect(() => {
    // Reset state when consultant changes
    setCurrent(null);
    setHistorico([]);
    setShowHistorico(false);
    setExpandedWeek(null);
    setLoading(true);

    fetchAI(`/api/ai/insights?tipo=individual&consultor=${encodeURIComponent(consultor)}`)
      .then(r => r.json())
      .then(data => {
        if (data && !data.message) setCurrent(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [consultor]);

  const loadHistorico = () => {
    if (historico.length > 0) {
      setShowHistorico(!showHistorico);
      return;
    }
    fetchAI(`/api/ai/insights?tipo=individual&consultor=${encodeURIComponent(consultor)}&all=true`)
      .then(r => r.json())
      .then(data => {
        if (data?.semanas) setHistorico(data.semanas.slice(1));
        setShowHistorico(true);
      });
  };

  if (loading) return <Skeleton className="h-24 rounded-2xl" />;
  if (!current) return null;

  return (
    <div className="space-y-3">
      {/* Semana atual */}
      <div
        className="rounded-2xl border p-5"
        style={{ borderColor: "var(--voux-card-border)", background: "var(--surface-raised)" }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4" style={{ color: "var(--voux-accent)" }} />
          <span className="text-[11px] uppercase tracking-[0.12em] font-medium" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}>
            Insight semanal
          </span>
          {current.semana_inicio && (
            <span className="text-[11px] ml-auto" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>
              {formatDateShort(current.semana_inicio)} a {formatDateShort(current.semana_fim)}
            </span>
          )}
        </div>
        <InsightContent data={current} />
      </div>

      {/* Botão semanas anteriores */}
      <button
        onClick={loadHistorico}
        className="flex items-center gap-2 px-4 py-2 w-full rounded-xl transition-colors hover:bg-[rgba(0,0,0,0.03)]"
        style={{ color: "var(--voux-text-muted)" }}
      >
        {showHistorico ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        <span className="text-[12px] font-medium" style={{ fontFamily: "var(--voux-font-mono)" }}>
          Semanas anteriores
        </span>
      </button>

      {/* Histórico */}
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
    </div>
  );
}
