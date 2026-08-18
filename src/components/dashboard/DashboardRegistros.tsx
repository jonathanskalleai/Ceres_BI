import { useState, useMemo } from "react";
import type { Registro, Filters } from "@/types/comercial";
import { Search, ChevronLeft, ChevronRight, X } from "lucide-react";
import { filterRegistros } from "@/lib/filterUtils";
import { formatDateTimeBR } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";

interface DashboardRegistrosProps {
  registros: Registro[];
  filters: Filters;
  clientSearch?: string;
  onClientSearchChange?: (v: string) => void;
  isSearchingYear?: boolean;
}

const PAGE_SIZE = 50;

const fmtCurrency = (v: number) => v > 0 ? `R$ ${(v / 1e3).toFixed(0)}K` : "—";

/** Mapa de cores para tipos de ação — fundo sólido forte (mesma paleta do gráfico de pizza) */
const ACAO_COLORS: Record<string, { bg: string; text: string }> = {
  "0 - Cliente Novo":           { bg: "#4caf7a", text: "#fff" },
  "1 - Prospecção Maq":         { bg: "#c97565", text: "#fff" },
  "2 - Prospecção AP":          { bg: "#d4a05a", text: "#fff" },
  "3 - Documentação":           { bg: "#6e542f", text: "#fff" },
  "4 - Entrega setor maquinas": { bg: "#7a9b6f", text: "#fff" },
  "5 - Demonstração":           { bg: "#8ea3b8", text: "#1a1a1a" },
  "6 - Pós-Vendas Máquinas":    { bg: "#d4b896", text: "#3d2e1a" },
  "7 - Pós-Vendas AP":          { bg: "#d4b896", text: "#3d2e1a" },
  "8 - Agendamento de coleta":  { bg: "#3d7c47", text: "#fff" },
  "9 - Assuntos Financeiro":    { bg: "#c0392b", text: "#fff" },
  "11- Repasse de máquina":     { bg: "#5a7a96", text: "#fff" },
};

/** Mapa de cores para tipo de contato — fundo sólido forte */
const CONTATO_COLORS: Record<string, { bg: string; text: string }> = {
  "Visita":             { bg: "#4caf7a", text: "#fff" },
  "Visita Presencial":  { bg: "#4caf7a", text: "#fff" },
  "Telefonema":         { bg: "#d4a05a", text: "#fff" },
  "WhatsApp":           { bg: "#7a9b6f", text: "#fff" },
  "E-mail":             { bg: "#8ea3b8", text: "#1a1a1a" },
  "Telefone/WhatsApp":  { bg: "#d4a05a", text: "#fff" },
};

const DEFAULT_TAG = { bg: "#8a8273", text: "#fff" };

function getAcaoColor(tipo: string) { return ACAO_COLORS[tipo] ?? DEFAULT_TAG; }
function getContatoColor(tipo: string) { return CONTATO_COLORS[tipo] ?? DEFAULT_TAG; }

/** Modal de detalhe do registro */
function RegistroModal({ registro, onClose }: { registro: Registro; onClose: () => void }) {
  const acaoColor = getAcaoColor(registro.tipoAcao || "");
  const contatoColor = getContatoColor(registro.tipoContato || "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      {/* Backdrop com blur */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      {/* Content */}
      <div
        className="relative rounded-2xl border p-6 w-full max-w-2xl mx-4 space-y-4 shadow-xl animate-in zoom-in-95 duration-200"
        style={{ borderColor: "var(--voux-card-border)", background: "var(--surface-raised)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-md p-1.5 transition-colors hover:bg-[rgba(0,0,0,0.05)]"
          style={{ color: "var(--voux-text-faint)" }}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div>
          <p className="text-[10px] tracking-[0.08em] uppercase font-semibold" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>
            REGISTRO DE ATIVIDADE
          </p>
          <h3 className="text-lg font-semibold mt-1" style={{ fontFamily: "var(--voux-font-display)", color: "var(--voux-text-heading)" }}>
            {registro.cliente}
          </h3>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] tracking-[0.08em] uppercase font-medium mb-1" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>DATA</p>
            <p className="text-[14px] tabular-nums" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-primary)" }}>{formatDateTimeBR(registro.dtConclusao)}</p>
          </div>
          <div>
            <p className="text-[10px] tracking-[0.08em] uppercase font-medium mb-1" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>CONSULTOR</p>
            <p className="text-[14px]" style={{ color: "var(--voux-text-primary)" }}>{registro.vendedor}</p>
          </div>
          <div>
            <p className="text-[10px] tracking-[0.08em] uppercase font-medium mb-1" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>CIDADE</p>
            <p className="text-[14px]" style={{ color: "var(--voux-text-primary)" }}>{registro.cidade || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] tracking-[0.08em] uppercase font-medium mb-1" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>VALOR</p>
            <p className="text-[16px] font-bold tabular-nums" style={{ fontFamily: "var(--voux-font-mono)", color: registro.negocioValor > 0 ? "#4caf7a" : "var(--voux-text-faint)" }}>
              {registro.negocioValor > 0 ? `R$ ${registro.negocioValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
            </p>
          </div>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-2">
          <span className="rounded-md px-2.5 py-1 text-[12px] font-medium" style={{ background: contatoColor.bg, color: contatoColor.text }}>
            {registro.tipoContato || "—"}
          </span>
          <span className="rounded-md px-2.5 py-1 text-[12px] font-medium" style={{ background: acaoColor.bg, color: acaoColor.text }}>
            {registro.tipoAcao || "—"}
          </span>
          {registro.negocioEtapa && (
            <span className="rounded-md px-2.5 py-1 text-[12px] font-medium" style={{ background: "rgba(214,207,193,0.2)", color: "var(--voux-text-primary)" }}>
              {registro.negocioEtapa}
            </span>
          )}
        </div>

        {/* Observação */}
        {registro.obs && (
          <div className="pt-3 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
            <p className="text-[10px] tracking-[0.08em] uppercase font-medium mb-2" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>
              OBSERVAÇÃO
            </p>
            <p className="text-[14px] leading-relaxed whitespace-pre-line" style={{ color: "var(--voux-text-primary)" }}>
              {registro.obs}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export const DashboardRegistros = ({
  registros,
  filters,
  clientSearch = "",
  onClientSearchChange,
  isSearchingYear = false,
}: DashboardRegistrosProps) => {
  const [localSearch, setLocalSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedRegistro, setSelectedRegistro] = useState<Registro | null>(null);

  const search = onClientSearchChange ? clientSearch : localSearch;
  const setSearch = onClientSearchChange ?? setLocalSearch;

  const filtered = useMemo(() => {
    let result = isSearchingYear ? registros : filterRegistros(registros, filters);

    if (search && search.length >= 3) {
      const s = search.toLowerCase();
      result = result.filter((r) =>
        r.cliente.toLowerCase().includes(s) ||
        r.vendedor.toLowerCase().includes(s) ||
        r.cidade.toLowerCase().includes(s) ||
        (r.obs || "").toLowerCase().includes(s) ||
        (r.tipoAcao || "").toLowerCase().includes(s) ||
        (r.tipoContato || "").toLowerCase().includes(s)
      );
    }

    if (filters.tipoAcao && !isSearchingYear) {
      result = result.filter((r) => r.tipoAcao === filters.tipoAcao);
    }

    return result;
  }, [registros, filters, search, isSearchingYear]);

  const filteredLen = filtered.length;
  useMemo(() => setPage(0), [filteredLen]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const TH = "text-[10px] tracking-[0.08em] uppercase font-semibold py-2.5 px-2";
  const TD = "py-2.5 px-2";

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            className="text-lg font-semibold tracking-tight"
            style={{ fontFamily: "var(--voux-font-display)", color: "var(--voux-text-heading)" }}
          >
            Atividades
          </h2>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--voux-text-faint)" }}>
            {filtered.length} ações {isSearchingYear ? "no ano" : "no período"}
            {isSearchingYear && (
              <span
                className="ml-2 inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium"
                style={{ background: "rgba(76,175,122,0.12)", color: "#4caf7a" }}
              >
                Buscando no ano inteiro
              </span>
            )}
          </p>
        </div>
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5" style={{ color: "var(--voux-text-faint)" }} />
          <input
            type="text"
            placeholder="Buscar cliente (3+ letras busca no ano inteiro)..."
            className="w-full rounded-lg border pl-9 pr-3 py-2 text-[13px] outline-none transition-colors focus:border-[var(--voux-accent)]"
            style={{ borderColor: "var(--voux-card-border)", background: "var(--surface-raised)", color: "var(--voux-text-primary)" }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div
        className="rounded-xl border overflow-hidden"
        style={{ borderColor: "var(--voux-card-border)", background: "var(--surface-raised)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]" style={{ fontFamily: "var(--voux-font-sans)" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--voux-card-border)" }}>
                <th className={cn(TH, "text-left w-[120px]")} style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>DATA</th>
                <th className={cn(TH, "text-left w-[150px]")} style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>CLIENTE</th>
                <th className={cn(TH, "text-left w-[80px]")} style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>CIDADE</th>
                <th className={cn(TH, "text-left w-[90px]")} style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>CONSULTOR</th>
                <th className={cn(TH, "text-left w-[100px]")} style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>CONTATO</th>
                <th className={cn(TH, "text-left w-[130px]")} style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>AÇÃO</th>
                <th className={cn(TH, "text-center w-[70px]")} style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>VALOR</th>
                <th className={cn(TH, "text-left")} style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>OBSERVAÇÃO</th>
              </tr>
            </thead>
            <tbody>
              {pageData.map((r, i) => {
                const acaoColor = getAcaoColor(r.tipoAcao || "");
                const contatoColor = getContatoColor(r.tipoContato || "");
                return (
                  <tr
                    key={`${r.numero}-${i}`}
                    className="transition-colors duration-150 cursor-pointer hover:bg-[rgba(0,0,0,0.035)]"
                    style={{ borderBottom: "1px solid var(--voux-card-border)" }}
                    onDoubleClick={() => setSelectedRegistro(r)}
                  >
                    <td className={cn(TD, "tabular-nums whitespace-nowrap text-[13px]")} style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}>
                      {formatDateTimeBR(r.dtConclusao)}
                    </td>
                    <td className={cn(TD, "text-[14px] font-medium")} style={{ color: "var(--voux-text-heading)" }}>
                      <span className="truncate block max-w-[150px]">{r.cliente}</span>
                    </td>
                    <td className={cn(TD, "text-[13px]")} style={{ color: "var(--voux-text-muted)" }}>{r.cidade || "—"}</td>
                    <td className={cn(TD, "text-[13px]")} style={{ color: "var(--voux-text-primary)" }}>
                      {r.vendedor.split(" ").slice(-1)[0]}
                    </td>
                    <td className={TD}>
                      <span
                        className="inline-block rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
                        style={{ background: contatoColor.bg, color: contatoColor.text }}
                      >
                        {r.tipoContato || "—"}
                      </span>
                    </td>
                    <td className={TD}>
                      <span
                        className="inline-block rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap"
                        style={{ background: acaoColor.bg, color: acaoColor.text }}
                      >
                        {r.tipoAcao || "—"}
                      </span>
                    </td>
                    <td className={cn(TD, "text-center tabular-nums font-bold text-[14px]")} style={{ fontFamily: "var(--voux-font-mono)", color: r.negocioValor > 0 ? "#4caf7a" : "var(--voux-text-faint)" }}>
                      {fmtCurrency(r.negocioValor)}
                    </td>
                    <td className={TD}>
                      <span className="block text-[13px] leading-relaxed line-clamp-2" style={{ color: "var(--voux-text-muted)" }}>
                        {r.obs || "—"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {pageData.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[14px]" style={{ color: "var(--voux-text-faint)" }}>
                    {search.length > 0 && search.length < 3
                      ? "Digite pelo menos 3 letras para buscar..."
                      : "Nenhuma ação encontrada."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        {totalPages > 1 && (
          <div
            className="flex items-center justify-between px-4 py-3 border-t"
            style={{ borderColor: "var(--voux-card-border)" }}
          >
            <span className="text-[11px] tabular-nums" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-md p-1.5 transition-colors disabled:opacity-30 hover:bg-[rgba(0,0,0,0.04)]"
                style={{ color: "var(--voux-text-muted)" }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-[11px] tabular-nums px-2" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-primary)" }}>
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-md p-1.5 transition-colors disabled:opacity-30 hover:bg-[rgba(0,0,0,0.04)]"
                style={{ color: "var(--voux-text-muted)" }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de detalhe */}
      {selectedRegistro && (
        <RegistroModal registro={selectedRegistro} onClose={() => setSelectedRegistro(null)} />
      )}
    </div>
  );
};
