import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import type { RpcNegociosSummary, RpcNegociosConsultor } from "@/types/negociosCrm";

interface FinancialAlert {
  titulo: string;
  descricao: string;
  severidade: "alta" | "media" | "baixa";
}

interface Props {
  summary: RpcNegociosSummary;
  porConsultor: RpcNegociosConsultor[];
}

const fmtCurrency = (v: number) => {
  const n = isFinite(v) ? v : 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

function buildAlerts(summary: RpcNegociosSummary, porConsultor: RpcNegociosConsultor[]): FinancialAlert[] {
  const alerts: FinancialAlert[] = [];

  if (summary.totalValor > 0 && summary.totalRecebido < summary.totalValor * 0.5) {
    alerts.push({
      titulo: "Alerta de Caixa",
      descricao: `Alto volume de vendas (${fmtCurrency(summary.totalValor)}) com baixa entrada de caixa (${fmtCurrency(summary.totalRecebido)}). Dependência elevada da venda de equipamentos usados.`,
      severidade: "alta",
    });
  }

  if (summary.percentUsado > 16) {
    alerts.push({
      titulo: "Performance Comercial Comprometida",
      descricao: `% Usado sobre venda em ${summary.percentUsado.toFixed(1)}% (acima de 16%). Alto volume de usados nos negócios, impactando diretamente o caixa da empresa.`,
      severidade: "alta",
    });
  } else if (summary.percentUsado > 10) {
    alerts.push({
      titulo: "% Usado em Zona de Alerta",
      descricao: `% Usado sobre venda em ${summary.percentUsado.toFixed(1)}% (entre 10% e 16%). Monitorar para evitar impacto no caixa.`,
      severidade: "media",
    });
  }

  const consultoresAltoUsado = porConsultor.filter((c) => c.percentUsado > 16 && c.valor > 0);
  for (const c of consultoresAltoUsado.slice(0, 3)) {
    alerts.push({
      titulo: `Consultor ${c.nome.split(" ").slice(-1)[0]} – Alto Usado`,
      descricao: `Consultor ${c.nome} apresenta ${c.percentUsado.toFixed(1)}% de usado sobre vendas (${fmtCurrency(c.usado)} de usado em ${fmtCurrency(c.valor)} negociados), gerando baixa entrada de caixa (${fmtCurrency(c.recebido)}).`,
      severidade: "alta",
    });
  }

  return alerts;
}

export function NegociosFinancialAlerts({ summary, porConsultor }: Props) {
  const alerts = buildAlerts(summary, porConsultor);
  if (alerts.length === 0) return null;

  return (
    <Card className="border-0 shadow-sm border-l-4 border-l-red-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Alertas Financeiros Automáticos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alerta, i) => (
          <div
            key={i}
            className={`p-3 rounded-lg border ${
              alerta.severidade === "alta"
                ? "bg-destructive/5 border-destructive/30"
                : alerta.severidade === "media"
                ? "bg-warning/5 border-warning/30"
                : "bg-muted/50 border-border/50"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={alerta.severidade === "alta" ? "destructive" : "secondary"} className="text-xs">
                {alerta.severidade.toUpperCase()}
              </Badge>
              <span className="font-medium text-sm">{alerta.titulo}</span>
            </div>
            <p className="text-sm text-muted-foreground">{alerta.descricao}</p>
          </div>
        ))}
        <p className="text-xs text-muted-foreground mt-2">Calculado a partir dos negócios do período (rpc_negocios_crm)</p>
      </CardContent>
    </Card>
  );
}
