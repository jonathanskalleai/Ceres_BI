import { useMemo, useState } from "react";
import { Registro, Filters } from "@/types/comercial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, Search, ClipboardList, Eye, BarChart3, Users2,
  Calendar, MapPin, FileText, ChevronDown, ChevronUp
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Props {
  nome: string;
  registros: Registro[];
  onBack: () => void;
}

export const DashboardAdminDetail = ({ nome, registros, onBack }: Props) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoAcaoFilter, setTipoAcaoFilter] = useState("all");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const tiposAcao = useMemo(() => {
    const set = new Set<string>();
    registros.forEach((r) => r.tipoAcao && set.add(r.tipoAcao));
    return Array.from(set).sort();
  }, [registros]);

  const filtered = useMemo(() => {
    let result = registros;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          r.cliente?.toLowerCase().includes(term) ||
          r.obs?.toLowerCase().includes(term) ||
          r.cidade?.toLowerCase().includes(term)
      );
    }
    if (tipoAcaoFilter !== "all") {
      result = result.filter((r) => r.tipoAcao === tipoAcaoFilter);
    }
    return result.sort((a, b) => (b.dtConclusao || "").localeCompare(a.dtConclusao || ""));
  }, [registros, searchTerm, tipoAcaoFilter]);

  const stats = useMemo(() => {
    const visitas = registros.filter((r) => r.tipoContato?.toLowerCase().includes("visita")).length;
    const clientes = new Set(registros.map((r) => r.cliente).filter(Boolean)).size;
    const cidades = new Set(registros.map((r) => r.cidade).filter(Boolean)).size;
    const tiposCount: Record<string, number> = {};
    registros.forEach((r) => {
      if (r.tipoAcao) tiposCount[r.tipoAcao] = (tiposCount[r.tipoAcao] || 0) + 1;
    });
    const clienteAcoes: Record<string, number> = {};
    registros.forEach((r) => {
      if (r.cliente) clienteAcoes[r.cliente] = (clienteAcoes[r.cliente] || 0) + 1;
    });
    const topClientes = Object.entries(clienteAcoes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    return { visitas, clientes, cidades, tiposCount, topClientes };
  }, [registros]);

  const truncateObs = (obs: string | undefined, max = 80) => {
    if (!obs) return "—";
    return obs.length > max ? obs.slice(0, max) + "…" : obs;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-foreground">{nome}</h2>
          <p className="text-sm text-muted-foreground">
            Detalhamento completo das ações administrativas
          </p>
        </div>
        <Badge variant="secondary" className="text-xs px-3 py-1">Administrativo</Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm bg-primary/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{registros.length}</p>
              <p className="text-[11px] text-muted-foreground">Total Ações</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-accent/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Eye className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.visitas}</p>
              <p className="text-[11px] text-muted-foreground">Visitas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-warning/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center">
              <Users2 className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.clientes}</p>
              <p className="text-[11px] text-muted-foreground">Clientes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-success/5">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center">
              <MapPin className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.cidades}</p>
              <p className="text-[11px] text-muted-foreground">Cidades</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Top Clientes */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users2 className="h-4 w-4 text-primary" />
              Clientes Mais Atendidos
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="space-y-2">
              {stats.topClientes.map(([cliente, count], i) => (
                <div key={cliente} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium truncate">{cliente}</span>
                      <Badge variant="secondary" className="text-[10px] shrink-0">{count}</Badge>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60 transition-all"
                        style={{ width: `${(count / stats.topClientes[0][1]) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tipos de Ação */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-accent" />
              Distribuição por Tipo de Ação
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="space-y-2">
              {Object.entries(stats.tiposCount)
                .sort((a, b) => b[1] - a[1])
                .map(([tipo, count]) => (
                  <div key={tipo} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium truncate">{tipo}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {count} ({((count / registros.length) * 100).toFixed(0)}%)
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent/60 transition-all"
                          style={{ width: `${(count / registros.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table with filters */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Registro de Ações ({filtered.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente ou observação..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-xs w-56"
                />
              </div>
              <Select value={tipoAcaoFilter} onValueChange={setTipoAcaoFilter}>
                <SelectTrigger className="h-8 text-xs w-40">
                  <SelectValue placeholder="Tipo de Ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {tiposAcao.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[420px]">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-[11px] font-semibold w-24">Data</TableHead>
                  <TableHead className="text-[11px] font-semibold">Cliente</TableHead>
                  <TableHead className="text-[11px] font-semibold w-28">Cidade</TableHead>
                  <TableHead className="text-[11px] font-semibold w-32">Tipo Ação</TableHead>
                  <TableHead className="text-[11px] font-semibold w-28">Contato</TableHead>
                  <TableHead className="text-[11px] font-semibold">Observação</TableHead>
                  <TableHead className="text-[11px] font-semibold w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, 200).map((r, idx) => (
                  <Collapsible key={idx} asChild open={expandedRow === idx} onOpenChange={(open) => setExpandedRow(open ? idx : null)}>
                    <>
                      <TableRow className="group cursor-pointer hover:bg-muted/40 transition-colors">
                        <TableCell className="text-[11px] text-muted-foreground py-2.5">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3 w-3" />
                            {r.dtConclusao || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-[11px] font-medium py-2.5 max-w-[180px] truncate">
                          {r.cliente || "—"}
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground py-2.5">
                          {r.cidade || "—"}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Badge variant="outline" className="text-[9px] font-normal">
                            {r.tipoAcao || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2.5">
                          <Badge variant="secondary" className="text-[9px] font-normal">
                            {r.tipoContato || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground py-2.5 max-w-[200px] truncate">
                          {truncateObs(r.obs)}
                        </TableCell>
                        <TableCell className="py-2.5">
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              {expandedRow === idx ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </CollapsibleTrigger>
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <tr>
                          <td colSpan={7} className="p-0">
                            <div className="px-6 py-3 bg-muted/20 border-b text-xs space-y-2 animate-in slide-in-from-top-1 duration-200">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div>
                                  <span className="text-muted-foreground font-medium">Cliente:</span>
                                  <p className="font-semibold mt-0.5">{r.cliente || "—"}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground font-medium">Cidade:</span>
                                  <p className="font-semibold mt-0.5">{r.cidade || "—"}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground font-medium">Tipo de Ação:</span>
                                  <p className="mt-0.5"><Badge variant="outline" className="text-[10px]">{r.tipoAcao || "—"}</Badge></p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground font-medium">Tipo de Contato:</span>
                                  <p className="mt-0.5"><Badge variant="secondary" className="text-[10px]">{r.tipoContato || "—"}</Badge></p>
                                </div>
                              </div>
                              {r.negocioEtapa && (
                                <div>
                                  <span className="text-muted-foreground font-medium">Etapa Negócio:</span>
                                  <span className="ml-2">{r.negocioEtapa}</span>
                                  {r.negocioValor > 0 && (
                                    <span className="ml-3 font-semibold text-primary">
                                      R$ {r.negocioValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                    </span>
                                  )}
                                </div>
                              )}
                              {r.obs && (
                                <div>
                                  <span className="text-muted-foreground font-medium">Observação completa:</span>
                                  <p className="mt-1 text-foreground leading-relaxed bg-background/60 rounded-md p-2 border border-border/50">
                                    {r.obs}
                                  </p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                      Nenhuma ação encontrada com os filtros aplicados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
