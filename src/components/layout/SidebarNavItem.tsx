import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
}

interface SidebarNavItemProps {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
}

export function SidebarNavItem({ item, active, collapsed, onClick }: SidebarNavItemProps) {
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
