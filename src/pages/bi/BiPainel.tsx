import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { usePainelKPIsRpc } from "@/hooks/bi/usePainelKPIsRpc";
import { usePedidosKPIsRpc } from "@/hooks/bi/usePedidosKPIsRpc";
import { useClientesKPIsRpc } from "@/hooks/bi/useClientesKPIsRpc";
import { useServicosKPIsRpc } from "@/hooks/bi/useServicosKPIsRpc";
import { useCrossKPIsRpc } from "@/hooks/bi/useCrossKPIsRpc";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PainelNegociosSection } from "@/components/bi/painel/PainelNegociosSection";
import { PainelValoresSection } from "@/components/bi/painel/PainelValoresSection";
import { PainelCrossSection } from "@/components/bi/painel/PainelCrossSection";
import { PainelPedidosSection } from "@/components/bi/painel/PainelPedidosSection";
import { PainelClientesSection } from "@/components/bi/painel/PainelClientesSection";
import { PainelServicosSection } from "@/components/bi/painel/PainelServicosSection";
import { PainelAcoesSection } from "@/components/bi/painel/PainelAcoesSection";
import { StatusDesconhecidoAlert } from "@/components/bi/painel/StatusDesconhecidoAlert";
import CrmEvolucaoCharts from "@/components/crm/CrmEvolucaoCharts";
import { ChartCard } from "@/components/bi/ChartCard";
import EvolucaoGPOChart from "@/components/bi/charts/EvolucaoGPOChart";
import { useEvolucaoGPO } from "@/hooks/useEvolucaoGPO";

export default function BiPainel() {
  const { dateRange, categoria, funil, vendedor, cidade } = useNegociosFilter();
  const { kpis, loading: painelLoading } = usePainelKPIsRpc(dateRange, categoria, funil, vendedor || undefined, cidade || undefined);
  const { kpis: pedKpis, isLoading: pedLoading } = usePedidosKPIsRpc(dateRange, categoria, funil, vendedor || undefined, cidade || undefined);
  const { kpis: cliKpis, isLoading: cliLoading } = useClientesKPIsRpc(dateRange, cidade || undefined);
  const { kpis: svcKpis, isLoading: svcLoading } = useServicosKPIsRpc(dateRange, cidade || undefined);
  const { kpis: crossKpis, isLoading: crossLoading } = useCrossKPIsRpc(dateRange, categoria, funil, vendedor || undefined, cidade || undefined);
  const { data: gpoData, isLoading: gpoLoading } = useEvolucaoGPO({ enabled: true });

  // Preserve every card and chart, but let a finished domain render while an
  // unrelated analytical RPC is still running. Previously one slow endpoint
  // kept the entire screen in skeleton state and looked like a frozen page.
  const negociosLoading = painelLoading.negocios || painelLoading.acoes;
  const valoresLoading = painelLoading.acoes || painelLoading.funil;
  const acoesLoading = painelLoading.acoes || painelLoading.funil || painelLoading.operacional;

  return (
    <section className="p-8 space-y-2" style={{ background: "var(--voux-bg)" }}>
      <Tabs defaultValue="cards" className="w-full">
        <TabsList>
          <TabsTrigger value="cards">Cards</TabsTrigger>
          <TabsTrigger value="graficos">Graficos</TabsTrigger>
        </TabsList>
        <TabsContent value="cards" className="space-y-2">
          <StatusDesconhecidoAlert count={kpis.negociosOutrosStatus} />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
            <PainelNegociosSection kpis={kpis} loading={negociosLoading} />
            <PainelCrossSection crossKpis={crossKpis} loading={crossLoading} />
            <PainelValoresSection kpis={kpis} loading={valoresLoading} />
            <PainelPedidosSection pedKpis={pedKpis} loading={pedLoading} />
            <PainelClientesSection cliKpis={cliKpis} loading={cliLoading} />
            <PainelServicosSection svcKpis={svcKpis} loading={svcLoading} />
          </div>
          <PainelAcoesSection kpis={kpis} loading={acoesLoading} />
          <ChartCard
            title="Desempenho Comercial"
            description="Vendas, perdas e novas oportunidades — últimos 12 meses"
            label="COMERCIAL · 12M"
            height={220}
            loading={gpoLoading}
          >
            <EvolucaoGPOChart data={gpoData ?? []} height={220} />
          </ChartCard>
        </TabsContent>
        <TabsContent value="graficos">
          <div className="space-y-4">
            <CrmEvolucaoCharts />
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
