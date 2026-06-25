import { KPICard } from "@/components/bi/KPICard";
import {
  DollarSign, TrendingUp, Target, ShoppingCart, BarChart3,
  Wallet, ArrowDownUp, Percent,
} from "lucide-react";
import type { RpcNegociosSummary } from "@/types/negociosCrm";

interface Props {
  summary: RpcNegociosSummary;
}

const fmtCurrencyShort = (v: number) => {
  const n = isFinite(v) ? v : 0;
  if (n >= 1e6) return `R$ ${(n / 1e6).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`;
  if (n >= 1e3) return `R$ ${(n / 1e3).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}K`;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

export function NegociosKPIs({ summary }: Props) {
  const kpis = [
    { label: "Total Negócios", value: summary.totalNegocios.toString(), icon: ShoppingCart },
    { label: "Total Negociado", value: fmtCurrencyShort(summary.totalValor), icon: DollarSign },
    { label: "Ticket Médio", value: fmtCurrencyShort(summary.ticketMedio), icon: BarChart3 },
    { label: "Conversão", value: `${summary.taxaConversao}%`, subtitle: `${summary.totalNegocios} neg / ${summary.clientesAtendidos} cli`, icon: Target },
    { label: "Ganhos", value: summary.ganhos.toString(), icon: TrendingUp },
  ];

  const usadoClassification = summary.percentUsado <= 10 ? "healthy" : summary.percentUsado <= 16 ? "warning" : "critical";

  return (
    <>
      {/* Main KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {kpis.map((kpi) => (
          <KPICard
            key={kpi.label}
            title={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            hint={"subtitle" in kpi ? (kpi as { subtitle: string }).subtitle : undefined}
          />
        ))}
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Valor Recebido"
          value={fmtCurrencyShort(summary.totalRecebido)}
          icon={Wallet}
          hint="Entrada efetiva de caixa"
          accentColor="#22c55e"
        />
        <KPICard
          title="Total de Usado"
          value={fmtCurrencyShort(summary.totalUsado)}
          icon={ArrowDownUp}
          hint="Equipamentos usados recebidos"
          accentColor="#f97316"
        />
        <KPICard
          title="% Usado sobre Venda"
          value={`${summary.percentUsado.toFixed(1)}%`}
          icon={Percent}
          hint={usadoClassification === "healthy" ? "5-10% ideal" : usadoClassification === "warning" ? "10-16% atencao" : ">16% critico"}
          accentColor={usadoClassification === "healthy" ? "#22c55e" : usadoClassification === "warning" ? "#eab308" : "#ef4444"}
        />
      </div>
    </>
  );
}
