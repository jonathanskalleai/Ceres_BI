import { useState, useMemo } from "react";
import type { Registro, Filters } from "@/types/comercial";
import { ChevronDown, ChevronUp, Users, MapPin, Filter } from "lucide-react";
import { hasActiveFilters } from "@/lib/filterUtils";
import { SectionEyebrow } from "@/components/bi/SectionEyebrow";

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

const formatDate = (d: string) => {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
};

const medals = ["🥇", "🥈", "🥉"];

export const RankingClientesNovos = ({ registros, filters }: RankingClientesNovosProps) => {
  const [expandedConsultor, setExpandedConsultor] = useState<string | null>(null);
  const isFiltered = filters ? hasActiveFilters(filters) : false;

  const ranking = useMemo<ConsultorClientes[]>(() => {
    const map = new Map<string, Map<string, { cidade: string; acoes: number; ultimaAcao: string }>>();

    for (const r of registros) {
      if (!r.vendedor || !r.cliente) continue;
      if (!map.has(r.vendedor)) map.set(r.vendedor, new Map());
      const cMap = map.get(r.vendedor)!;
      if (!cMap.has(r.cliente)) {
        cMap.set(r.cliente, { cidade: r.cidade, acoes: 0, ultimaAcao: "" });
      }
      const c = cMap.get(r.cliente)!;
      c.acoes++;
      if (!c.cidade && r.cidade) c.cidade = r.cidade;
      if (r.dtConclusao > c.ultimaAcao) c.ultimaAcao = r.dtConclusao;
    }

    return Array.from(map.entries())
      .map(([nome, cMap]) => {
        const clientes = Array.from(cMap.entries())
          .map(([cNome, info]) => ({ nome: cNome, ...info }))
          .sort((a, b) => b.acoes - a.acoes);

        const regMap = new Map<string, number>();
        for (const c of clientes) {
          if (c.cidade) regMap.set(c.cidade, (regMap.get(c.cidade) || 0) + 1);
        }
        const regioes = Array.from(regMap.entries())
          .map(([cidade, qtd]) => ({ cidade, qtd }))
          .sort((a, b) => b.qtd - a.qtd);

        return { nome, totalClientes: clientes.length, clientes, regioes };
      })
      .sort((a, b) => b.totalClientes - a.totalClientes);
  }, [registros]);

  const toggle = (nome: string) =>
    setExpandedConsultor((prev) => (prev === nome ? null : nome));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <SectionEyebrow label="Ranking — Abertura de Clientes" />
        {isFiltered && (
          <span
            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
            style={{
              background: "color-mix(in srgb, var(--voux-accent) 10%, transparent)",
              color: "var(--voux-accent)",
              fontFamily: "var(--voux-font-mono)",
            }}
          >
            <Filter className="h-3 w-3" />
            Filtrado
          </span>
        )}
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "var(--surface-raised)",
          border: "1px solid var(--voux-card-border)",
          boxShadow: "var(--voux-card-shadow)",
        }}
      >
        <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--voux-card-border)" }}>
          <p
            className="text-[11px]"
            style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}
          >
            Clientes atendidos por consultor · Clique para expandir
          </p>
        </div>

        <div className="divide-y" style={{ borderColor: "var(--voux-card-border)" }}>
          {ranking.slice(0, 5).map((cons, idx) => {
            const isOpen = expandedConsultor === cons.nome;
            return (
              <div key={cons.nome}>
                <button
                  onClick={() => toggle(cons.nome)}
                  className="flex items-center gap-3 w-full px-5 py-3 text-left hover:bg-[color-mix(in_srgb,var(--voux-accent)_4%,transparent)] transition-colors"
                >
                  <span
                    className="w-8 text-center text-sm font-bold"
                    style={{ color: "var(--voux-text-muted)" }}
                  >
                    {idx < 3 ? medals[idx] : `${idx + 1}º`}
                  </span>
                  <span
                    className="flex-1 text-sm font-medium truncate"
                    style={{ color: "var(--voux-text-heading)" }}
                  >
                    {cons.nome}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
                    style={{
                      background: "color-mix(in srgb, var(--voux-accent) 10%, transparent)",
                      color: "var(--voux-accent)",
                      fontFamily: "var(--voux-font-mono)",
                    }}
                  >
                    <Users className="h-3 w-3" />
                    {cons.totalClientes}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border"
                    style={{
                      borderColor: "var(--voux-card-border)",
                      color: "var(--voux-text-muted)",
                      fontFamily: "var(--voux-font-mono)",
                    }}
                  >
                    <MapPin className="h-3 w-3" />
                    {cons.regioes.length}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" style={{ color: "var(--voux-text-faint)" }} />
                  ) : (
                    <ChevronDown className="h-4 w-4" style={{ color: "var(--voux-text-faint)" }} />
                  )}
                </button>

                {isOpen && (
                  <div
                    className="px-5 pb-5 pt-2 space-y-4 animate-in slide-in-from-top-2 duration-200"
                    style={{ background: "color-mix(in srgb, var(--voux-card-border) 20%, transparent)" }}
                  >
                    {/* Regiões */}
                    <div>
                      <h5
                        className="text-[10px] tracking-[0.14em] uppercase font-medium mb-2 flex items-center gap-1.5"
                        style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}
                      >
                        <MapPin className="h-3.5 w-3.5" style={{ color: "var(--voux-accent)" }} />
                        Regiões ({cons.regioes.length})
                      </h5>
                      <div className="flex flex-wrap gap-1.5">
                        {cons.regioes.map((r) => (
                          <span
                            key={r.cidade}
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border"
                            style={{
                              borderColor: "var(--voux-card-border)",
                              color: "var(--voux-text-heading)",
                              fontFamily: "var(--voux-font-mono)",
                            }}
                          >
                            {r.cidade}
                            <span className="font-bold" style={{ color: "var(--voux-accent)" }}>{r.qtd}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Clientes */}
                    <div>
                      <h5
                        className="text-[10px] tracking-[0.14em] uppercase font-medium mb-2 flex items-center gap-1.5"
                        style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}
                      >
                        <Users className="h-3.5 w-3.5" style={{ color: "var(--voux-accent)" }} />
                        Clientes ({cons.clientes.length})
                      </h5>
                      <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                        {cons.clientes.map((c) => (
                          <div
                            key={c.nome}
                            className="flex items-center gap-2 rounded-xl px-3 py-2 border"
                            style={{
                              borderColor: "var(--voux-card-border)",
                              background: "var(--surface-raised)",
                            }}
                          >
                            <span
                              className="flex-1 text-xs font-medium truncate"
                              style={{ color: "var(--voux-text-heading)" }}
                            >
                              {c.nome}
                            </span>
                            <span
                              className="text-[10px] px-2 py-0.5 rounded-full border shrink-0"
                              style={{
                                borderColor: "var(--voux-card-border)",
                                color: "var(--voux-text-muted)",
                                fontFamily: "var(--voux-font-mono)",
                              }}
                            >
                              {c.cidade || "—"}
                            </span>
                            <span
                              className="text-[10px] shrink-0"
                              style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}
                            >
                              {c.acoes} ações
                            </span>
                            <span
                              className="text-[10px] shrink-0"
                              style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}
                            >
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
      </div>
    </div>
  );
};
