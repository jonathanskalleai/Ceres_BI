import { useState, useMemo } from "react";
import { DadosComerciais, Registro, Filters } from "@/types/comercial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Users, MapPin, Filter } from "lucide-react";
import { hasActiveFilters } from "@/lib/filterUtils";

interface Props {
  data: DadosComerciais;
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

export const RankingClientesNovos = ({ data, registros, filters }: Props) => {
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
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle className="text-sm font-semibold">Ranking — Abertura de Clientes</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">
          Clientes atendidos por consultor · Clique para expandir
          {isFiltered && (
            <Badge variant="secondary" className="ml-2 text-[10px] gap-1">
              <Filter className="h-3 w-3" />
              Filtrado
            </Badge>
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-1">
        {ranking.slice(0, 5).map((cons, idx) => {
          const isOpen = expandedConsultor === cons.nome;
          return (
            <div key={cons.nome} className="border-b border-border/40 last:border-0">
              <button
                onClick={() => toggle(cons.nome)}
                className="flex items-center gap-3 w-full px-3 py-2.5 text-left hover:bg-muted/30 rounded transition-colors"
              >
                <span className="w-8 text-center text-sm font-bold text-muted-foreground">
                  {idx < 3 ? medals[idx] : `${idx + 1}º`}
                </span>
                <span className="flex-1 text-sm font-medium truncate">{cons.nome}</span>
                <Badge variant="secondary" className="text-xs gap-1">
                  <Users className="h-3 w-3" />
                  {cons.totalClientes}
                </Badge>
                <Badge variant="outline" className="text-xs gap-1">
                  <MapPin className="h-3 w-3" />
                  {cons.regioes.length}
                </Badge>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-1 space-y-4 animate-in slide-in-from-top-2 duration-200 bg-muted/10 rounded-b-lg">
                  {/* Regiões */}
                  <div>
                    <h5 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-accent" />
                      Regiões ({cons.regioes.length})
                    </h5>
                    <div className="flex flex-wrap gap-1.5">
                      {cons.regioes.map((r) => (
                        <Badge key={r.cidade} variant="outline" className="text-[10px] gap-1">
                          {r.cidade}
                          <span className="font-bold text-primary">{r.qtd}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Clientes */}
                  <div>
                    <h5 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-primary" />
                      Clientes ({cons.clientes.length})
                    </h5>
                    <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
                      {cons.clientes.map((c) => (
                        <div
                          key={c.nome}
                          className="flex items-center gap-2 bg-card rounded-lg px-3 py-2 shadow-sm border border-border/50"
                        >
                          <span className="flex-1 text-xs font-medium truncate">{c.nome}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">
                            {c.cidade || "—"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {c.acoes} ações
                          </span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
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
      </CardContent>
    </Card>
  );
};
