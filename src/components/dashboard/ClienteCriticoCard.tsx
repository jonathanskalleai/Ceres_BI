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
  "relative overflow-hidden rounded-[20px] p-[22px_24px] bg-gradient-to-b from-[#18160f] to-[#11100d] border border-[rgba(214,207,193,0.08)] shadow-[0_2px_8px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,250,230,0.03)]";

const MONO: React.CSSProperties = {
  fontFamily: "var(--voux-font-mono, 'JetBrains Mono', monospace)",
};

const PRIORITY_COLORS: Record<string, string> = {
  CRÍTICA: "#f87171",
  ALTA: "#fb923c",
  MÉDIA: "#c8b99a",
};

const formatCurrency = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(0)}K` : `R$ ${v.toFixed(0)}`;

interface Props {
  c: ClienteCritico;
  sugestao: SugestaoAcao;
}

export function ClienteCriticoCard({ c, sugestao }: Props) {
  const prioColor = PRIORITY_COLORS[sugestao.prioridade] ?? "#c8b99a";

  return (
    <div className={CARD_BASE}>
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        {/* Client Info */}
        <div className="flex-1 min-w-0">
          {/* Name + days pill + priority badge */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="font-semibold text-sm text-[#ece5d4] truncate">{c.nome}</h4>

            <span
              className="text-[9px] tracking-[0.18em] uppercase px-2 py-0.5 rounded-full border"
              style={{
                ...MONO,
                color: "#f87171",
                borderColor: "rgba(248,113,113,0.4)",
                backgroundColor: "rgba(248,113,113,0.08)",
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
          <div className="flex items-center gap-4 text-[11px] text-[#8a8273] mb-3 flex-wrap" style={MONO}>
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
              { label: "Pipeline", value: formatCurrency(c.pipeline), color: "#c8b99a" },
              { label: "Ações", value: c.totalAcoes, color: "#ece5d4" },
              { label: "Visitas", value: c.visitas, color: "#ece5d4" },
              { label: "Última Ação", value: c.ultimoTipoAcao, color: "#8a8273" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="text-center p-2 rounded-[10px]"
                style={{
                  backgroundColor: "rgba(255,250,230,0.03)",
                  border: "1px solid rgba(214,207,193,0.06)",
                }}
              >
                <p className="text-sm font-bold" style={{ color, ...MONO }}>
                  {value}
                </p>
                <p className="text-[10px] text-[#8a8273] mt-0.5" style={MONO}>
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Last observation */}
          <div
            className="rounded-[10px] p-2 mb-3"
            style={{
              backgroundColor: "rgba(255,250,230,0.02)",
              border: "1px solid rgba(214,207,193,0.06)",
            }}
          >
            <p className="text-[10px] tracking-[0.22em] uppercase text-[#8a8273] mb-1" style={MONO}>
              ÚLTIMA OBSERVAÇÃO
            </p>
            <p className="text-xs text-[#ece5d4] line-clamp-2">{c.ultimaObs}</p>
          </div>

          {/* History */}
          {c.historico.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] tracking-[0.22em] uppercase text-[#8a8273] mb-1" style={MONO}>
                HISTÓRICO ({Math.min(c.historico.length, 5)} ÚLTIMOS REGISTROS)
              </p>
              <div className="space-y-1">
                {c.historico.slice(0, 5).map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px] text-[#8a8273]" style={MONO}>
                    <span className="shrink-0">{h.dtConclusao}</span>
                    <span
                      className="text-[9px] tracking-[0.14em] uppercase px-1.5 py-0.5 rounded-sm shrink-0"
                      style={{
                        color: "#c8b99a",
                        border: "1px solid rgba(200,185,154,0.3)",
                        backgroundColor: "rgba(200,185,154,0.06)",
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
              <p className="text-[10px] tracking-[0.18em] uppercase text-[#8a8273] mb-0.5" style={MONO}>
                O QUE FAZER
              </p>
              <p className="text-xs text-[#ece5d4]">{sugestao.acao}</p>
            </div>
            <div>
              <p className="text-[10px] tracking-[0.18em] uppercase text-[#8a8273] mb-0.5" style={MONO}>
                ARGUMENTAÇÃO
              </p>
              <p className="text-xs text-[#ece5d4]">{sugestao.argumentacao}</p>
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
                    color: "#c8b99a",
                    border: "1px solid rgba(200,185,154,0.4)",
                    backgroundColor: "transparent",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                      "rgba(200,185,154,0.1)";
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
