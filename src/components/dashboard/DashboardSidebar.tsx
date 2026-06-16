import { useState } from "react";
import {
  LayoutDashboard, Users, MapPin, Table2, AlertTriangle, MessageSquareText,
  Map, Handshake, ClipboardList, Zap, Database, BarChart3, Settings,
  Sun, Moon, TrendingUp, Package, Wrench, Activity, ChevronDown, ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme } from "@/hooks/useTheme";

interface Props {
  currentView: string;
  onNavigate: (view: string) => void;
  lastUpdated?: string | null;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  num: string;
  isRoute?: boolean;
  routePath?: string;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: "comercial",
    label: "COMERCIAL CRM",
    items: [
      { id: "overview",         label: "Visão Geral",          icon: LayoutDashboard,   num: "01" },
      { id: "consultores",      label: "Consultores",           icon: Users,             num: "02" },
      { id: "regioes",          label: "Regiões",               icon: MapPin,            num: "03" },
      { id: "registros",        label: "Registros",             icon: Table2,            num: "04" },
      { id: "criticos",         label: "Clientes Críticos",     icon: AlertTriangle,     num: "05" },
      { id: "mapa",             label: "Mapa de Ações",         icon: Map,               num: "06" },
      { id: "insights",         label: "Observações",           icon: MessageSquareText, num: "07" },
      { id: "negocios-mensais", label: "Negócios",              icon: Handshake,         num: "08" },
      { id: "administrativo",   label: "Administrativo",        icon: ClipboardList,     num: "09" },
    ],
  },
  {
    id: "bi",
    label: "BI ANALYTICS",
    items: [
      { id: "dashboard-bi", label: "Dashboard BI", icon: BarChart3, num: "10" },
    ],
  },
  {
    id: "ferramentas",
    label: "FERRAMENTAS",
    items: [
      { id: "view-explorer", label: "Explorador de Views",  icon: Database, num: "11" },
      { id: "performance",   label: "Performance 2026",     icon: Zap, num: "12", isRoute: true, routePath: "/performance" },
    ],
  },
];

/* Sidebar link — VOUX style */
function SidebarLink({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  const inner = (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-[10px] py-[9px] rounded-[8px] text-[13px] transition-all",
        "hover:bg-[var(--voux-card-border)] hover:text-[var(--voux-text-primary)]",
        active
          ? "bg-[var(--voux-card-border)] text-[var(--voux-accent)]"
          : "text-[var(--voux-text-muted)]",
        collapsed && "justify-center px-[10px]",
      )}
      style={{ transitionDuration: "120ms" }}
    >
      <Icon
        className={cn(
          "flex-shrink-0",
          active ? "opacity-100" : "opacity-60",
          collapsed ? "h-[18px] w-[18px]" : "h-4 w-4",
        )}
      />
      {!collapsed && (
        <>
          <span className="flex-1 text-left leading-none">{item.label}</span>
          <span
            className={cn(
              "text-[9px] tracking-[0.18em]",
              active ? "text-[var(--voux-accent)]" : "text-[var(--voux-text-muted)]",
            )}
            style={{ fontFamily: "var(--voux-font-mono)" }}
          >
            {item.num}
          </span>
        </>
      )}
    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="right" className="bg-[var(--voux-skeleton)] text-[var(--voux-text-primary)] border-[var(--voux-card-border)]">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }
  return inner;
}

export const DashboardSidebar = ({ currentView, onNavigate, lastUpdated }: Props) => {
  const navigate = useNavigate();
  const { isDark, toggle: toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    comercial: true,
    bi: true,
    ferramentas: false,
  });

  const toggleGroup = (id: string) => {
    setExpandedGroups((p) => ({ ...p, [id]: !p[id] }));
  };

  const handleItemClick = (item: NavItem) => {
    if (item.isRoute && item.routePath) navigate(item.routePath);
    else onNavigate(item.id);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "shrink-0 flex flex-col border-r transition-[width] duration-200",
          "bg-gradient-to-b from-[var(--voux-card-to)] to-[var(--voux-card-to)]",
          "border-[var(--voux-card-border)]",
          collapsed ? "w-[56px]" : "w-[252px]",
        )}
        style={{ height: "100vh", position: "sticky", top: 0, overflowY: "auto" }}
      >
        {/* Brand */}
        <div
          className={cn(
            "flex items-center gap-3 border-b border-[var(--voux-card-border)]",
            collapsed ? "p-3 justify-center" : "p-5 px-[22px]",
          )}
        >
          {/* Logo mark */}
          <div
            className="flex-shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center text-[20px] italic text-[var(--voux-card-to)] font-bold"
            style={{
              background: "linear-gradient(135deg, var(--voux-accent), #927142)",
              boxShadow: "0 0 24px rgba(212,184,150,0.18), 0 0 1px rgba(212,184,150,0.5)",
              fontFamily: "var(--voux-font-display)",
            }}
          >
            C
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div
                className="text-[18px] text-[var(--voux-text-primary)] leading-none tracking-[-0.01em]"
                style={{ fontFamily: "var(--voux-font-display)" }}
              >
                Ceres <em className="not-italic" style={{ color: "var(--voux-accent)" }}>BI</em>
              </div>
              <div
                className="text-[9px] tracking-[0.26em] uppercase text-[var(--voux-text-muted)] mt-1"
                style={{ fontFamily: "var(--voux-font-mono)" }}
              >
                Business Intelligence
              </div>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="opacity-30 hover:opacity-60 transition-opacity text-[var(--voux-text-primary)]"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 3L5 8l5 5" />
              </svg>
            </button>
          )}
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              className="opacity-30 hover:opacity-60 transition-opacity text-[var(--voux-text-primary)] mt-1"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 3l5 5-5 5" />
              </svg>
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className={cn("flex-1 py-4", collapsed ? "px-2" : "px-3")}>
          {NAV_GROUPS.map((group) => {
            const isExpanded = expandedGroups[group.id] ?? false;
            return (
              <div key={group.id} className="mb-5">
                {/* Group label */}
                {!collapsed && (
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="w-full flex items-center gap-2 px-[10px] mb-2"
                  >
                    <span
                      className="text-[9px] tracking-[0.26em] uppercase text-[var(--voux-text-muted)] flex-1 text-left"
                      style={{ fontFamily: "var(--voux-font-mono)" }}
                    >
                      {group.label}
                    </span>
                    <span className="text-[var(--voux-text-muted)] opacity-60">
                      {isExpanded
                        ? <ChevronDown className="h-3 w-3" />
                        : <ChevronRight className="h-3 w-3" />}
                    </span>
                  </button>
                )}
                {/* Divider line when collapsed */}
                {collapsed && (
                  <div className="h-px bg-[var(--voux-card-border)] mb-2" />
                )}
                {/* Items */}
                {(isExpanded || collapsed) && (
                  <div className="space-y-[2px]">
                    {group.items.map((item) => (
                      <SidebarLink
                        key={item.id}
                        item={item}
                        active={currentView === item.id}
                        collapsed={collapsed}
                        onClick={() => handleItemClick(item)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div
          className={cn(
            "border-t border-[var(--voux-card-border)]",
            collapsed ? "p-2 flex flex-col items-center gap-2" : "p-4",
          )}
        >
          {!collapsed && lastUpdated && (
            <p
              className="text-[9px] tracking-[0.12em] text-[var(--voux-text-muted)] mb-2 px-[10px]"
              style={{ fontFamily: "var(--voux-font-mono)" }}
            >
              Sync: {new Date(lastUpdated).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          )}
          <button
            onClick={toggleTheme}
            className={cn(
              "flex items-center gap-2 rounded-lg text-[var(--voux-text-faint)] hover:text-[var(--voux-text-primary)] transition-colors",
              collapsed ? "p-2" : "w-full px-[10px] py-2 text-[12px]",
            )}
          >
            {isDark
              ? <Sun className="h-4 w-4 flex-shrink-0" />
              : <Moon className="h-4 w-4 flex-shrink-0" />}
            {!collapsed && <span>{isDark ? "Modo claro" : "Modo escuro"}</span>}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
};
