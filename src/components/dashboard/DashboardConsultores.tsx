import { useMemo, useState } from "react";
import type { Vendedor, Registro, Filters } from "@/types/comercial";
import { CalendarDays, Users, ChevronDown, ChevronUp, FileSpreadsheet } from "lucide-react";
import { filterRegistros, hasActiveFilters } from "@/lib/filterUtils";
import { ResumoExecutivoCard } from "./consultor/ResumoExecutivoCard";
import { AiInsightsCard } from "./consultor/AiInsightsCard";
import { RankingClientesNovos } from "./RankingClientesNovos";
import { RankingPerformanceHorizontal } from "./RankingPerformanceHorizontal";
import { EquipeDesempenhoTable } from "./EquipeDesempenhoTable";
import { ConsultoresValidationTable } from "./ConsultoresValidationTable";
import type { RpcConsultorResumoAcoes } from "@/types/consultoresRpc";
import type { EquipeDesempenhoData } from "@/types/equipeDesempenho";
import { formatDateBR } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";

interface DashboardConsultoresProps {
  vendedores: Vendedor[];
  registros: Registro[];
  filters: Filters;
  resumo: RpcConsultorResumoAcoes[];
  onSelectConsultor: (nome: string) => void;
  anoDesempenho: number;
  desempenho: EquipeDesempenhoData;
  isAdmin: boolean;
}

export const DashboardConsultores = ({
  vendedores,
  registros,
  filters,
  resumo,
  onSelectConsultor,
  anoDesempenho,
  desempenho,
  isAdmin,
}: DashboardConsultoresProps) => {
  const isFiltered = hasActiveFilters(filters);
  const [showAuditoria, setShowAuditoria] = useState(false);

  const periodoLabel = filters.dateRange
    ? `${formatDateBR(filters.dateRange.from)} a ${formatDateBR(filters.dateRange.to)}`
    : "Período selecionado";

  const consultorNames = useMemo(
    () => vendedores.map((v) => v.nome),
    [vendedores]
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1920px] mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <h2
              className="text-lg sm:text-xl font-bold tracking-tight"
              style={{ fontFamily: "var(--voux-font-display)", color: "var(--voux-text-heading)" }}
            >
              Equipe Comercial & Consultores
            </h2>
            <p className="text-[12px] text-muted-foreground">
              Cockpit executivo de inteligência, ranking e desempenho da equipe
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] tabular-nums bg-background"
            style={{
              fontFamily: "var(--voux-font-mono)",
              color: "var(--voux-accent)",
              borderColor: "var(--voux-card-border)",
            }}
          >
            <CalendarDays className="h-3 w-3" />
            {periodoLabel}
          </span>
          <span
            className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-mono text-muted-foreground bg-background"
            style={{ borderColor: "var(--voux-card-border)" }}
          >
            {vendedores.length} consultores ativos
          </span>
        </div>
      </div>

      {/* Top 3-Column Grid: Resumo Executivo (Esq) | Insights da IA (Meio) | Clientes Atendidos (Dir) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
        <div className="h-full">
          <ResumoExecutivoCard resumo={resumo} />
        </div>
        <div className="h-full">
          <AiInsightsCard consultores={consultorNames} />
        </div>
        <div className="h-full md:col-span-2 lg:col-span-1">
          <RankingClientesNovos
            registros={isFiltered ? filterRegistros(registros, filters) : registros}
            filters={filters}
          />
        </div>
      </div>

      {/* Performance Ranking (Horizontal 5 Cards Row) */}
      <div className="w-full">
        <RankingPerformanceHorizontal
          vendedores={vendedores}
          resumo={resumo}
          onSelectConsultor={onSelectConsultor}
        />
      </div>

      {/* Team Performance Matrix Table (100% Full Width) */}
      <div className="w-full">
        <EquipeDesempenhoTable
          ano={anoDesempenho}
          data={desempenho}
          isAdmin={isAdmin}
        />
      </div>

      {/* Quadro de Conferência e Auditoria (Colapsável) */}
      <div className="pt-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowAuditoria(!showAuditoria)}
          className="h-8 gap-2 text-[12px] font-mono text-muted-foreground hover:text-foreground border"
          style={{ borderColor: "var(--voux-card-border)", background: "var(--surface-raised)" }}
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          <span>{showAuditoria ? "Ocultar quadro de conferência técnica" : "Abrir quadro de conferência e auditoria"}</span>
          {showAuditoria ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>

        {showAuditoria && (
          <div className="mt-3">
            <ConsultoresValidationTable
              resumo={resumo}
              from={filters.dateRange?.from ?? ""}
              to={filters.dateRange?.to ?? ""}
              onSelectConsultor={onSelectConsultor}
            />
          </div>
        )}
      </div>
    </div>
  );
};
