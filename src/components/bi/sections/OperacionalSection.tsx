import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { Users, Route, Activity, Coffee, Calendar, CheckCircle } from "lucide-react";
import { useOperacionalData } from "@/hooks/bi/useOperacionalData";
import { KPICard } from "@/components/bi/KPICard";
import { ChartCard } from "@/components/bi/ChartCard";
import { CHART_COLORS, COLOR_POSITIVE, COLOR_NEGATIVE } from "@/lib/chartColors";

interface Props {
  active: boolean;
}

const pct = (v: number) => `${v.toFixed(1)}%`;

export default function OperacionalSection({ active }: Props) {
  const { agg, isLoading } = useOperacionalData(active);
  const { kpis } = agg;

  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard title="Tecnicos Ativos" value={kpis.tecnicosAtivos.toLocaleString("pt-BR")} icon={Users} loading={isLoading} />
        <KPICard title="KM Rodado" value={kpis.kmTotal.toLocaleString("pt-BR")} icon={Route} loading={isLoading} hint="total da frota tecnica" />
        <KPICard title="Utilizacao Media" value={pct(kpis.utilizacaoMedia)} icon={Activity} loading={isLoading} hint="atendimento + deslocamento" />
        <KPICard title="Tempo Ocioso" value={pct(kpis.percentOcioso)} icon={Coffee} loading={isLoading} hint="% do tempo disponivel" />
        <KPICard title="Eventos Agenda" value={kpis.eventosAgenda.toLocaleString("pt-BR")} icon={Calendar} loading={isLoading} />
        <KPICard title="Conclusao Agenda" value={pct(kpis.taxaConclusaoAgenda)} icon={CheckCircle} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard
          title="Utilizacao por Tecnico"
          description="% do tempo em atendimento, deslocamento e ocioso"
          loading={isLoading}
          height={300}
        >
          <BarChart data={agg.utilizacaoPorTecnico} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v: number) => `${Math.round(v)}%`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
            <Tooltip formatter={(v: number) => pct(v)} />
            <Legend />
            <Bar dataKey="atendimento" stackId="a" name="Atendimento" fill={COLOR_POSITIVE} />
            <Bar dataKey="deslocamento" stackId="a" name="Deslocamento" fill={CHART_COLORS[1]} />
            <Bar dataKey="ocioso" stackId="a" name="Ocioso" fill={COLOR_NEGATIVE} />
          </BarChart>
        </ChartCard>

        <ChartCard title="KM Rodado por Tecnico" description="Distancia percorrida em atendimentos de campo" loading={isLoading} height={300}>
          <BarChart data={agg.kmPorTecnico} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
            <Tooltip formatter={(v: number) => `${v.toLocaleString("pt-BR")} km`} />
            <Bar dataKey="value" name="KM" fill={CHART_COLORS[3]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Agenda por Status" description="Situacao dos agendamentos de servico" loading={isLoading}>
          <PieChart>
            <Pie data={agg.agendaPorStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
              {agg.agendaPorStatus.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ChartCard>

        <ChartCard title="Agenda por Tipo de Servico" description="Tipos de atendimento agendados" loading={isLoading}>
          <BarChart data={agg.agendaPorTipo} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
            <Tooltip />
            <Bar dataKey="value" fill={CHART_COLORS[2]} />
          </BarChart>
        </ChartCard>
      </div>
    </div>
  );
}
