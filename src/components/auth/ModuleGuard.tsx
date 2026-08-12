import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/hooks/useAuth';
import { MODULE_ROUTES } from '@/components/layout/navItems';

interface ModuleGuardProps {
  moduleId: string;
  children: ReactNode;
}

export function ModuleGuard({ moduleId, children }: ModuleGuardProps) {
  const { allowedModules, visibleModules, canAccess, isLoading } = usePermissions();
  const { isAdmin } = useAuth();

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

  // Ao negar uma rota de BI/CRM, mantem o usuario no mesmo dominio sempre que
  // houver outro modulo visivel ali (ex.: /bi/painel -> /bi/acoes). Uma
  // permissao marcada como invisivel nao deve virar destino por acidente.
  const modulePrefix = `${moduleId.split(".")[0]}.`;
  const firstAllowed =
    visibleModules.find((module) => module.id.startsWith(modulePrefix))
    ?? visibleModules[0]
    ?? allowedModules.find((module) => module.id.startsWith(modulePrefix))
    ?? allowedModules[0];
  if (!firstAllowed) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={MODULE_ROUTES[firstAllowed.id] ?? '/'} replace />;
}
