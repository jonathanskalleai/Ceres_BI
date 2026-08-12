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
  const { visibleModules, isLoading } = usePermissions();
  const { isAdmin, profile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(true);
  // No desktop a barra inicia recolhida e so muda por clique. A versao mobile
  // ocupa a largura do Sheet e deve permanecer expandida.
  const isCollapsed = !onNavClick && collapsed;

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
          onNavClick ? 'w-full' : (isCollapsed ? 'w-[56px]' : 'w-[200px]'),
        )}
        style={onNavClick ? { height: '100%', overflowY: 'auto' } : { height: '100vh', position: 'sticky', top: 0, overflowY: 'auto' }}
      >
        {/* Brand */}
        <div
          className={cn(
            'relative flex items-center border-b border-sidebar-border',
            isCollapsed ? 'p-3 justify-center' : 'px-4 py-4 justify-between',
          )}
        >
          <img
            src="/LogoCeresbranca.png"
            alt="Ceres BI"
            className={cn(
              'object-contain',
              isCollapsed ? 'h-8 w-8' : 'h-10 flex-1',
            )}
          />
          {!onNavClick && (
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className={cn(
                "rounded p-1 opacity-55 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary",
                isCollapsed && "absolute right-0.5 top-1/2 -translate-y-1/2",
              )}
              aria-label={isCollapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
              title={isCollapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
                {isCollapsed ? <path d="M6 3l5 5-5 5" /> : <path d="M10 3L5 8l5 5" />}
              </svg>
            </button>
          )}
        </div>

        {/* Nav — flat list sorted by sort_order */}
        <nav className={cn('flex-1 py-4', isCollapsed ? 'px-2' : 'px-3')}>
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
                      collapsed={isCollapsed}
                      isActive={isActive}
                      onItemClick={handleItemClick}
                    />
                  ) : (
                    <SidebarNavItem
                      key={item.id}
                      item={item}
                      active={isActive(item)}
                      collapsed={isCollapsed}
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
            isCollapsed ? 'p-2 flex flex-col items-center gap-2' : 'p-4 space-y-3',
          )}
        >
          {/* User info */}
          {profile && !isCollapsed && (
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
              isCollapsed ? 'p-2' : 'w-full px-[10px] py-2 text-[12px]',
            )}
          >
            {isDark
              ? <Sun className="h-4 w-4 flex-shrink-0" />
              : <Moon className="h-4 w-4 flex-shrink-0" />}
            {!isCollapsed && <span>{isDark ? 'Modo claro' : 'Modo escuro'}</span>}
          </button>

          {/* Logout */}
          <button
            onClick={signOut}
            className={cn(
              'flex items-center gap-2 rounded-lg text-sidebar-foreground/60 hover:text-destructive hover:bg-sidebar-accent transition-colors',
              isCollapsed ? 'p-2' : 'w-full px-[10px] py-2 text-[12px]',
            )}
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            {!isCollapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
