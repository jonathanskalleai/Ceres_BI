import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { Cpu, Users, Layers, Tag } from "lucide-react";
import { useProdutosData } from "@/hooks/bi/useProdutosData";
import { KPICard } from "@/components/bi/KPICard";
import { ChartCard } from "@/components/bi/ChartCard";
import { CHART_COLORS } from "@/lib/chartColors";

interface Props {
  active: boolean;
}

export default function ProdutosSection({ active }: Props) {
  const { agg, isLoading } = useProdutosData(active);
  const { kpis } = agg;

  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Maquinas Instaladas" value={kpis.totalMaquinas.toLocaleString("pt-BR")} icon={Cpu} loading={isLoading} hint="base instalada nos clientes" />
        <KPICard title="Clientes com Parque" value={kpis.clientesComParque.toLocaleString("pt-BR")} icon={Users} loading={isLoading} />
        <KPICard title="Grupos" value={kpis.gruposDistintos.toLocaleString("pt-BR")} icon={Layers} loading={isLoading} />
        <KPICard title="Marcas" value={kpis.marcasDistintas.toLocaleString("pt-BR")} icon={Tag} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Base Instalada por Grupo" description="Quantidade de maquinas por tipo de equipamento" loading={isLoading}>
          <PieChart>
            <Pie data={agg.porGrupo} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
              {agg.porGrupo.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ChartCard>

        <ChartCard title="Base Instalada por Marca" description="Top 10 marcas no parque dos clientes" loading={isLoading}>
          <BarChart data={agg.porMarca} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
            <Tooltip />
            <Bar dataKey="value" name="Maquinas" fill={CHART_COLORS[1]} />
          </BarChart>
        </ChartCard>

        <ChartCard title="Top Modelos no Parque" description="Modelos mais presentes na base instalada" loading={isLoading}>
          <BarChart data={agg.topModelos} layout="vertical" margin={{ left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={130} />
            <Tooltip />
            <Bar dataKey="value" name="Maquinas" fill={CHART_COLORS[2]} />
          </BarChart>
        </ChartCard>
      </div>
    </div>
  );
}
