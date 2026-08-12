import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/hooks/useAuth";
import { MODULE_ROUTES } from "@/components/layout/navItems";

interface FirstAccessibleModuleRedirectProps {
  /** Quando definido, prioriza os modulos deste dominio (ex.: "bi."). */
  modulePrefix?: string;
}

/**
 * Resolve a rota inicial a partir da mesma lista que alimenta a sidebar.
 *
 * Nunca aponta para um modulo sem permissao. Assim, se `bi.painel` for
 * desmarcado para um usuario, entrar em `/` ou em `/bi` leva diretamente ao
 * primeiro dashboard visivel que ele ainda pode acessar.
 */
export function FirstAccessibleModuleRedirect({ modulePrefix }: FirstAccessibleModuleRedirectProps) {
  const { visibleModules, allowedModules, isLoading } = usePermissions();
  const { isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-champagne-400 border-t-transparent" />
      </div>
    );
  }

  // Administradores mantem o Painel como ponto inicial, independentemente de
  // registros individuais em user_permissions.
  if (isAdmin) {
    return <Navigate to="/bi/painel" replace />;
  }

  const preferred = modulePrefix
    ? visibleModules.find((module) => module.id.startsWith(modulePrefix))
    : undefined;
  const firstVisible = preferred ?? visibleModules[0];
  const fallbackAllowed = allowedModules[0];
  const destination = firstVisible ?? fallbackAllowed;

  if (!destination) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={MODULE_ROUTES[destination.id] ?? "/login"} replace />;
}
