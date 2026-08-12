import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { AppModule, UserPermission } from '@/types/auth';

interface UsePermissionsReturn {
  allModules: AppModule[];
  allowedModules: AppModule[];
  visibleModules: AppModule[];
  canAccess: (moduleId: string) => boolean;
  isLoading: boolean;
}

export function usePermissions(): UsePermissionsReturn {
  const { user } = useAuth();

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
    enabled: !!user,
  });

  const allowedModuleIds = new Set(userPermissions.map((p) => p.module_id));

  // Modules the user has explicit access to (permission record exists)
  const allowedModules = allModules.filter((m) => allowedModuleIds.has(m.id));

  // Modules visible in sidebar (has permission + is_visible !== false)
  const visibleModules = allModules.filter((m) => {
    const perm = userPermissions.find((p) => p.module_id === m.id);
    if (!perm) return false;
    return perm.is_visible !== false;
  });

  /**
   * canAccess() — does NOT check is_visible.
   * Only verifies the user has a permission record for the module.
   * is_visible controls sidebar visibility, not route accessibility.
   */
  const canAccess = (moduleId: string): boolean => allowedModuleIds.has(moduleId);

  return {
    allModules,
    allowedModules,
    visibleModules,
    canAccess,
    isLoading: modulesLoading || permissionsLoading,
  };
}
