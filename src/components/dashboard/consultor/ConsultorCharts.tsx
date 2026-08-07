import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, BarChart, PieChart } from "@/components/bi/charts";
import type { PieChartData } from "@/components/bi/charts";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { formatMonthYear } from "@/lib/dateUtils";
import type { EvolucaoMensal, RegiaoVendedor } from "@/types/comercial";

interface Props {
  evolucao: EvolucaoMensal[];
  tiposAcao: Record<string, number>;
  regioes: RegiaoVendedor[];
}

export function ConsultorCharts({ evolucao, tiposAcao, regioes }: Props) {
  const tiposAcaoData = Object.entries(tiposAcao).map(([name, value]) => ({ name, value }));

  return (
    <>
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Evolução Mensal <InfoTooltip text="Por data de conclusão da ação" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              series={[
                { name: "Ações",  data: evolucao.map((d) => ({ x: formatMonthYear(d.YearMonth), y: d.acoes })) },
                { name: "Visitas", data: evolucao.map((d) => ({ x: formatMonthYear(d.YearMonth), y: d.visitas })) },
              ]}
              height={250}
            />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tipos de Ação</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <PieChart
              data={tiposAcaoData.map((t): PieChartData => ({ id: t.name, name: t.name, value: t.value }))}
              height={250}
              enableLabels
            />
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Regiões de Atuação</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart
            data={regioes.map((r) => ({ name: r.cidade, acoes: r.acoes }))}
            layout="vertical"
            keys={["acoes"]}
            height={200}
            tooltipFormatter={(val) => `${val} ações`}
          />
        </CardContent>
      </Card>
    </>
  );
}
