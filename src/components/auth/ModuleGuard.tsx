import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { MODULE_ROUTES } from '@/components/layout/AppSidebar';

interface ModuleGuardProps {
  moduleId: string;
  children: ReactNode;
}

export function ModuleGuard({ moduleId, children }: ModuleGuardProps) {
  const { allowedModules, canAccess, isAdmin, isLoading } = usePermissions();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-champagne-400 border-t-transparent" />
      </div>
    );
  }

  if (isAdmin || canAccess(moduleId)) {
    return <>{children}</>;
  }

  const firstAllowed = allowedModules[0];
  if (!firstAllowed) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={MODULE_ROUTES[firstAllowed.id] ?? '/'} replace />;
}
