import { LayoutDashboard, Users, MapPin, Table2, AlertTriangle, MessageSquareText, Map as MapIcon, Handshake, ClipboardList, Zap, Database, BarChart3, Settings, Settings2, User } from 'lucide-react';
import type { AppModule } from '@/types/auth';

/** Map of module_id to route path */
export const MODULE_ROUTES: Record<string, string> = {
  'crm.overview': '/crm/overview',
  'crm.consultores': '/crm/consultores',
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
  'bi.desempenho': '/bi/desempenho',
  'bi.inteligencia': '/bi/inteligencia',
  'bi.etl-monitor': '/bi/etl-monitor',
  'tools.explorer': '/tools/explorer',
  'tools.performance': '/tools/performance',
  'admin.users': '/admin/users',
  'admin.profile': '/admin/profile',
};

/** Map of icon_name to Lucide component */
export const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
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
  Settings2,
  User,
};

/** Build flat sorted nav items from allowed modules */
export function buildNavItems(modules: AppModule[], isAdmin: boolean): NavItem[] {
  const items: NavItem[] = [];
  const settingsModules: NavItem[] = [];

  // Module IDs that belong to the Configuracoes group
  const settingsModuleIds = new Set(['admin.users', 'bi.etl-monitor', 'tools.explorer']);

  for (const mod of modules) {
    const route = MODULE_ROUTES[mod.id];
    if (!route) continue;

    const navItem: NavItem = {
      id: mod.id,
      label: mod.label,
      icon: ICON_MAP[mod.icon_name] || LayoutDashboard,
      route,
    };

    // Group specific modules under Configuracoes (only if user is admin)
    if (settingsModuleIds.has(mod.id) && isAdmin) {
      settingsModules.push(navItem);
    } else if (!settingsModuleIds.has(mod.id)) {
      items.push(navItem);
    }
  }

  // Add Configuracoes group if user is admin and has >=1 of the settings modules
  if (isAdmin && settingsModules.length > 0) {
    items.push({
      id: 'admin-group',
      label: 'Configuracoes',
      icon: Settings2,
      route: '',
      children: settingsModules,
    });
  }

  return items;
}
