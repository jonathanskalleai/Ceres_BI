import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, MapPin, Table2, AlertTriangle, MessageSquareText,
  Map as MapIcon, Handshake, ClipboardList, Zap, Database, BarChart3, Settings,
  Sun, Moon, TrendingUp, Package, Wrench, Activity, ChevronDown, ChevronRight,
  LogOut, User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme } from '@/hooks/useTheme';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import type { AppModule } from '@/types/auth';

/** Map of module_id to route path */
const MODULE_ROUTES: Record<string, string> = {
  'crm.overview': '/crm/overview',
  'crm.consultores': '/crm/consultores',
  'crm.regioes': '/crm/regioes',
  'crm.registros': '/crm/registros',
  'crm.criticos': '/crm/criticos',
  'crm.mapa': '/crm/mapa',
  'crm.insights': '/crm/insights',
  'crm.negocios': '/crm/negocios',
  'crm.administrativo': '/crm/administrativo',
  'bi.painel': '/bi/painel',
  'bi.comercial': '/bi/comercial',
  'bi.pedidos': '/bi/pedidos',
  'bi.produtos': '/bi/produtos',
  'bi.servicos': '/bi/servicos',
  'bi.operacional': '/bi/operacional',
  'bi.admin': '/bi/admin',
  'bi.acoes': '/bi/acoes',
  'tools.explorer': '/tools/explorer',
  'tools.performance': '/tools/performance',
  'admin.users': '/admin/users',
  'admin.profile': '/admin/profile',
};

/** Map of icon_name to Lucide component */
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  Users,
  MapPin,
  Table2,
  AlertTriangle,
  MessageSquareText,
  Map: MapIcon,
  Handshake,
  ClipboardList,
  Zap,
  Database,
  BarChart3,
  Settings,
  TrendingUp,
  Package,
  Wrench,
  Activity,
  User,
};

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  num: string;
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

function buildNavGroups(modules: AppModule[]): NavGroup[] {
  const groupMap = new Map<string, NavGroup>();

  for (const mod of modules) {
    const route = MODULE_ROUTES[mod.id];
    if (!route) continue;

    if (!groupMap.has(mod.group_id)) {
      groupMap.set(mod.group_id, {
        id: mod.group_id,
        label: mod.group_label,
        items: [],
      });
    }

    const group = groupMap.get(mod.group_id)!;
    group.items.push({
      id: mod.id,
      label: mod.label,
      icon: ICON_MAP[mod.icon_name] || LayoutDashboard,
      route,
      num: String(mod.sort_order).padStart(2, '0'),
    });
  }

  // Sort groups by first item sort_order, items already sorted by DB query
  return Array.from(groupMap.values());
}

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
        'w-full flex items-center gap-3 px-[10px] py-[9px] rounded-[8px] text-[13px] transition-colors duration-150',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        active
          ? 'bg-sidebar-accent text-sidebar-primary'
          : 'text-sidebar-foreground/70',
        collapsed && 'justify-center px-[10px]',
      )}
    >
      <Icon
        className={cn(
          'flex-shrink-0',
          active ? 'opacity-100' : 'opacity-70',
          collapsed ? 'h-[18px] w-[18px]' : 'h-4 w-4',
        )}
      />
      {!collapsed && (
        <span className="flex-1 text-left leading-none">{item.label}</span>
      )}

    </button>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{inner}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }
  return inner;
}

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggle: toggleTheme } = useTheme();
  const { allowedModules, isLoading } = usePermissions();
  const { profile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    crm: true,
    bi: true,
    tools: false,
    admin: false,
  });

  const navGroups = useMemo(() => buildNavGroups(allowedModules), [allowedModules]);

  const toggleGroup = (id: string) => {
    setExpandedGroups((p) => ({ ...p, [id]: !p[id] }));
  };

  const handleItemClick = (item: NavItem) => {
    navigate(item.route);
  };

  const isActive = (item: NavItem): boolean => {
    return location.pathname === item.route || location.pathname.startsWith(item.route + '/');
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'shrink-0 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200',
          collapsed ? 'w-[56px]' : 'w-[252px]',
        )}
        style={{ height: '100vh', position: 'sticky', top: 0, overflowY: 'auto' }}
      >
        {/* Brand */}
        <div
          className={cn(
            'flex items-center gap-3 border-b border-sidebar-border',
            collapsed ? 'p-3 justify-center' : 'p-5 px-[22px]',
          )}
        >
          <div
            className="flex-shrink-0 w-9 h-9 rounded-[10px] flex items-center justify-center text-[20px] italic font-bold"
            style={{
              background: 'linear-gradient(135deg, var(--voux-champagne-400), var(--voux-champagne-600))',
              color: 'var(--voux-ink-1000)',
              boxShadow: '0 0 24px rgba(212,184,150,0.18), 0 0 1px rgba(212,184,150,0.5)',
              fontFamily: 'var(--voux-font-display)',
            }}
          >
            C
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div
                className="text-[18px] leading-none tracking-[-0.01em] text-sidebar-foreground"
                style={{ fontFamily: 'var(--voux-font-display)' }}
              >
                Ceres <em className="not-italic text-sidebar-primary">BI</em>
              </div>
              <div
                className="text-[9px] tracking-[0.26em] uppercase text-sidebar-foreground/50 mt-1"
                style={{ fontFamily: 'var(--voux-font-mono)' }}
              >
                Business Intelligence
              </div>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="opacity-40 hover:opacity-80 transition-opacity text-sidebar-foreground"
              aria-label="Recolher sidebar"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 3L5 8l5 5" />
              </svg>
            </button>
          )}
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              className="opacity-40 hover:opacity-80 transition-opacity text-sidebar-foreground mt-1"
              aria-label="Expandir sidebar"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 3l5 5-5 5" />
              </svg>
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className={cn('flex-1 py-4', collapsed ? 'px-2' : 'px-3')}>
          {isLoading ? (
            <div className="space-y-2 px-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-7 rounded bg-sidebar-accent animate-pulse" />
              ))}
            </div>
          ) : (
            navGroups.map((group) => {
              const isExpanded = expandedGroups[group.id] ?? true;
              return (
                <div key={group.id} className="mb-5">
                  {!collapsed && (
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className="w-full flex items-center gap-2 px-[10px] mb-2"
                    >
                      <span
                        className="text-[9px] tracking-[0.26em] uppercase text-sidebar-foreground/50 flex-1 text-left"
                        style={{ fontFamily: 'var(--voux-font-mono)' }}
                      >
                        {group.label}
                      </span>
                      <span className="text-sidebar-foreground/50">
                        {isExpanded
                          ? <ChevronDown className="h-3 w-3" />
                          : <ChevronRight className="h-3 w-3" />}
                      </span>
                    </button>
                  )}
                  {collapsed && (
                    <div className="h-px bg-sidebar-border mb-2" />
                  )}
                  {(isExpanded || collapsed) && (
                    <div className="space-y-[2px]">
                      {group.items.map((item) => (
                        <SidebarLink
                          key={item.id}
                          item={item}
                          active={isActive(item)}
                          collapsed={collapsed}
                          onClick={() => handleItemClick(item)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </nav>

        {/* Footer — user info + theme toggle */}
        <div
          className={cn(
            'border-t border-sidebar-border',
            collapsed ? 'p-2 flex flex-col items-center gap-2' : 'p-4 space-y-3',
          )}
        >
          {/* User info */}
          {profile && !collapsed && (
            <div className="flex items-center gap-2 px-[10px]">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-sidebar-accent flex items-center justify-center">
                <span
                  className="text-[10px] font-semibold text-sidebar-primary"
                  style={{ fontFamily: 'var(--voux-font-mono)' }}
                >
                  {profile.full_name?.charAt(0)?.toUpperCase() || 'U'}
                </span>
              </div>
              <span className="text-[12px] text-sidebar-foreground/70 truncate flex-1">
                {profile.full_name || 'Utilizador'}
              </span>
            </div>
          )}

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className={cn(
              'flex items-center gap-2 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors',
              collapsed ? 'p-2' : 'w-full px-[10px] py-2 text-[12px]',
            )}
          >
            {isDark
              ? <Sun className="h-4 w-4 flex-shrink-0" />
              : <Moon className="h-4 w-4 flex-shrink-0" />}
            {!collapsed && <span>{isDark ? 'Modo claro' : 'Modo escuro'}</span>}
          </button>

          {/* Logout */}
          <button
            onClick={signOut}
            className={cn(
              'flex items-center gap-2 rounded-lg text-sidebar-foreground/60 hover:text-destructive hover:bg-sidebar-accent transition-colors',
              collapsed ? 'p-2' : 'w-full px-[10px] py-2 text-[12px]',
            )}
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
