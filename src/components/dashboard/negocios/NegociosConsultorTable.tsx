import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import type { RpcNegociosConsultor, RpcNegociosClienteDetalhe } from "@/types/negociosCrm";

interface Props {
  porConsultor: RpcNegociosConsultor[];
}

const fmtCurrency = (v: number) => {
  const n = isFinite(v) ? v : 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
};

function ConsultorExpandableRow({ consultor: c }: { consultor: RpcNegociosConsultor }) {
  const [open, setOpen] = useState(false);
  const totals = useMemo(() => {
    return c.clientes.reduce(
      (acc, cli) => ({
        valorTotal: acc.valorTotal + cli.valorTotal,
        recebido: acc.recebido + cli.recebido,
        valorUsado: acc.valorUsado + cli.valorUsado,
      }),
      { valorTotal: 0, recebido: 0, valorUsado: 0 },
    );
  }, [c.clientes]);

  return (
    <>
      <tr
        className="border-b border-border/50 hover:bg-muted/50 cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <td className="py-2 px-3">
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </td>
        <td className="py-2 px-3 font-medium">{c.nome}</td>
        <td className="text-right py-2 px-3">{c.total}</td>
        <td className="text-right py-2 px-3">{c.ganhos}</td>
        <td className="text-right py-2 px-3">
          <div className="flex flex-col items-end">
            <Badge variant={c.conversao >= 50 ? "default" : c.conversao >= 25 ? "secondary" : "destructive"}>
              {c.conversao}%
            </Badge>
            <span className="text-[10px] text-muted-foreground mt-0.5">
              {c.total}/{c.clientesAtendidos || "?"}
            </span>
          </div>
        </td>
        <td className="text-right py-2 px-3">{fmtCurrency(c.valor)}</td>
        <td className="text-right py-2 px-3">{fmtCurrency(c.ticketMedio)}</td>
      </tr>
      {open && (
        <>
          <tr className="bg-muted/30">
            <td colSpan={2} className="py-1.5 px-3 pl-10 text-xs font-semibold text-muted-foreground">Cliente</td>
            <td className="text-right py-1.5 px-3 text-xs font-semibold text-muted-foreground" colSpan={2}>Valor do Negócio</td>
            <td className="text-right py-1.5 px-3 text-xs font-semibold text-muted-foreground">Recebido</td>
            <td className="text-right py-1.5 px-3 text-xs font-semibold text-muted-foreground">Valor Usado</td>
            <td />
          </tr>
          {c.clientes.map((cli) => (
            <tr key={cli.cliente} className="bg-muted/20 border-b border-border/30 hover:bg-muted/40">
              <td colSpan={2} className="py-1.5 px-3 pl-10 text-xs">{cli.cliente}</td>
              <td className="text-right py-1.5 px-3 text-xs" colSpan={2}>{fmtCurrency(cli.valorTotal)}</td>
              <td className="text-right py-1.5 px-3 text-xs">{fmtCurrency(cli.recebido)}</td>
              <td className="text-right py-1.5 px-3 text-xs">{fmtCurrency(cli.valorUsado)}</td>
              <td />
            </tr>
          ))}
          <tr className="bg-muted/40 border-b border-border font-semibold">
            <td colSpan={2} className="py-1.5 px-3 pl-10 text-xs">Total</td>
            <td className="text-right py-1.5 px-3 text-xs" colSpan={2}>{fmtCurrency(totals.valorTotal)}</td>
            <td className="text-right py-1.5 px-3 text-xs">{fmtCurrency(totals.recebido)}</td>
            <td className="text-right py-1.5 px-3 text-xs">{fmtCurrency(totals.valorUsado)}</td>
            <td />
          </tr>
        </>
      )}
    </>
  );
}

export function NegociosConsultorTable({ porConsultor }: Props) {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Taxa de Conversão e Ticket Médio por Consultor</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-muted-foreground font-medium w-8" />
                <th className="text-left py-2 px-3 text-muted-foreground font-medium">Consultor</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Negócios</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Ganhos</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Conversão</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Valor Total</th>
                <th className="text-right py-2 px-3 text-muted-foreground font-medium">Ticket Médio</th>
              </tr>
            </thead>
            <tbody>
              {porConsultor.map((c) => (
                <ConsultorExpandableRow key={c.nome} consultor={c} />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
