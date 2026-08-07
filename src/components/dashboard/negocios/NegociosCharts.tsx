import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, LineChart, PieChart, ComboChart } from "@/components/bi/charts";
import type { PieChartData } from "@/components/bi/charts";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { formatMonthYear } from "@/lib/dateUtils";
import type {
  RpcNegociosSummary,
  RpcNegociosEvolucao,
  RpcNegociosConsultor,
  RpcNegociosRegiao,
} from "@/types/negociosCrm";
import type { DadosComerciais } from "@/types/comercial";

interface Props {
  summary: RpcNegociosSummary;
  evolucaoMensal: RpcNegociosEvolucao[];
  porConsultor: RpcNegociosConsultor[];
  porRegiao: RpcNegociosRegiao[];
  crmData: DadosComerciais;
}

const fmtCurrency = (v: number) => {
  const n = isFinite(v) ? v : 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

export function NegociosCharts({ summary, evolucaoMensal, porConsultor, porRegiao, crmData }: Props) {
  const conclusaoData = [
    { name: "Ganho", value: summary.ganhos },
    { name: "Em andamento", value: summary.emAndamento },
    { name: "Perdido", value: summary.perdidos },
  ].filter((d) => d.value > 0);

  const crossRef = useMemo(() => {
    if (!crmData) return [];
    const visitaMap = new Map<string, number>();
    for (const r of crmData.registrosRecentes) {
      if (r.tipoContato?.toLowerCase().includes("visita") && r.vendedor) {
        visitaMap.set(r.vendedor, (visitaMap.get(r.vendedor) || 0) + 1);
      }
    }
    return porConsultor.map((c) => {
      const normalName = c.nome.toUpperCase().trim();
      let visitas = 0;
      for (const [k, v] of visitaMap) {
        if (k.toUpperCase().trim() === normalName) { visitas = v; break; }
      }
      return { nome: c.nome.split(" ").slice(-1)[0], visitas, negocios: c.total, ganhos: c.ganhos, conversao: c.conversao, full: c.nome };
    }).filter((c) => c.visitas > 0 || c.negocios > 0).slice(0, 15);
  }, [porConsultor, crmData]);

  const acaoVsFechamento = useMemo(() => {
    if (!crmData) return [];
    const tipoMap = new Map<string, { acoes: number; fechamentos: number }>();
    for (const r of crmData.registrosRecentes) {
      if (!r.tipoAcao) continue;
      if (!tipoMap.has(r.tipoAcao)) tipoMap.set(r.tipoAcao, { acoes: 0, fechamentos: 0 });
      tipoMap.get(r.tipoAcao)!.acoes++;
    }
    for (const r of crmData.registrosRecentes) {
      if (r.tipoAcao && r.negocioValor > 0) {
        if (tipoMap.has(r.tipoAcao)) tipoMap.get(r.tipoAcao)!.fechamentos++;
      }
    }
    return Array.from(tipoMap.entries())
      .map(([tipo, v]) => ({ tipo, ...v, taxa: v.acoes > 0 ? Math.round((v.fechamentos / v.acoes) * 100) : 0 }))
      .sort((a, b) => b.acoes - a.acoes)
      .slice(0, 10);
  }, [crmData]);

  return (
    <div className="space-y-6">
      {/* Row 1 */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Evolução Mensal de Negócios <InfoTooltip text="Por data de cadastro do negócio" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ComboChart
              data={evolucaoMensal.map((d) => ({ name: formatMonthYear(d.mes), total: d.total, ganhos: d.ganhos, valor: d.valor }))}
              barKeys={["total", "ganhos"]}
              lineKey="valor"
              seriesLabels={{ total: "Negócios", ganhos: "Ganhos", valor: "Valor" }}
              height={280}
              tooltipFormatter={(v, key) => key === "valor" ? fmtCurrency(v) : v.toString()}
            />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Ranking Consultores por Negócios</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={porConsultor.slice(0, 10).map((c) => ({ name: c.nome.split(" ").slice(-1)[0], valor: c.valor }))}
              layout="horizontal"
              keys={["valor"]}
              height={280}
              tooltipFormatter={(v) => fmtCurrency(v)}
              seriesLabels={{ valor: "Valor" }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Row 2 */}
      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Status dos Negócios</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <PieChart
              data={conclusaoData.map((d): PieChartData => ({ id: d.name, name: d.name, value: d.value }))}
              height={220}
              enableLabels
              colors={["var(--voux-success)", "var(--voux-info)", "var(--voux-danger)"]}
            />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Regiões por Volume de Negócios</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={porRegiao.slice(0, 10).map((r) => ({ name: r.regiao, valor: r.valor }))}
              layout="vertical"
              keys={["valor"]}
              height={220}
              tooltipFormatter={(v) => fmtCurrency(v)}
            />
          </CardContent>
        </Card>
      </div>

      {/* Cross-reference charts */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Comparativo: Visitas CRM vs Negócios Fechados</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart
            data={crossRef.map((c) => ({ name: c.nome, visitas: c.visitas, negocios: c.negocios, ganhos: c.ganhos }))}
            layout="vertical"
            keys={["visitas", "negocios", "ganhos"]}
            height={300}
            seriesLabels={{ visitas: "Visitas (CRM)", negocios: "Negócios", ganhos: "Ganhos" }}
          />
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Relação Tipo de Ação vs Fechamento (CRM)</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart
            data={acaoVsFechamento.map((a) => ({ name: a.tipo, acoes: a.acoes, fechamentos: a.fechamentos }))}
            layout="horizontal"
            keys={["acoes", "fechamentos"]}
            height={250}
            seriesLabels={{ acoes: "Ações", fechamentos: "Com Negócio" }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
