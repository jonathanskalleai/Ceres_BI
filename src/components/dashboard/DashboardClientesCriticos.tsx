import { useMemo } from "react";
import { DadosComerciais, Filters, Registro } from "@/types/comercial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Phone, Mail, MapPin, Clock, TrendingDown, Target, Users } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";

interface Props {
  data: DadosComerciais;
  filters: Filters;
}

interface ClienteCritico {
  nome: string;
  cidade: string;
  vendedor: string;
  diasSemContato: number;
  pipeline: number;
  totalAcoes: number;
  visitas: number;
  ultimaData: string;
  ultimaObs: string;
  ultimoTipoAcao: string;
  historico: Registro[];
}

const formatCurrency = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(0)}K` : `R$ ${v.toFixed(0)}`;

const getSugestaoAcao = (c: ClienteCritico): { acao: string; argumentacao: string; prioridade: string } => {
  if (c.diasSemContato > 180 && c.pipeline > 500000) {
    return {
      acao: "Visita presencial urgente + proposta atualizada",
      argumentacao: "Resgatar relacionamento com proposta de condições especiais. Mencionar novidades em equipamentos desde o último contato.",
      prioridade: "🔴 Crítica",
    };
  }
  if (c.diasSemContato > 180) {
    return {
      acao: "Ligação de reativação + envio de catálogo atualizado",
      argumentacao: "Abordagem consultiva perguntando sobre a safra atual e necessidades futuras. Oferecer demonstração sem compromisso.",
      prioridade: "🟠 Alta",
    };
  }
  if (c.pipeline > 500000) {
    return {
      acao: "Contato telefônico + agendamento de visita técnica",
      argumentacao: "Reforçar valor do equipamento com ROI projetado. Oferecer condições de financiamento facilitado.",
      prioridade: "🟡 Média-Alta",
    };
  }
  return {
    acao: "Contato por WhatsApp/e-mail + follow-up em 7 dias",
    argumentacao: "Manter relacionamento ativo. Compartilhar case de sucesso de cliente similar na região.",
    prioridade: "🟡 Média",
  };
};

export const DashboardClientesCriticos = ({ data, filters }: Props) => {
  const criticos = useMemo(() => {
    const clienteMap = new Map<string, ClienteCritico>();

    // Build from vendedores' topClientes
    for (const v of data.vendedores) {
      if (filters.vendedor && v.nome !== filters.vendedor) continue;
      for (const c of v.topClientes) {
        if (c.diasSemContato < 90) continue;
        if (filters.cidade && c.cidade !== filters.cidade) continue;
        const key = `${c.nome}|${v.nome}`;
        if (!clienteMap.has(key)) {
          // Find history in registrosRecentes
          const historico = data.registrosRecentes.filter(
            (r) => r.cliente === c.nome && r.vendedor === v.nome
          );
          const ultimoReg = historico[0];
          clienteMap.set(key, {
            nome: c.nome,
            cidade: c.cidade,
            vendedor: v.nome,
            diasSemContato: c.diasSemContato,
            pipeline: c.negocioValor,
            totalAcoes: c.acoes,
            visitas: c.visitas,
            ultimaData: ultimoReg?.dtConclusao || "—",
            ultimaObs: ultimoReg?.obs || "Sem observações registradas",
            ultimoTipoAcao: ultimoReg?.tipoAcao || "—",
            historico,
          });
        }
      }
    }

    let result = Array.from(clienteMap.values());

    // Filter by tipoAcao if set
    if (filters.tipoAcao) {
      result = result.filter((c) => c.historico.some((r) => r.tipoAcao === filters.tipoAcao));
    }

    // Sort by pipeline desc, then diasSemContato desc
    return result.sort((a, b) => b.pipeline - a.pipeline || b.diasSemContato - a.diasSemContato);
  }, [data, filters]);

  const totalPipelineEmRisco = criticos.reduce((sum, c) => sum + c.pipeline, 0);
  const porVendedor = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of criticos) map.set(c.vendedor, (map.get(c.vendedor) || 0) + 1);
    return Array.from(map.entries())
      .map(([vendedor, count]) => ({ vendedor: vendedor.split(" ").slice(-1)[0], count, full: vendedor }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [criticos]);

  const faixas = useMemo(() => {
    const f = { "90-120d": 0, "120-180d": 0, "180-365d": 0, ">365d": 0 };
    for (const c of criticos) {
      if (c.diasSemContato > 365) f[">365d"]++;
      else if (c.diasSemContato > 180) f["180-365d"]++;
      else if (c.diasSemContato > 120) f["120-180d"]++;
      else f["90-120d"]++;
    }
    return Object.entries(f).map(([name, value]) => ({ name, value }));
  }, [criticos]);

  const COLORS = ["hsl(38, 92%, 50%)", "hsl(25, 95%, 53%)", "hsl(0, 84%, 60%)", "hsl(0, 72%, 45%)"];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          Clientes em Estado Crítico
        </h2>
        <p className="text-sm text-muted-foreground">
          Clientes sem contato há mais de 90 dias — ações recomendadas e histórico
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm border-l-4 border-l-destructive">
          <CardContent className="p-4">
            <p className="text-3xl font-bold text-destructive">{criticos.length}</p>
            <p className="text-xs text-muted-foreground">Clientes Críticos</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm border-l-4 border-l-warning">
          <CardContent className="p-4">
            <p className="text-3xl font-bold text-warning">{formatCurrency(totalPipelineEmRisco)}</p>
            <p className="text-xs text-muted-foreground">Pipeline em Risco</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm border-l-4 border-l-primary">
          <CardContent className="p-4">
            <p className="text-3xl font-bold text-primary">
              {criticos.length > 0 ? Math.round(criticos.reduce((s, c) => s + c.diasSemContato, 0) / criticos.length) : 0}
            </p>
            <p className="text-xs text-muted-foreground">Média Dias s/ Contato</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm border-l-4 border-l-accent">
          <CardContent className="p-4">
            <p className="text-3xl font-bold text-accent">
              {criticos.filter((c) => c.diasSemContato > 180).length}
            </p>
            <p className="text-xs text-muted-foreground">Acima de 180 dias</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Distribuição por Faixa de Inatividade</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={faixas}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {faixas.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Clientes Críticos por Consultor</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porVendedor} layout="vertical" margin={{ left: 70 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="vendedor" tick={{ fontSize: 10 }} width={65} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(0, 84%, 60%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Critical Clients List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Target className="h-5 w-5 text-destructive" />
          Plano de Ação por Cliente ({criticos.length})
        </h3>

        {criticos.slice(0, 50).map((c) => {
          const sugestao = getSugestaoAcao(c);
          return (
            <Card key={`${c.nome}|${c.vendedor}`} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  {/* Client Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h4 className="font-semibold text-sm truncate">{c.nome}</h4>
                      <Badge variant="destructive" className="text-[10px] shrink-0">
                        {c.diasSemContato} dias
                      </Badge>
                      <span className="text-xs">{sugestao.prioridade}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3 flex-wrap">
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{c.cidade}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.vendedor.split(" ").slice(-1)[0]}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Último: {c.ultimaData}</span>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div className="text-center p-2 rounded bg-muted/50">
                        <p className="text-sm font-bold text-warning">{formatCurrency(c.pipeline)}</p>
                        <p className="text-[10px] text-muted-foreground">Pipeline</p>
                      </div>
                      <div className="text-center p-2 rounded bg-muted/50">
                        <p className="text-sm font-bold text-primary">{c.totalAcoes}</p>
                        <p className="text-[10px] text-muted-foreground">Ações</p>
                      </div>
                      <div className="text-center p-2 rounded bg-muted/50">
                        <p className="text-sm font-bold text-accent">{c.visitas}</p>
                        <p className="text-[10px] text-muted-foreground">Visitas</p>
                      </div>
                      <div className="text-center p-2 rounded bg-muted/50">
                        <p className="text-sm font-bold">{c.ultimoTipoAcao}</p>
                        <p className="text-[10px] text-muted-foreground">Última Ação</p>
                      </div>
                    </div>

                    {/* Last observation */}
                    <div className="bg-muted/30 rounded p-2 mb-3">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Última Observação</p>
                      <p className="text-xs text-foreground line-clamp-2">{c.ultimaObs}</p>
                    </div>

                    {/* History */}
                    {c.historico.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">
                          Histórico ({Math.min(c.historico.length, 5)} últimos registros)
                        </p>
                        <div className="space-y-1">
                          {c.historico.slice(0, 5).map((h, i) => (
                            <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="font-mono shrink-0">{h.dtConclusao}</span>
                              <Badge variant="outline" className="text-[9px] shrink-0">{h.tipoAcao}</Badge>
                              <span className="truncate">{h.obs || "—"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Recommendation */}
                  <div className="lg:w-72 shrink-0 bg-destructive/5 border border-destructive/20 rounded-lg p-4">
                    <p className="text-xs font-bold text-destructive uppercase mb-2 flex items-center gap-1">
                      <TrendingDown className="h-3 w-3" /> Ação Recomendada
                    </p>
                    <div className="space-y-2">
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground">O QUE FAZER</p>
                        <p className="text-xs text-foreground">{sugestao.acao}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground">ARGUMENTAÇÃO</p>
                        <p className="text-xs text-foreground">{sugestao.argumentacao}</p>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Badge variant="outline" className="text-[9px]"><Phone className="h-2.5 w-2.5 mr-1" />Ligar</Badge>
                        <Badge variant="outline" className="text-[9px]"><Mail className="h-2.5 w-2.5 mr-1" />E-mail</Badge>
                        <Badge variant="outline" className="text-[9px]"><MapPin className="h-2.5 w-2.5 mr-1" />Visita</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {criticos.length > 50 && (
          <p className="text-xs text-center text-muted-foreground">
            Mostrando 50 de {criticos.length} clientes críticos
          </p>
        )}
      </div>
    </div>
  );
};
