import { useMemo } from "react";
import type { Vendedor, Registro } from "@/types/comercial";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ConsultorCharts } from "./consultor/ConsultorCharts";
import { ConsultorClienteCard } from "./consultor/ConsultorClienteCard";

interface Props {
  vendedor: Vendedor;
  registros: Registro[];
  onBack: () => void;
}

const fmtCurrency = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(0)}K` : `R$ ${v.toFixed(0)}`;

const crmGrade = (q: number) => {
  if (q >= 70) return { label: "A - Excelente", className: "bg-success text-success-foreground" };
  if (q >= 50) return { label: "B - Bom", className: "bg-warning text-warning-foreground" };
  if (q >= 30) return { label: "C - Regular", className: "bg-destructive/80 text-destructive-foreground" };
  return { label: "D - Insuficiente", className: "bg-destructive text-destructive-foreground" };
};

export const DashboardConsultorDetail = ({ vendedor: v, registros, onBack }: Props) => {
  const grade = crmGrade(v.crmQuality);

  const clientActions = useMemo(() => {
    const map = new Map<string, Registro[]>();
    const vendedorRegs = registros
      .filter((r) => r.vendedor === v.nome)
      .sort((a, b) => (b.dtConclusao || "").localeCompare(a.dtConclusao || ""));
    for (const r of vendedorRegs) {
      if (!map.has(r.cliente)) map.set(r.cliente, []);
      const arr = map.get(r.cliente)!;
      if (arr.length < 5) arr.push(r);
    }
    return map;
  }, [registros, v.nome]);

  const kpis = [
    { label: "Total Ações", value: v.totalAcoes.toString(), color: "text-primary" },
    { label: "Visitas", value: v.visitas.toString(), color: "text-accent" },
    { label: "Clientes", value: v.clientes.toString(), color: "text-info" },
    { label: "Pipeline", value: fmtCurrency(v.pipeline), color: "text-warning" },
    { label: "Conversão", value: `${v.conversao}%`, color: "text-chart-4" },
    { label: "CRM Quality", value: `${v.crmQuality}%`, color: grade.className.includes("success") ? "text-success" : "text-destructive" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div>
          <h2 className="text-2xl font-bold text-foreground">{v.nome}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={grade.className}>{grade.label}</Badge>
            <span className="text-xs text-muted-foreground">{v.negocios} negócios registrados</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-[10px] text-muted-foreground">{k.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <ConsultorCharts evolucao={v.evolucao} tiposAcao={v.tiposAcao} regioes={v.regioes} />

      <Card className="border-0 shadow-sm">
        <div className="p-4 pb-2">
          <h3 className="text-sm font-semibold">Top 10 Clientes</h3>
        </div>
        <div className="px-4 pb-4">
          <div className="grid grid-cols-[32px_1fr_100px_60px_60px_90px_80px_80px_32px] items-center px-2 py-2 border-b border-border text-xs font-semibold text-muted-foreground">
            <span>#</span><span>Cliente</span><span>Cidade</span>
            <span className="text-center">Ações</span><span className="text-center">Visitas</span>
            <span className="text-right">Pipeline</span><span className="text-center">Dias s/ Contato</span>
            <span className="text-center">Status</span><span></span>
          </div>
          {v.topClientes.map((c, i) => (
            <ConsultorClienteCard
              key={c.nome}
              cliente={c}
              rank={i + 1}
              actions={clientActions.get(c.nome) || []}
              vendedorNome={v.nome}
            />
          ))}
        </div>
      </Card>
    </div>
  );
};
