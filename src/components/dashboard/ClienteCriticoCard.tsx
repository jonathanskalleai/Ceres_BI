import { Phone, Mail, MapPin, Clock, TrendingDown, Users } from "lucide-react";
import type { Registro } from "@/types/comercial";

interface ClienteCritico {
  nome: string;
  cidade: string;
  vendedor: string;
  diasSemContato: number;
  pipeline: number;
  totalAcoes: number;
  visitas: number;
  ultimaData: string;
  ultimaObs: string;
  ultimoTipoAcao: string;
  historico: Registro[];
}

interface SugestaoAcao {
  acao: string;
  argumentacao: string;
  prioridade: "CRÍTICA" | "ALTA" | "MÉDIA";
  borderColor: string;
}

const CARD_BASE =
  "relative overflow-hidden rounded-[20px] p-[22px_24px] border";

const MONO: React.CSSProperties = {
  fontFamily: "var(--voux-font-mono, 'JetBrains Mono', monospace)",
};

const PRIORITY_COLORS: Record<string, string> = {
  CRÍTICA: "var(--voux-danger)",
  ALTA: "var(--voux-warning)",
  MÉDIA: "var(--voux-accent)",
};

const formatCurrency = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(0)}K` : `R$ ${v.toFixed(0)}`;

interface Props {
  c: ClienteCritico;
  sugestao: SugestaoAcao;
}

export function ClienteCriticoCard({ c, sugestao }: Props) {
  const prioColor = PRIORITY_COLORS[sugestao.prioridade] ?? "var(--voux-accent)";

  return (
    <div
      className={CARD_BASE}
      style={{
        background: "linear-gradient(to bottom, var(--voux-card-from), var(--voux-card-to))",
        borderColor: "var(--voux-card-border)",
        boxShadow: "var(--voux-card-shadow)",
      }}
    >
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        {/* Client Info */}
        <div className="flex-1 min-w-0">
          {/* Name + days pill + priority badge */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="font-semibold text-sm truncate" style={{ color: "var(--voux-text-primary)" }}>{c.nome}</h4>

            <span
              className="text-[9px] tracking-[0.18em] uppercase px-2 py-0.5 rounded-full border"
              style={{
                ...MONO,
                color: "var(--voux-danger)",
                borderColor: "color-mix(in srgb, var(--voux-danger) 40%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--voux-danger) 8%, transparent)",
              }}
            >
              {c.diasSemContato}d
            </span>

            <span
              className="text-[9px] tracking-[0.18em] uppercase px-2 py-0.5 rounded-full border font-semibold"
              style={{
                ...MONO,
                color: prioColor,
                borderColor: `${prioColor}60`,
                backgroundColor: `${prioColor}12`,
              }}
            >
              {sugestao.prioridade}
            </span>
          </div>

          {/* Meta info */}
          <div className="flex items-center gap-4 text-[11px] mb-3 flex-wrap" style={{ ...MONO, color: "var(--voux-text-faint)" }}>
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {c.cidade}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {c.vendedor.split(" ").slice(-1)[0]}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Último: {c.ultimaData}
            </span>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-4 gap-3 mb-3">
            {[
              { label: "Pipeline", value: formatCurrency(c.pipeline), color: "var(--voux-accent)" },
              { label: "Ações", value: c.totalAcoes, color: "var(--voux-text-primary)" },
              { label: "Visitas", value: c.visitas, color: "var(--voux-text-primary)" },
              { label: "Última Ação", value: c.ultimoTipoAcao, color: "var(--voux-text-faint)" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="text-center p-2 rounded-[10px]"
                style={{
                  backgroundColor: "var(--voux-card-to)",
                  border: "1px solid var(--voux-card-border)",
                }}
              >
                <p className="text-sm font-bold" style={{ color, ...MONO }}>
                  {value}
                </p>
                <p className="text-[10px] mt-0.5" style={{ ...MONO, color: "var(--voux-text-faint)" }}>
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Last observation */}
          <div
            className="rounded-[10px] p-2 mb-3"
            style={{
              backgroundColor: "var(--voux-card-to)",
              border: "1px solid var(--voux-card-border)",
            }}
          >
            <p className="text-[10px] tracking-[0.22em] uppercase mb-1" style={{ ...MONO, color: "var(--voux-text-faint)" }}>
              ÚLTIMA OBSERVAÇÃO
            </p>
            <p className="text-xs" style={{ color: "var(--voux-text-primary)" }}>{c.ultimaObs}</p>
          </div>

          {/* History */}
          {c.historico.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] tracking-[0.22em] uppercase mb-1" style={{ ...MONO, color: "var(--voux-text-faint)" }}>
                HISTÓRICO ({Math.min(c.historico.length, 5)} ÚLTIMOS REGISTROS)
              </p>
              <div className="space-y-1">
                {c.historico.slice(0, 5).map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]" style={{ ...MONO, color: "var(--voux-text-faint)" }}>
                    <span className="shrink-0">{h.dtConclusao}</span>
                    <span
                      className="text-[9px] tracking-[0.14em] uppercase px-1.5 py-0.5 rounded-sm shrink-0"
                      style={{
                        color: "var(--voux-accent)",
                        border: "1px solid var(--voux-border-hover)",
                        backgroundColor: "var(--voux-card-border)",
                      }}
                    >
                      {h.tipoAcao}
                    </span>
                    <span className="truncate">{h.obs || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Recommendation */}
        <div
          className="lg:w-72 shrink-0 rounded-[14px] p-4"
          style={{
            borderLeft: `3px solid ${sugestao.borderColor}`,
            backgroundColor: `${sugestao.borderColor}0a`,
            border: `1px solid ${sugestao.borderColor}20`,
            borderLeftWidth: "3px",
            borderLeftColor: sugestao.borderColor,
          }}
        >
          <p
            className="text-[10px] tracking-[0.22em] uppercase mb-2 flex items-center gap-1"
            style={{ ...MONO, color: sugestao.borderColor }}
          >
            <TrendingDown className="h-3 w-3" />
            AÇÃO RECOMENDADA
          </p>
          <div className="space-y-2">
            <div>
              <p className="text-[10px] tracking-[0.18em] uppercase mb-0.5" style={{ ...MONO, color: "var(--voux-text-faint)" }}>
                O QUE FAZER
              </p>
              <p className="text-xs" style={{ color: "var(--voux-text-primary)" }}>{sugestao.acao}</p>
            </div>
            <div>
              <p className="text-[10px] tracking-[0.18em] uppercase mb-0.5" style={{ ...MONO, color: "var(--voux-text-faint)" }}>
                ARGUMENTAÇÃO
              </p>
              <p className="text-xs" style={{ color: "var(--voux-text-primary)" }}>{sugestao.argumentacao}</p>
            </div>
            <div className="flex gap-2 pt-1 flex-wrap">
              {[
                { icon: Phone, label: "Ligar" },
                { icon: Mail, label: "E-mail" },
                { icon: MapPin, label: "Visita" },
              ].map(({ icon: Icon, label }) => (
                <button
                  key={label}
                  type="button"
                  className="flex items-center gap-1 text-[9px] tracking-[0.18em] uppercase px-2.5 py-1 rounded-full transition-colors"
                  style={{
                    ...MONO,
                    color: "var(--voux-accent)",
                    border: "1px solid var(--voux-border-hover)",
                    backgroundColor: "transparent",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      "color-mix(in srgb, var(--voux-accent) 10%, transparent)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
                  }}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
