import { useState } from "react";
import { LayoutDashboard, Users, MapPin, Table2, Filter, X, AlertTriangle, MessageSquareText, Map, Handshake, ClipboardList, Zap, PanelLeftClose, PanelLeft, Database, BarChart3, ListFilter, Wrench, UserCircle, Package, Settings, ChevronDown, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Filters } from "@/types/comercial";

interface Props {
  currentView: string;
  onNavigate: (view: string) => void;
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
  vendedores: string[];
  cidades: string[];
  tiposAcao: string[];
  anos: string[];
  lastUpdated?: string | null;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isRoute?: boolean;
  routePath?: string;
}

interface NavGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  route?: string;
  placeholder?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "comercial",
    label: "COMERCIAL",
    icon: BarChart3,
    items: [
      { id: "overview", label: "Visão Geral", icon: LayoutDashboard },
      { id: "consultores", label: "Consultores", icon: Users },
      { id: "regioes", label: "Regiões", icon: MapPin },
      { id: "registros", label: "Registros", icon: Table2 },
      { id: "criticos", label: "Clientes Críticos", icon: AlertTriangle },
      { id: "mapa", label: "Mapa de Ações", icon: Map },
      { id: "insights", label: "Análise Observações", icon: MessageSquareText },
      { id: "negocios-mensais", label: "Negócios Mensais", icon: Handshake },
      { id: "administrativo", label: "Ações Administrativas", icon: ClipboardList },
    ],
  },
  {
    id: "pipeline",
    label: "PIPELINE",
    icon: ListFilter,
    route: "/pipeline",
    placeholder: true,
    items: [],
  },
  {
    id: "pos-venda",
    label: "PÓS-VENDA",
    icon: Wrench,
    route: "/pos-venda",
    placeholder: true,
    items: [],
  },
  {
    id: "clientes",
    label: "CLIENTES",
    icon: UserCircle,
    route: "/cliente360",
    placeholder: true,
    items: [],
  },
  {
    id: "produtos",
    label: "PRODUTOS",
    icon: Package,
    route: "/produtos",
    placeholder: true,
    items: [],
  },
  {
    id: "ferramentas",
    label: "FERRAMENTAS",
    icon: Settings,
    items: [
      { id: "view-explorer", label: "Explorador de Views", icon: Database },
      { id: "performance", label: "Performance 2026", icon: Zap, isRoute: true, routePath: "/performance" },
    ],
  },
  {
    id: "bi",
    label: "BI",
    icon: BarChart3,
    items: [
      { id: "dashboard-bi", label: "Dashboard BI", icon: Database },
    ],
  },
];

const MESES = [
  { value: "01", label: "Janeiro" }, { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" }, { value: "04", label: "Abril" },
  { value: "05", label: "Maio" }, { value: "06", label: "Junho" },
  { value: "07", label: "Julho" }, { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" }, { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
];

const emptyFilters: Filters = { vendedor: "", cidade: "", periodo: "", ano: "", mes: "", tipoAcao: "" };

export const DashboardSidebar = ({ currentView, onNavigate, filters, onFiltersChange, vendedores, cidades, tiposAcao, anos, lastUpdated }: Props) => {
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    comercial: true,
    ferramentas: true,
  });
  const hasFilters = Object.values(filters).some(Boolean);

  const set = (key: keyof Filters, v: string) =>
    onFiltersChange({ ...filters, [key]: v === "all" ? "" : v });

  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleItemClick = (item: NavItem) => {
    if (item.isRoute && item.routePath) {
      navigate(item.routePath);
    } else {
      onNavigate(item.id);
    }
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside className={cn(
        "shrink-0 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border transition-[width] duration-200 ease-linear",
        collapsed ? "w-[3.5rem]" : "w-64"
      )}>
        <div className={cn("border-b border-sidebar-border", collapsed ? "p-2" : "p-5")}>
          <div className="flex items-center justify-between">
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="text-lg font-bold tracking-tight text-sidebar-primary-foreground truncate">
                  Ceres Equipamentos
                </h1>
                <p className="text-xs text-sidebar-foreground/60 mt-1">Painel Comercial</p>
                {lastUpdated && (
                  <p className="text-[10px] text-sidebar-foreground/50 mt-1">
                    Última atualização: {new Date(lastUpdated).toLocaleDateString("pt-BR")} às {new Date(lastUpdated).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-sidebar-foreground/70 hover:text-sidebar-foreground"
              onClick={() => setCollapsed((c) => !c)}
            >
              {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <nav className={cn("space-y-1", collapsed ? "p-1.5" : "p-3")}>
            {NAV_GROUPS.map((group) => {
              const isExpanded = expandedGroups[group.id] ?? false;
              const GroupIcon = group.icon;

              if (collapsed) {
                return (
                  <Tooltip key={group.id}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => group.route ? navigate(group.route) : toggleGroup(group.id)}
                        className="w-full flex items-center justify-center p-2.5 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
                      >
                        <GroupIcon className="h-4 w-4 shrink-0" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">{group.label}</TooltipContent>
                  </Tooltip>
                );
              }

              if (group.route) {
                return (
                  <div key={group.id} className="pt-2">
                    <button
                      onClick={() => navigate(group.route!)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
                    >
                      <GroupIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="text-xs font-semibold uppercase tracking-wider">{group.label}</span>
                      {group.placeholder && (
                        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-sidebar-accent text-sidebar-foreground/50">
                          Em breve
                        </span>
                      )}
                    </button>
                  </div>
                );
              }

              return (
                <div key={group.id} className="pt-2">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
                  >
                    <GroupIcon className="h-3.5 w-3.5 shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wider">{group.label}</span>
                    <span className="ml-auto">
                      {isExpanded
                        ? <ChevronDown className="h-3 w-3" />
                        : <ChevronRight className="h-3 w-3" />
                      }
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="mt-1 space-y-0.5">
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleItemClick(item)}
                          className={cn(
                            "w-full flex items-center gap-3 pl-7 pr-3 py-2 rounded-lg text-sm font-medium transition-colors",
                            currentView === item.id
                              ? "bg-sidebar-accent text-sidebar-primary"
                              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                            item.isRoute && "border border-sidebar-primary/30 bg-sidebar-accent/30 text-sidebar-primary"
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </ScrollArea>

        {!collapsed && (
          <ScrollArea className="max-h-[45vh]">
            <div className="p-4 border-t border-sidebar-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50 flex items-center gap-1.5">
                  <Filter className="h-3 w-3" /> Filtros
                </span>
                {hasFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1 text-sidebar-foreground/50 hover:text-sidebar-foreground"
                    onClick={() => onFiltersChange(emptyFilters)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="space-y-2">
                <Select value={filters.ano} onValueChange={(v) => set("ano", v)}>
                  <SelectTrigger className="h-8 text-xs bg-sidebar-accent border-sidebar-border text-sidebar-foreground">
                    <SelectValue placeholder="Ano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os anos</SelectItem>
                    {anos.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filters.mes} onValueChange={(v) => set("mes", v)}>
                  <SelectTrigger className="h-8 text-xs bg-sidebar-accent border-sidebar-border text-sidebar-foreground">
                    <SelectValue placeholder="Mês" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os meses</SelectItem>
                    {MESES.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filters.vendedor} onValueChange={(v) => set("vendedor", v)}>
                  <SelectTrigger className="h-8 text-xs bg-sidebar-accent border-sidebar-border text-sidebar-foreground">
                    <SelectValue placeholder="Consultor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <ScrollArea className="h-48">
                      {vendedores.map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>

                <Select value={filters.cidade} onValueChange={(v) => set("cidade", v)}>
                  <SelectTrigger className="h-8 text-xs bg-sidebar-accent border-sidebar-border text-sidebar-foreground">
                    <SelectValue placeholder="Cidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <ScrollArea className="h-48">
                      {cidades.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>

                <Select value={filters.tipoAcao} onValueChange={(v) => set("tipoAcao", v)}>
                  <SelectTrigger className="h-8 text-xs bg-sidebar-accent border-sidebar-border text-sidebar-foreground">
                    <SelectValue placeholder="Tipo de Ação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as ações</SelectItem>
                    <ScrollArea className="h-48">
                      {tiposAcao.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ScrollArea>
        )}
      </aside>
    </TooltipProvider>
  );
};