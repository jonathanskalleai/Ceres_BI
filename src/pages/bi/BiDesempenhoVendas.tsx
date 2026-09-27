import { useMemo, useState } from "react";
import { type DateRange } from "react-day-picker";
import { endOfMonth, startOfMonth } from "date-fns";
import { toISODate, formatDateBR } from "@/lib/dateUtils";
import { ALL_FUNIS } from "@/lib/categoriaFunil";
import { cn } from "@/lib/utils";
import { useDesempenhoVendas } from "@/hooks/bi/useDesempenhoVendas";
import { usePedidosEsteira } from "@/hooks/bi/usePedidosEsteira";
import { BiErrorState } from "@/components/bi/BiErrorState";
import {
  DesempenhoFilterBar,
  type ActiveCrossFilter,
  type DesempenhoTab,
} from "@/components/bi/desempenho/DesempenhoFilterBar";
import { DesempenhoGanhosTab } from "@/components/bi/desempenho/DesempenhoGanhosTab";
import { DesempenhoPerdasTab } from "@/components/bi/desempenho/DesempenhoPerdasTab";
import { PedidosGanhosModal } from "@/components/bi/desempenho/PedidosGanhosModal";
import { NegociosPerdidosModal } from "@/components/bi/desempenho/NegociosPerdidosModal";
import type { DesempenhoTableSummary } from "@/components/bi/desempenho/DesempenhoTableCard";

export default function BiDesempenhoVendas() {
  const [activeTab, setActiveTab] = useState<DesempenhoTab>("ganhos");
  const currentYear = new Date().getFullYear();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  }));
  const [selectedVendedor, setSelectedVendedor] = useState("");
  const [selectedCidade, setSelectedCidade] = useState("");
  const [selectedFunis, setSelectedFunis] = useState<string[]>(() => [...ALL_FUNIS]);
  const [activeCrossFilter, setActiveCrossFilter] = useState<ActiveCrossFilter | null>(null);
  const [pedidosGanhosModalOpen, setPedidosGanhosModalOpen] = useState(false);
  const [negociosPerdidosModalOpen, setNegociosPerdidosModalOpen] = useState(false);

  const targetYear = dateRange?.from?.getFullYear() ?? currentYear;
  const handleCrossFilterClick = (type: ActiveCrossFilter["type"], label: string, value: string) => {
    setActiveCrossFilter((current) => (
      current?.type === type && current.value.toLowerCase() === value.toLowerCase()
        ? null
        : { type, label, value }
    ));
  };

  const filterOptions = useMemo(() => ({
    ano: targetYear,
    from: dateRange?.from ? toISODate(dateRange.from) : null,
    to: dateRange?.to ? toISODate(dateRange.to) : dateRange?.from ? toISODate(dateRange.from) : null,
    vendedor: activeCrossFilter?.type === "vendedor" ? activeCrossFilter.value : selectedVendedor || null,
    cidade: activeCrossFilter?.type === "cidade" ? activeCrossFilter.value : selectedCidade || null,
    funis: selectedFunis.length > 0 ? selectedFunis : ["__NONE__"],
    produto: activeCrossFilter?.type === "produto" ? activeCrossFilter.value : null,
    origem: activeCrossFilter?.type === "origem" ? activeCrossFilter.value : null,
    banco: activeCrossFilter?.type === "banco" ? activeCrossFilter.value : null,
    motivoPerda: activeCrossFilter?.type === "motivo" ? activeCrossFilter.value : null,
  }), [targetYear, dateRange, selectedVendedor, selectedCidade, selectedFunis, activeCrossFilter]);

  const { data, hasData, isLoading, isError, error, refetch, isFetching } = useDesempenhoVendas(filterOptions);
  const dataUnavailable = isError && !hasData;
  const { data: esteiraData, isLoading: esteiraLoading } = usePedidosEsteira({
    ano: targetYear,
    from: filterOptions.from,
    to: filterOptions.to,
    vendedor: filterOptions.vendedor,
    cidade: filterOptions.cidade,
    funis: filterOptions.funis,
  });
  const esteiraPeriodoLabel = filterOptions.from && filterOptions.to
    ? `${formatDateBR(filterOptions.from)} a ${formatDateBR(filterOptions.to)}`
    : `Ano ${targetYear}`;

  const vendedorOptions = useMemo(() => {
    const source = activeTab === "perdas" ? data.perdas?.rankingVendedores ?? [] : data.rankingVendedores;
    return Array.from(new Set(source.map((item) => item.name))).filter(Boolean);
  }, [activeTab, data.perdas?.rankingVendedores, data.rankingVendedores]);
  const cidadeOptions = useMemo(() => {
    const source = activeTab === "perdas" ? data.perdas?.rankingCidades ?? [] : data.rankingCidades;
    return Array.from(new Set(source.map((item) => item.name))).filter(Boolean);
  }, [activeTab, data.perdas?.rankingCidades, data.rankingCidades]);

  const isDefaultDateRange = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return false;
    const now = new Date();
    return toISODate(dateRange.from) === toISODate(startOfMonth(now)) && toISODate(dateRange.to) === toISODate(endOfMonth(now));
  }, [dateRange]);
  const isDefaultFunis = selectedFunis.length === ALL_FUNIS.length && ALL_FUNIS.every((funil) => selectedFunis.includes(funil));
  const hasActiveFilters = Boolean(!isDefaultDateRange || selectedVendedor || selectedCidade || !isDefaultFunis || activeCrossFilter);
  const handleResetFilters = () => {
    setDateRange({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
    setSelectedVendedor("");
    setSelectedCidade("");
    setSelectedFunis([...ALL_FUNIS]);
    setActiveCrossFilter(null);
  };

  const ganhosSummary: DesempenhoTableSummary = {
    totalQtd: data.kpis.totalPedidos,
    totalValor: data.kpis.faturamento,
    ticketMedio: data.kpis.ticketMedio,
  };
  const perdasSummary: DesempenhoTableSummary = {
    totalQtd: data.kpis.totalPerdido,
    totalValor: data.kpis.valorPerdido,
    ticketMedio: data.kpis.ticketMedioPerdido,
  };

  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-12 space-y-5 max-w-full">
      <DesempenhoFilterBar
        activeTab={activeTab}
        onTabChange={(tab) => { setActiveTab(tab); setActiveCrossFilter(null); }}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        funis={selectedFunis}
        onFunisChange={setSelectedFunis}
        vendedor={selectedVendedor}
        onVendedorChange={setSelectedVendedor}
        vendedorOptions={vendedorOptions}
        cidade={selectedCidade}
        onCidadeChange={setSelectedCidade}
        cidadeOptions={cidadeOptions}
        activeCrossFilter={activeCrossFilter}
        onClearCrossFilter={() => setActiveCrossFilter(null)}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
        onRefresh={() => void refetch()}
        isRefreshing={isFetching}
      />

      {dataUnavailable && <BiErrorState message={error?.message ?? "Não foi possível carregar o desempenho de vendas."} onRetry={() => void refetch()} />}
      {!dataUnavailable && activeTab === "ganhos" && <DesempenhoGanhosTab
        data={data}
        isLoading={isLoading}
        targetYear={targetYear}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        esteiraData={esteiraData}
        esteiraLoading={esteiraLoading}
        esteiraPeriodoLabel={esteiraPeriodoLabel}
        filterOptions={filterOptions}
        activeCrossFilter={activeCrossFilter}
        onCrossFilterClick={handleCrossFilterClick}
        ganhosSummary={ganhosSummary}
        perdasSummary={perdasSummary}
        onOpenPedidos={() => setPedidosGanhosModalOpen(true)}
        onOpenPerdidos={() => setNegociosPerdidosModalOpen(true)}
      />}
      {!dataUnavailable && activeTab === "perdas" && <DesempenhoPerdasTab
        data={data}
        isLoading={isLoading}
        targetYear={targetYear}
        filterOptions={filterOptions}
        activeCrossFilter={activeCrossFilter}
        onCrossFilterClick={handleCrossFilterClick}
        ganhosSummary={ganhosSummary}
        perdasSummary={perdasSummary}
        onOpenPedidos={() => setPedidosGanhosModalOpen(true)}
        onOpenPerdidos={() => setNegociosPerdidosModalOpen(true)}
      />}

      <PedidosGanhosModal open={pedidosGanhosModalOpen} onOpenChange={setPedidosGanhosModalOpen} from={filterOptions.from} to={filterOptions.to} vendedor={filterOptions.vendedor} cidade={filterOptions.cidade} funis={filterOptions.funis} produto={filterOptions.produto} origem={filterOptions.origem} banco={filterOptions.banco} periodoLabel={esteiraPeriodoLabel} />
      <NegociosPerdidosModal open={negociosPerdidosModalOpen} onOpenChange={setNegociosPerdidosModalOpen} from={filterOptions.from} to={filterOptions.to} vendedor={filterOptions.vendedor} cidade={filterOptions.cidade} funis={filterOptions.funis} produto={filterOptions.produto} origem={filterOptions.origem} motivoPerda={filterOptions.motivoPerda} periodoLabel={esteiraPeriodoLabel} />
    </div>
  );
}
