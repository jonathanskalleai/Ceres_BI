import { useState, useMemo } from "react";
import type { Registro, Filters } from "@/types/comercial";
import { ChevronDown, ChevronUp } from "lucide-react";
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

const formatDate = (d: string) => {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
};

const CARD = "rounded-xl border";

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

  if (ranking.length === 0) return null;

  return (
    <div
      className={cn(CARD, "overflow-hidden")}
      style={{ borderColor: "var(--voux-card-border)", background: "var(--surface-raised)" }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <p
          className="text-[10px] tracking-[0.12em] uppercase font-medium"
          style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}
        >
          POR CONSULTOR
        </p>
        <h3
          className="text-sm font-semibold mt-1"
          style={{ fontFamily: "var(--voux-font-display)", color: "var(--voux-text-heading)" }}
        >
          Clientes atendidos
        </h3>
        <p className="text-[11px] mt-0.5" style={{ color: "var(--voux-text-faint)" }}>
          {ranking.length} consultores{isFiltered ? " (filtrado)" : ""} · clique para expandir
        </p>
      </div>

      {/* List */}
      <div>
        {ranking.slice(0, 8).map((cons, idx) => {
          const isOpen = expandedConsultor === cons.nome;
          return (
            <div key={cons.nome} className="border-t" style={{ borderColor: "var(--voux-card-border)" }}>
              <button
                onClick={() => toggle(cons.nome)}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors duration-150 hover:bg-[rgba(0,0,0,0.02)]"
              >
                <span
                  className="w-6 text-center text-[11px] font-bold shrink-0"
                  style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}
                >
                  {idx + 1}
                </span>
                <span
                  className="flex-1 text-[13px] font-medium truncate"
                  style={{ fontFamily: "var(--voux-font-sans)", color: "var(--voux-text-heading)" }}
                >
                  {cons.nome}
                </span>
                <span
                  className="text-[11px] tabular-nums shrink-0"
                  style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}
                >
                  {cons.totalClientes} clientes
                </span>
                <span
                  className="text-[11px] tabular-nums shrink-0"
                  style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}
                >
                  {cons.regioes.length} cidades
                </span>
                {isOpen
                  ? <ChevronUp className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--voux-text-faint)" }} />
                  : <ChevronDown className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--voux-text-faint)" }} />}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-2 space-y-3" style={{ background: "var(--surface-base)" }}>
                  {/* Regiões */}
                  <div>
                    <p
                      className="text-[10px] tracking-[0.12em] uppercase font-medium mb-1.5"
                      style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}
                    >
                      REGIÕES ({cons.regioes.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {cons.regioes.map((r) => (
                        <span
                          key={r.cidade}
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px]"
                          style={{ borderColor: "var(--voux-card-border)", color: "var(--voux-text-primary)" }}
                        >
                          {r.cidade}
                          <span className="font-bold" style={{ color: "var(--voux-accent)" }}>{r.qtd}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Clientes */}
                  <div>
                    <p
                      className="text-[10px] tracking-[0.12em] uppercase font-medium mb-1.5"
                      style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}
                    >
                      CLIENTES ({cons.clientes.length})
                    </p>
                    <div className="max-h-56 overflow-y-auto space-y-1">
                      {cons.clientes.map((c) => (
                        <div
                          key={c.nome}
                          className="flex items-center gap-2 rounded-md border px-3 py-1.5"
                          style={{ borderColor: "var(--voux-card-border)", background: "var(--surface-raised)" }}
                        >
                          <span className="flex-1 text-[12px] font-medium truncate" style={{ color: "var(--voux-text-primary)" }}>
                            {c.nome}
                          </span>
                          <span className="text-[10px] shrink-0" style={{ color: "var(--voux-text-faint)" }}>
                            {c.cidade || "—"}
                          </span>
                          <span className="text-[10px] tabular-nums shrink-0" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}>
                            {c.acoes} ações
                          </span>
                          <span className="text-[10px] tabular-nums shrink-0" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>
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
  );
};
