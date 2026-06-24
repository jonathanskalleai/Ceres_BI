import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { usePainelKPIsRpc } from "@/hooks/bi/usePainelKPIsRpc";
import { usePedidosKPIs } from "@/hooks/bi/usePedidosKPIs";
import { useClientesKPIs } from "@/hooks/bi/useClientesKPIs";
import { useServicosKPIs } from "@/hooks/bi/useServicosKPIs";
import { useCrossKPIs } from "@/hooks/bi/useCrossKPIs";
import { PainelNegociosSection } from "@/components/bi/painel/PainelNegociosSection";
import { PainelValoresSection } from "@/components/bi/painel/PainelValoresSection";
import { PainelCrossSection } from "@/components/bi/painel/PainelCrossSection";
import { PainelPedidosSection } from "@/components/bi/painel/PainelPedidosSection";
import { PainelClientesSection } from "@/components/bi/painel/PainelClientesSection";
import { PainelServicosSection } from "@/components/bi/painel/PainelServicosSection";
import { PainelAcoesSection } from "@/components/bi/painel/PainelAcoesSection";

export default function BiPainel() {
  const { dateRange, categoria, funil, vendedor, cidade } = useNegociosFilter();
  const { kpis, isLoading } = usePainelKPIsRpc(dateRange, categoria, funil, vendedor || undefined, cidade || undefined);
  const { kpis: pedKpis, isLoading: pedLoading } = usePedidosKPIs(dateRange, categoria, funil);
  const { kpis: cliKpis, isLoading: cliLoading } = useClientesKPIs(dateRange);
  const { kpis: svcKpis, isLoading: svcLoading } = useServicosKPIs(dateRange);
  const { kpis: crossKpis, isLoading: crossLoading } = useCrossKPIs(dateRange, categoria, funil);

  const anyLoading = isLoading || pedLoading || cliLoading || svcLoading || crossLoading;

  return (
    <section className="p-8 space-y-2" style={{ background: "var(--voux-bg)" }}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
        <PainelNegociosSection kpis={kpis} loading={anyLoading} />
        <PainelCrossSection crossKpis={crossKpis} loading={anyLoading} />
        <PainelValoresSection kpis={kpis} crossKpis={crossKpis} loading={anyLoading} />
        <PainelPedidosSection pedKpis={pedKpis} loading={anyLoading} />
        <PainelClientesSection cliKpis={cliKpis} loading={anyLoading} />
        <PainelServicosSection svcKpis={svcKpis} loading={anyLoading} />
      </div>
      <PainelAcoesSection kpis={kpis} loading={anyLoading} />
    </section>
  );
}
