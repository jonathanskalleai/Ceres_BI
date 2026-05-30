import { useMemo, useState } from "react";
import { DadosComerciais, Filters } from "@/types/comercial";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isAdminUser } from "@/lib/adminUsers";
import { filterRegistros, hasActiveFilters } from "@/lib/filterUtils";
import { ClipboardList, Users, Eye, BarChart3, ChevronRight } from "lucide-react";
import { DashboardAdminDetail } from "./DashboardAdminDetail";

interface Props {
  data: DadosComerciais;
  filters: Filters;
}

export const DashboardAdministrativo = ({ data, filters }: Props) => {
  const [selectedAdmin, setSelectedAdmin] = useState<string | null>(null);

  const registros = useMemo(() => {
    const adminRegs = data.registrosRecentes.filter((r) => isAdminUser(r.vendedor));
    return hasActiveFilters(filters) ? filterRegistros(adminRegs, filters) : adminRegs;
  }, [data, filters]);

  const stats = useMemo(() => {
    const userMap = new Map<string, { acoes: number; visitas: number; clientes: Set<string>; tiposAcao: Record<string, number> }>();
    
    for (const r of registros) {
      if (!userMap.has(r.vendedor)) {
        userMap.set(r.vendedor, { acoes: 0, visitas: 0, clientes: new Set(), tiposAcao: {} });
      }
      const s = userMap.get(r.vendedor)!;
      s.acoes++;
      if (r.tipoContato?.toLowerCase().includes("visita")) s.visitas++;
      if (r.cliente) s.clientes.add(r.cliente);
      if (r.tipoAcao) s.tiposAcao[r.tipoAcao] = (s.tiposAcao[r.tipoAcao] || 0) + 1;
    }

    return Array.from(userMap.entries())
      .map(([nome, s]) => ({
        nome,
        acoes: s.acoes,
        visitas: s.visitas,
        clientes: s.clientes.size,
        tiposAcao: s.tiposAcao,
      }))
      .sort((a, b) => b.acoes - a.acoes);
  }, [registros]);

  // Detail view
  if (selectedAdmin) {
    const adminRegistros = registros.filter((r) => r.vendedor === selectedAdmin);
    return (
      <DashboardAdminDetail
        nome={selectedAdmin}
        registros={adminRegistros}
        onBack={() => setSelectedAdmin(null)}
      />
    );
  }

  const totalAcoes = stats.reduce((s, u) => s + u.acoes, 0);
  const totalVisitas = stats.reduce((s, u) => s + u.visitas, 0);
  const totalClientes = new Set(registros.map((r) => r.cliente).filter(Boolean)).size;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Ações Administrativas</h2>
        <p className="text-sm text-muted-foreground">
          Atividades realizadas pela equipe administrativa · Suporte ao time comercial
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.length}</p>
              <p className="text-xs text-muted-foreground">Usuários Admin</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <ClipboardList className="h-5 w-5 text-accent" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalAcoes}</p>
              <p className="text-xs text-muted-foreground">Total de Ações</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <Eye className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalVisitas}</p>
              <p className="text-xs text-muted-foreground">Visitas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalClientes}</p>
              <p className="text-xs text-muted-foreground">Clientes Atendidos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-user cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((u) => (
          <Card
            key={u.nome}
            className="border-0 shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200 group"
            onClick={() => setSelectedAdmin(u.nome)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm truncate flex-1">{u.nome}</h4>
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="text-[10px]">Administrativo</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-primary">{u.acoes}</p>
                  <p className="text-[10px] text-muted-foreground">Ações</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-accent">{u.visitas}</p>
                  <p className="text-[10px] text-muted-foreground">Visitas</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-warning">{u.clientes}</p>
                  <p className="text-[10px] text-muted-foreground">Clientes</p>
                </div>
              </div>
              {Object.keys(u.tiposAcao).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {Object.entries(u.tiposAcao)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 4)
                    .map(([tipo, count]) => (
                      <Badge key={tipo} variant="outline" className="text-[9px]">
                        {tipo}: {count}
                      </Badge>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {stats.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Nenhuma ação administrativa encontrada com os filtros atuais.</p>
        </div>
      )}
    </div>
  );
};
