import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SidebarNavItem } from './SidebarNavItem';
import type { NavItem } from './SidebarNavItem';

interface SidebarNavItemGroupProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  defaultOpen?: boolean;
  collapsed: boolean;
  isActive: (item: NavItem) => boolean;
  onItemClick: (item: NavItem) => void;
  onToggle?: (open: boolean) => void;
}

export function SidebarNavItemGroup({
  label,
  icon: Icon,
  items,
  defaultOpen = true,
  collapsed,
  isActive,
  onItemClick,
}: SidebarNavItemGroupProps) {
  const [open, setOpen] = useState(collapsed ? false : defaultOpen);

  // Sync with collapsed state
  useEffect(() => {
    setOpen(collapsed ? false : defaultOpen);
  }, [collapsed, defaultOpen]);

  const toggleOpen = () => setOpen((prev) => !prev);

  const trigger = (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={toggleOpen}
          className={cn(
            'w-full flex items-center gap-3 px-[10px] py-[9px] rounded-[8px] text-[13px] transition-colors duration-150',
            'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            'text-sidebar-foreground/70',
            collapsed && 'justify-center px-[10px]',
          )}
        >
          <Icon
            className={cn(
              'flex-shrink-0 opacity-70',
              collapsed ? 'h-[18px] w-[18px]' : 'h-4 w-4',
            )}
          />
          {!collapsed && (
            <>
              <span className="flex-1 text-left leading-none">{label}</span>
              <ChevronRight
                className={cn(
                  'h-4 w-4 flex-shrink-0 transition-transform duration-200',
                  open && 'rotate-90',
                )}
              />
            </>
          )}
        </button>
      </TooltipTrigger>
      {collapsed && (
        <TooltipContent side="right" className="text-xs">
          {label}
        </TooltipContent>
      )}
    </Tooltip>
  );

  if (collapsed) {
    return trigger;
  }

  return (
    <div className="space-y-[2px]">
      {trigger}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-in-out',
          open ? 'max-h-[500px] opacity-100 mt-[2px]' : 'max-h-0 opacity-0 mt-0',
        )}
      >
        <div className="pl-2 space-y-[2px]">
          {items.map((item) => (
            <SidebarNavItem
              key={item.id}
              item={item}
              active={isActive(item)}
              collapsed={false}
              onClick={() => onItemClick(item)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
