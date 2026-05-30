import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { Wrench, AlertCircle, CheckCircle, Clock, Timer, FolderOpen } from "lucide-react";
import { useServicosData } from "@/hooks/bi/useServicosData";
import { KPICard } from "@/components/bi/KPICard";
import { ChartCard } from "@/components/bi/ChartCard";
import { CHART_COLORS } from "@/lib/chartColors";
import { formatDias } from "@/lib/dateUtils";

interface Props {
  active: boolean;
}

export default function ServicosSection({ active }: Props) {
  const { agg, isLoading } = useServicosData(active);
  const { kpis } = agg;

  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard title="Total OS" value={kpis.totalOS.toLocaleString("pt-BR")} icon={Wrench} loading={isLoading} />
        <KPICard title="OS Abertas" value={kpis.abertas.toLocaleString("pt-BR")} icon={FolderOpen} loading={isLoading} hint="backlog atual" />
        <KPICard title="Taxa de Fechamento" value={`${kpis.taxaFechamento.toFixed(1)}%`} icon={CheckCircle} loading={isLoading} />
        <KPICard title="Tempo Medio Resolucao" value={formatDias(kpis.tempoMedioResolucao)} icon={Clock} loading={isLoading} />
        <KPICard title="Mediana Resolucao" value={formatDias(kpis.tempoMedianoResolucao)} icon={Timer} loading={isLoading} hint="menos sensivel a outliers" />
        <KPICard title="Total Ocorrencias" value={kpis.totalOcorrencias.toLocaleString("pt-BR")} icon={AlertCircle} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="OS por Status" description="Distribuicao entre fechadas, abertas e canceladas" loading={isLoading}>
          <PieChart>
            <Pie data={agg.porStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
              {agg.porStatus.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ChartCard>

        <ChartCard title="Tempo de Resolucao por Faixa" description="Quantas OS sao resolvidas em cada janela de tempo" loading={isLoading}>
          <BarChart data={agg.faixasResolucao}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" name="OS" fill={CHART_COLORS[0]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Evolucao Mensal de Aberturas" description="Numero de OS abertas por mes" loading={isLoading}>
          <BarChart data={agg.evolucaoAberturas}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" name="OS abertas" fill={CHART_COLORS[1]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Atividade de Campo — Ocorrencias" description="Deslocamento, atendimento e pausas registradas pelos tecnicos" loading={isLoading}>
          <BarChart data={agg.situacaoOcorrencias} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
            <Tooltip />
            <Bar dataKey="value" fill={CHART_COLORS[2]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Motivos de Pausa" description="Gargalos operacionais (ex: aguardando pecas)" loading={isLoading}>
          <BarChart data={agg.motivosPausa} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
            <Tooltip />
            <Bar dataKey="value" fill={CHART_COLORS[5]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Causas de Atendimento Mais Comuns" description="Principais motivos de chamado tecnico" loading={isLoading}>
          <BarChart data={agg.causasAtendimento} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
            <Tooltip />
            <Bar dataKey="value" fill={CHART_COLORS[3]} />
          </BarChart>
        </ChartCard>
      </div>
    </div>
  );
}
