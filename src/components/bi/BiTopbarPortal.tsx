import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import {
  type CategoriaFilter,
  CATEGORIA_OPTIONS,
  getFunilOptions,
} from "@/lib/categoriaFunil";
import { toISODate } from "@/lib/dateUtils";
import { useListasFiltrosRpc } from "@/hooks/useListasFiltrosRpc";
import { cn } from "@/lib/utils";

/**
 * Renders BI filters inside the AppShell topbar via React Portal.
 * Target: <div id="topbar-actions"> in AppShellTopbar.
 */
export function BiTopbarPortal() {
  const {
    dateRange,
    setDateRange,
    categoria,
    setCategoria,
    funil,
    setFunil,
    vendedor,
    setVendedor,
    cidade,
    setCidade,
    tipoAcao,
    setTipoAcao,
    resetFilters,
    hasActiveFilter,
  } = useNegociosFilter();

  const [container, setContainer] = useState<HTMLElement | null>(null);
  const location = useLocation();

  // Categoria/funil não participam do contrato reconciliado de Negócios & Funil;
  // tipo de ação também não é filtro dessa visão. Escondê-los evita a falsa
  // impressão de que alteram KPIs calculados nas mesmas regras de /bi/acoes.
  const isRegistrosPage = location.pathname.includes("/crm/registros");
  const isResultadosNegociosPage = location.pathname === "/bi/comercial";
  const hideFunilFilters = isRegistrosPage || isResultadosNegociosPage;

  useEffect(() => {
    const el = document.getElementById("topbar-actions");
    setContainer(el);
  }, []);

  const funilOptions = getFunilOptions(categoria);

  // Fetch filter lists from server-side RPC (no client-side aggregation)
  const from = toISODate(dateRange?.from) ?? "";
  const to = toISODate(dateRange?.to ?? dateRange?.from) ?? "";
  const { data: listas } = useListasFiltrosRpc({ from, to, enabled: !!from && !!to });

  const vendedorOptions = listas?.vendedores ?? [];
  const cidadeOptions = listas?.cidades ?? [];

  if (!container) return null;

  return createPortal(
    <div className="flex items-center gap-2 flex-wrap">
      <DateRangePicker value={dateRange} onChange={setDateRange} />

      <Select
        value={categoria}
        onValueChange={(v) => setCategoria(v as CategoriaFilter)}
        aria-label="Filtro de categoria"
      >
        <SelectTrigger className={cn("h-7 w-full sm:w-[160px] text-[11px] bg-[var(--voux-card-from)] border-[var(--voux-card-border)] text-[var(--voux-text-primary)]", hideFunilFilters && "hidden")}>
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIA_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={funil} onValueChange={setFunil} aria-label="Filtro de funil">
        <SelectTrigger className={cn("h-7 w-full sm:w-[160px] text-[11px] bg-[var(--voux-card-from)] border-[var(--voux-card-border)] text-[var(--voux-text-primary)]", hideFunilFilters && "hidden")}>
          <SelectValue placeholder="Funil" />
        </SelectTrigger>
        <SelectContent>
          {funilOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={vendedor || "__all__"} onValueChange={(v) => setVendedor(v === "__all__" ? "" : v)} aria-label="Filtro de vendedor">
        <SelectTrigger className="h-7 w-full sm:w-[150px] text-[11px] bg-[var(--voux-card-from)] border-[var(--voux-card-border)] text-[var(--voux-text-primary)]">
          <SelectValue placeholder="Vendedor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos vendedores</SelectItem>
          {vendedorOptions.map((v) => (
            <SelectItem key={v} value={v}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={cidade || "__all__"} onValueChange={(v) => setCidade(v === "__all__" ? "" : v)} aria-label="Filtro de cidade">
        <SelectTrigger className="h-7 w-full sm:w-[150px] text-[11px] bg-[var(--voux-card-from)] border-[var(--voux-card-border)] text-[var(--voux-text-primary)]">
          <SelectValue placeholder="Cidade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todas cidades</SelectItem>
          {cidadeOptions.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={tipoAcao || "__all__"} onValueChange={(v) => setTipoAcao(v === "__all__" ? "" : v)} aria-label="Filtro de tipo de acao">
        <SelectTrigger className={cn("h-7 w-full sm:w-[160px] text-[11px] bg-[var(--voux-card-from)] border-[var(--voux-card-border)] text-[var(--voux-text-primary)]", isResultadosNegociosPage && "hidden")}>
          <SelectValue placeholder="Tipo de Acao" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos tipos</SelectItem>
          <SelectItem value="0 - Cliente Novo">0 - Cliente Novo</SelectItem>
          <SelectItem value="1 - Prospecção Maq">1 - Prospecção Maq</SelectItem>
          <SelectItem value="2 - Prospecção AP">2 - Prospecção AP</SelectItem>
          <SelectItem value="3 - Documentação">3 - Documentação</SelectItem>
          <SelectItem value="4 - Entrega setor maquinas">4 - Entrega setor maquinas</SelectItem>
          <SelectItem value="5 - Demonstração">5 - Demonstração</SelectItem>
          <SelectItem value="6 - Pós-Vendas Máquinas">6 - Pós-Vendas Máquinas</SelectItem>
          <SelectItem value="7 - Pós-Vendas AP">7 - Pós-Vendas AP</SelectItem>
          <SelectItem value="8 - Agendamento de coleta">8 - Agendamento de coleta</SelectItem>
          <SelectItem value="9 - Assuntos Financeiro">9 - Assuntos Financeiro</SelectItem>
          <SelectItem value="11- Repasse de máquina">11- Repasse de máquina</SelectItem>
        </SelectContent>
      </Select>

      {hasActiveFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={resetFilters}
          className="h-7 px-2 text-[11px] text-[var(--voux-text-muted)] hover:text-[var(--voux-text-primary)]"
        >
          <X className="h-3 w-3 mr-1" />
          Limpar
        </Button>
      )}
    </div>,
    container
  );
}
