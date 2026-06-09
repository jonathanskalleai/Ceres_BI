import { useState, useMemo } from "react";
import { ClipboardList, MapPin, Users, Eye, UserCheck, Tag } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAcoesBI } from "@/hooks/bi/useAcoesBI";
import { useComercialData } from "@/hooks/useComercialData";
import { KPICard } from "@/components/bi/KPICard";
import { ChartCard } from "@/components/bi/ChartCard";
import { HorizontalBarChart, VerticalBarChart, PieChartWithLabels } from "@/components/bi/charts";
import { CHART_COLORS } from "@/lib/chartTheme";

interface Props {
  active: boolean;
  dateRange?: DateRange;
  categoria?: string;
  funil?: string;
}

const MESES = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Marco" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const ALL = "__all__";
const toFilter = (v: string) => (v === ALL ? "" : v);

export default function AcoesSection({ active, categoria, funil }: Props) {
  const [ano, setAno] = useState(ALL);
  const [mes, setMes] = useState(ALL);
  const [vendedor, setVendedor] = useState(ALL);
  const [tipoAcao, setTipoAcao] = useState(ALL);
  const [cidade, setCidade] = useState(ALL);

  const filters = useMemo(
    () => ({ ano: toFilter(ano), mes: toFilter(mes), vendedor: toFilter(vendedor), tipoAcao: toFilter(tipoAcao), cidade: toFilter(cidade) }),
    [ano, mes, vendedor, tipoAcao, cidade],
  );

  const { kpis, porVendedor, porCidade, porMes, porDiaSemana, porTipoAcao, porTipoContato, listaAnos, isLoading } =
    useAcoesBI(active, filters, categoria, funil);

  const { data: comercialData } = useComercialData();

  const listaVendedores = comercialData?.listaVendedores ?? [];
  const listaCidades = comercialData?.listaCidades ?? [];
  const listaTiposAcao = useMemo(() => {
    if (!comercialData?.tiposAcao) return [];
    return Object.keys(comercialData.tiposAcao).sort();
  }, [comercialData?.tiposAcao]);

  return (
    <div className="space-y-6 pt-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <Select value={ano} onValueChange={setAno}>
          <SelectTrigger className="w-[120px] h-9 text-sm">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            {listaAnos.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={mes} onValueChange={setMes}>
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue placeholder="Mes" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            {MESES.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={vendedor} onValueChange={setVendedor}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue placeholder="Vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            {listaVendedores.map((v) => (
              <SelectItem key={v} value={v}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tipoAcao} onValueChange={setTipoAcao}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue placeholder="Tipo Acao" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            {listaTiposAcao.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={cidade} onValueChange={setCidade}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue placeholder="Cidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas</SelectItem>
            {listaCidades.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard title="Total de Acoes" value={kpis.totalAcoes.toLocaleString("pt-BR")} icon={ClipboardList} loading={isLoading} />
        <KPICard title="Cidades Atendidas" value={kpis.cidades.toLocaleString("pt-BR")} icon={MapPin} loading={isLoading} />
        <KPICard title="Consultores Ativos" value={kpis.consultores.toLocaleString("pt-BR")} icon={Users} loading={isLoading} />
        <KPICard title="Total de Visitas" value={kpis.visitas.toLocaleString("pt-BR")} icon={Eye} loading={isLoading} />
        <KPICard title="Clientes Unicos" value={kpis.clientes.toLocaleString("pt-BR")} icon={UserCheck} loading={isLoading} />
        <KPICard title="Tipos de Acao" value={kpis.tiposAcaoDistintos.toLocaleString("pt-BR")} icon={Tag} loading={isLoading} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Acoes por Consultor" description="Top 15 por volume" loading={isLoading}>
          <HorizontalBarChart
            data={porVendedor.map((d) => ({ name: d.name, acoes: d.acoes }))}
            keys={["acoes"]}
            seriesLabels={{ acoes: "Ações" }}
            title=""
            colors={[CHART_COLORS[0]]}
          />
        </ChartCard>

        <ChartCard title="Evolucao Mensal de Acoes" description="Quantidade por mes" loading={isLoading}>
          <VerticalBarChart
            data={porMes.map((d) => ({ name: d.name, acoes: d.acoes }))}
            keys={["acoes"]}
            seriesLabels={{ acoes: "Ações" }}
            title=""
            colors={[CHART_COLORS[0]]}
          />
        </ChartCard>

        <ChartCard title="Acoes por Cidade" description="Top 15 cidades" loading={isLoading}>
          <HorizontalBarChart
            data={porCidade.map((d) => ({ name: d.name, acoes: d.acoes }))}
            keys={["acoes"]}
            seriesLabels={{ acoes: "Ações" }}
            title=""
            colors={[CHART_COLORS[2]]}
          />
        </ChartCard>

        <ChartCard title="Distribuicao por Tipo de Acao" description="Proporcao de cada tipo" loading={isLoading}>
          <PieChartWithLabels data={porTipoAcao} title="" />
        </ChartCard>

        <ChartCard title="Acoes por Dia da Semana" description="Concentracao semanal" loading={isLoading}>
          <VerticalBarChart
            data={porDiaSemana.map((d) => ({ name: d.name, acoes: d.acoes }))}
            keys={["acoes"]}
            seriesLabels={{ acoes: "Ações" }}
            title=""
            colors={[CHART_COLORS[4]]}
          />
        </ChartCard>

        <ChartCard title="Tipo de Contato" description="Distribuicao dos canais" loading={isLoading}>
          <PieChartWithLabels data={porTipoContato} title="" />
        </ChartCard>
      </div>
    </div>
  );
}
