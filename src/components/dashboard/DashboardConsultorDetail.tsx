import { useMemo } from "react";
import type { Vendedor, Registro } from "@/types/comercial";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CalendarDays, DollarSign, Target, TrendingUp, Users } from "lucide-react";
import { ConsultorCharts } from "./consultor/ConsultorCharts";
import { ConsultorClienteCard } from "./consultor/ConsultorClienteCard";
import type { RpcConsultorResumoAcoes } from "@/types/consultoresRpc";
import { formatDateBR } from "@/lib/dateUtils";

interface Props {
  vendedor: Vendedor;
  resumo: RpcConsultorResumoAcoes;
  registros: Registro[];
  from: string;
  to: string;
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

export const DashboardConsultorDetail = ({ vendedor: v, resumo, registros, from, to, onBack }: Props) => {
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

  const resultadoPeriodo = [
    { label: "Ações", value: Number(resumo.acoes).toLocaleString("pt-BR"), hint: "concluídas no período", icon: TrendingUp, color: "text-primary" },
    { label: "Visitas", value: Number(resumo.visitas).toLocaleString("pt-BR"), hint: "ações presenciais", icon: Users, color: "text-accent" },
    { label: "Clientes atendidos", value: Number(resumo.clientes).toLocaleString("pt-BR"), hint: "clientes únicos", icon: Users, color: "text-info" },
    { label: "Pipeline em aberto", value: fmtCurrency(Number(resumo.pipeline_aberto_gerado)), hint: `${resumo.oportunidades_abertas} oportunidades abertas`, icon: Target, color: "text-warning" },
    { label: "Vendas", value: fmtCurrency(Number(resumo.valor_ganho)), hint: `${resumo.ganhos} pedidos aprovados`, icon: DollarSign, color: "text-success" },
    { label: "Conversão", value: resumo.taxa_ganho == null ? "—" : `${resumo.taxa_ganho}%`, hint: `${resumo.ganhos} ganhos ÷ ${resumo.oportunidades_geradas} oportunidades`, icon: Target, color: "text-chart-4" },
  ];

  const gestaoCarteira = [
    { label: "Carteira ativa trabalhada", value: fmtCurrency(Number(resumo.carteira_ativa_trabalhada)), hint: `${resumo.negocios_abertos_tocados} negócios abertos tocados` },
    { label: "Oportunidades geradas", value: Number(resumo.oportunidades_geradas).toLocaleString("pt-BR"), hint: `${resumo.oportunidades_abertas} continuam abertas` },
    { label: "Perdidos", value: fmtCurrency(Number(resumo.valor_perdido)), hint: `${resumo.perdidos} negócios fechados como perda` },
    { label: "Registro de atividade", value: `${resumo.crm_quality}%`, hint: grade.label },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-foreground">{v.nome}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[10px] font-mono text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              {formatDateBR(from)} a {formatDateBR(to)}
            </span>
            <span className="text-xs text-muted-foreground">Visão individual do período</span>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Resultado do período</h3>
          <p className="text-xs text-muted-foreground">Atividade, pipeline e vendas consolidados pelo calendário selecionado.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {resultadoPeriodo.map((k) => (
            <Card key={k.label} className="border-border/70 shadow-sm">
              <CardContent className="p-4">
                <div className="mb-3 flex items-center gap-1.5">
                  <k.icon className={`h-3.5 w-3.5 ${k.color}`} />
                  <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground">{k.label}</p>
                </div>
                <p className={`text-xl font-bold leading-none ${k.color}`}>{k.value}</p>
                <p className="mt-2 text-[10px] text-muted-foreground">{k.hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border/70 bg-muted/20 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Gestão da carteira</h3>
            <p className="text-xs text-muted-foreground">Carteira é diferente do pipeline: reúne negócios abertos que receberam ação no período.</p>
          </div>
          <Badge className={grade.className}>{grade.label}</Badge>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {gestaoCarteira.map((k) => (
            <div key={k.label} className="rounded-lg border border-border/70 bg-card p-3">
              <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground">{k.label}</p>
              <p className="mt-2 text-lg font-bold text-foreground">{k.value}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">{k.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <ConsultorCharts evolucao={v.evolucao} tiposAcao={v.tiposAcao} regioes={v.regioes} />

      <Card className="border-0 shadow-sm">
        <div className="p-4 pb-2">
          <h3 className="text-sm font-semibold">Clientes atendidos no período</h3>
        </div>
        <div className="px-4 pb-4">
          <div className="grid grid-cols-[32px_1fr_100px_60px_60px_90px_80px_80px_32px] items-center px-2 py-2 border-b border-border text-xs font-semibold text-muted-foreground">
            <span>#</span><span>Cliente</span><span>Cidade</span>
            <span className="text-center">Ações</span><span className="text-center">Visitas</span>
            <span className="text-right">Valor vinculado</span><span className="text-center">Dias s/ Contato</span>
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
