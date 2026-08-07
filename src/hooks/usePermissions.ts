import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { AppModule, UserPermission } from '@/types/auth';

interface UsePermissionsReturn {
  allModules: AppModule[];
  allowedModules: AppModule[];
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

  const allowedModules = isAdmin
    ? allModules
    : allModules.filter((m) => allowedModuleIds.has(m.id));

  const canAccess = (moduleId: string): boolean => {
    if (isAdmin) return true;
    return allowedModuleIds.has(moduleId);
  };

  return {
    allModules,
    allowedModules,
    canAccess,
    isAdmin,
    isLoading: modulesLoading || permissionsLoading,
  };
}
