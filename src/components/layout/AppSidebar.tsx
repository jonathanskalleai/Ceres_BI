import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, MapPin, Table2, AlertTriangle, MessageSquareText,
  Map as MapIcon, Handshake, ClipboardList, Zap, Database, BarChart3, Settings,
  Sun, Moon, Settings2, LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTheme } from '@/hooks/useTheme';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarNavItemGroup } from './SidebarNavItemGroup';
import { buildNavItems } from './navItems';
import type { NavItem } from './SidebarNavItem';

export interface AppSidebarProps {
  /** Called after a nav item is clicked (used by mobile Sheet to close) */
  onNavClick?: () => void;
}

export function AppSidebar({ onNavClick }: AppSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark, toggle: toggleTheme } = useTheme();
  const { visibleModules, isLoading, isAdmin } = usePermissions();
  const { profile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const navItems = useMemo(() => buildNavItems(visibleModules, isAdmin), [visibleModules, isAdmin]);

  const handleItemClick = (item: NavItem) => {
    navigate(item.route);
    onNavClick?.();
  };

  const isActive = (item: NavItem): boolean => {
    return location.pathname === item.route || location.pathname.startsWith(item.route + '/');
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'shrink-0 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 sidebar-scroll',
          onNavClick ? 'w-full' : (collapsed ? 'w-[56px]' : 'w-[200px]'),
        )}
        style={onNavClick ? { height: '100%', overflowY: 'auto' } : { height: '100vh', position: 'sticky', top: 0, overflowY: 'auto' }}
      >
        {/* Brand */}
        <div
          className={cn(
            'flex items-center border-b border-sidebar-border',
            collapsed ? 'p-3 justify-center' : 'px-4 py-4 justify-between',
          )}
        >
          <img
            src="/LogoCeresbranca.png"
            alt="Ceres BI"
            className={cn(
              'object-contain',
              collapsed ? 'h-8 w-8' : 'h-10 flex-1',
            )}
          />
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

        {/* Nav — flat list sorted by sort_order */}
        <nav className={cn('flex-1 py-4', collapsed ? 'px-2' : 'px-3')}>
          {isLoading ? (
            <div className="space-y-2 px-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-7 rounded bg-sidebar-accent animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-[2px]">
              {navItems.length === 0 ? (
                <div className="text-center py-8 text-sidebar-foreground/50">
                  <p>Nenhum módulo disponível</p>
                </div>
              ) : (
                navItems.map((item) =>
                  item.children && item.children.length > 0 ? (
                    <SidebarNavItemGroup
                      key={item.id}
                      label={item.label}
                      icon={item.icon}
                      items={item.children}
                      defaultOpen={true}
                      collapsed={collapsed}
                      isActive={isActive}
                      onItemClick={handleItemClick}
                    />
                  ) : (
                    <SidebarNavItem
                      key={item.id}
                      item={item}
                      active={isActive(item)}
                      collapsed={collapsed}
                      onClick={() => handleItemClick(item)}
                    />
                  )
                )
              )}
            </div>
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
