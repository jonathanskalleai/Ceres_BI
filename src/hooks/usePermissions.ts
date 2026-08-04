import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { AppModule, UserPermission } from '@/types/auth';

interface UsePermissionsReturn {
  allModules: AppModule[];
  allowedModules: AppModule[];
  visibleModules: AppModule[];
  canAccess: (moduleId: string) => boolean;
  isAdmin: boolean;
  isLoading: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const { user, isAdmin } = useAuth();

  const { data: allModules = [], isLoading: modulesLoading } = useQuery<AppModule[]>({
    queryKey: ['app_modules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_modules')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      return data as AppModule[];
    },
    staleTime: 10 * 60_000, // 10 min
    enabled: !!user,
  });

  const { data: userPermissions = [], isLoading: permissionsLoading } = useQuery<UserPermission[]>({
    queryKey: ['user_permissions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      return data as UserPermission[];
    },
    staleTime: 10 * 60_000,
    enabled: !!user && !isAdmin,
  });

  const allowedModuleIds = new Set(userPermissions.map((p) => p.module_id));

  // Modules the user has access to (canAccess check)
  const allowedModules = isAdmin
    ? allModules
    : allModules.filter((m) => allowedModuleIds.has(m.id));

  // Modules visible in sidebar (allowed + is_visible !== false)
  // For admin, all modules are visible by default
  // For normal users, filter by is_visible flag
  const visibleModules = isAdmin
    ? allModules
    : allModules.filter((m) => {
        const perm = userPermissions.find((p) => p.module_id === m.id);
        // If no permission record, module is not allowed (not visible)
        if (!perm) return false;
        // Default to visible (is_visible is true by default in DB)
        return perm.is_visible !== false;
      });

  /**
   * canAccess() — does NOT check is_visible.
   * Only verifies the user has a permission record for the module.
   * is_visible controls sidebar visibility, not route accessibility.
   */
  const canAccess = (moduleId: string): boolean => {
    if (isAdmin) return true;
    return allowedModuleIds.has(moduleId);
  };

  return {
    allModules,
    allowedModules,
    visibleModules,
    canAccess,
    isAdmin,
    isLoading: modulesLoading || permissionsLoading,
  };
}
