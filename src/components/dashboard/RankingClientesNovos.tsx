import { useState, useMemo, memo } from "react";
import type { Registro, Filters } from "@/types/comercial";
import { ChevronDown, ChevronUp, Users, MapPin, Building2 } from "lucide-react";
import { hasActiveFilters } from "@/lib/filterUtils";
import { cn } from "@/lib/utils";

interface RankingClientesNovosProps {
  registros: Registro[];
  filters?: Filters;
}

interface ConsultorClientes {
  nome: string;
  totalClientes: number;
  clientes: { nome: string; cidade: string; acoes: number; ultimaAcao: string }[];
  regioes: { cidade: string; qtd: number }[];
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const formatDate = (d: string) => {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
};

const AVATAR_COLORS = [
  "bg-sky-500/10 text-sky-600 dark:text-sky-300 border-sky-500/40 ring-sky-500/20",
  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border-emerald-500/40 ring-emerald-500/20",
  "bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/40 ring-purple-500/20",
  "bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/40 ring-amber-500/20",
  "bg-rose-500/10 text-rose-600 dark:text-rose-300 border-rose-500/40 ring-rose-500/20",
];

export const RankingClientesNovos = memo(function RankingClientesNovos({
  registros,
  filters,
}: RankingClientesNovosProps) {
  const [expandedConsultor, setExpandedConsultor] = useState<string | null>(null);
  const isFiltered = filters ? hasActiveFilters(filters) : false;

  const ranking = useMemo<ConsultorClientes[]>(() => {
    if (!registros.length) return [];
    const map = new Map<string, Map<string, { cidade: string; acoes: number; ultimaAcao: string }>>();

    for (let i = 0; i < registros.length; i++) {
      const r = registros[i];
      if (!r.vendedor || !r.cliente) continue;
      let cMap = map.get(r.vendedor);
      if (!cMap) {
        cMap = new Map();
        map.set(r.vendedor, cMap);
      }
      let c = cMap.get(r.cliente);
      if (!c) {
        c = { cidade: r.cidade, acoes: 1, ultimaAcao: r.dtConclusao };
        cMap.set(r.cliente, c);
      } else {
        c.acoes++;
        if (!c.cidade && r.cidade) c.cidade = r.cidade;
        if (r.dtConclusao > c.ultimaAcao) c.ultimaAcao = r.dtConclusao;
      }
    }

    const result: ConsultorClientes[] = [];
    for (const [nome, cMap] of map.entries()) {
      const clientes: { nome: string; cidade: string; acoes: number; ultimaAcao: string }[] = [];
      const regMap = new Map<string, number>();

      for (const [cNome, info] of cMap.entries()) {
        clientes.push({ nome: cNome, ...info });
        if (info.cidade) {
          regMap.set(info.cidade, (regMap.get(info.cidade) || 0) + 1);
        }
      }
      clientes.sort((a, b) => b.acoes - a.acoes);

      const regioes = Array.from(regMap.entries())
        .map(([cidade, qtd]) => ({ cidade, qtd }))
        .sort((a, b) => b.qtd - a.qtd);

      result.push({ nome, totalClientes: clientes.length, clientes, regioes });
    }

    return result.sort((a, b) => b.totalClientes - a.totalClientes);
  }, [registros]);

  const toggle = (nome: string) =>
    setExpandedConsultor((prev) => (prev === nome ? null : nome));

  return (
    <div
      className="flex flex-col justify-between h-full rounded-2xl border p-5 transition-all duration-200"
      style={{
        background: "var(--surface-raised)",
        borderColor: "var(--voux-card-border)",
        boxShadow: "var(--voux-card-shadow)",
      }}
    >
      {/* Header */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-sky-500" />
            <h3
              className="text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}
            >
              Clientes Atendidos
            </h3>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            {ranking.length} consultores{isFiltered ? " (filtrado)" : ""}
          </span>
        </div>

        {/* List of Consultants or Empty State */}
        {ranking.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-muted-foreground border rounded-xl" style={{ borderColor: "var(--voux-card-border)", background: "var(--surface-base)" }}>
            Nenhum registro de cliente no período selecionado.
          </div>
        ) : (
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {ranking.map((cons, idx) => {
              const isOpen = expandedConsultor === cons.nome;
              const initials = getInitials(cons.nome);
              const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];

              return (
                <div
                  key={cons.nome}
                  className="rounded-xl border overflow-hidden transition-all duration-200"
                  style={{ borderColor: "var(--voux-card-border)", background: "var(--surface-base)" }}
                >
                  <button
                    type="button"
                    onClick={() => toggle(cons.nome)}
                    className="flex items-center gap-3 w-full p-2.5 text-left transition-colors duration-150 hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                  >
                    {/* Avatar */}
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ring-1 font-mono font-bold text-[11px]",
                        avatarColor
                      )}
                    >
                      {initials}
                    </div>

                    {/* Name & Position */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-bold text-foreground" style={{ fontFamily: "var(--voux-font-sans)" }}>
                        <span className="text-muted-foreground font-mono mr-1 text-[11px]">{idx + 1}.</span>
                        {cons.nome}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-2 shrink-0 font-mono text-[11px] text-muted-foreground">
                      <span className="tabular-nums font-semibold text-foreground">
                        {cons.totalClientes} <span className="font-normal text-muted-foreground">cli</span>
                      </span>
                      <span>·</span>
                      <span className="tabular-nums">
                        {cons.regioes.length} <span className="font-normal">cid</span>
                      </span>
                    </div>

                    {isOpen ? (
                      <ChevronUp className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                  </button>

                  {/* Expanded Details */}
                  {isOpen && (
                    <div className="px-3 pb-3 pt-2 space-y-2.5 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
                      {/* Regiões / Cidades */}
                      <div>
                        <p
                          className="text-[10px] tracking-[0.12em] uppercase font-semibold mb-1.5 flex items-center gap-1 text-muted-foreground font-mono"
                        >
                          <MapPin className="h-3 w-3" /> Cidades Atendidas ({cons.regioes.length})
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {cons.regioes.map((r) => (
                            <span
                              key={r.cidade}
                              className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] bg-background"
                              style={{ borderColor: "var(--voux-card-border)" }}
                            >
                              <span>{r.cidade}</span>
                              <span className="font-mono font-bold text-sky-600 dark:text-sky-400">({r.qtd})</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Clientes */}
                      <div>
                        <p
                          className="text-[10px] tracking-[0.12em] uppercase font-semibold mb-1.5 flex items-center gap-1 text-muted-foreground font-mono"
                        >
                          <Building2 className="h-3 w-3" /> Clientes ({cons.clientes.length})
                        </p>
                        <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                          {cons.clientes.map((c) => (
                            <div
                              key={c.nome}
                              className="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1 text-[11px] bg-background"
                              style={{ borderColor: "var(--voux-card-border)" }}
                            >
                              <span className="truncate font-medium text-foreground flex-1">
                                {c.nome}
                              </span>
                              <span className="text-[10px] text-muted-foreground truncate shrink-0">
                                {c.cidade || "—"}
                              </span>
                              <span className="font-mono text-[10px] font-semibold text-sky-600 dark:text-sky-400 shrink-0">
                                {c.acoes} ações
                              </span>
                              <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                                {formatDate(c.ultimaAcao)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer hint */}
      <div className="pt-3 mt-3 border-t flex items-center justify-between text-[11px]" style={{ borderColor: "var(--voux-card-border)" }}>
        <span className="text-muted-foreground">Expanda para ver cidades e clientes atendidos</span>
      </div>
    </div>
  );
});
