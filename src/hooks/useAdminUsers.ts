import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  listUsers,
  toggleUserActive,
  updateProfile,
  getUserEmails,
  deleteUser,
} from '@/services/adminService';
import type { Profile } from '@/types/auth';

export interface ConfirmAction {
  user: Profile;
  action: 'toggle' | 'role' | 'delete';
}

export function useAdminUsers() {
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();

  const [users, setUsers] = useState<Profile[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [permissionsTarget, setPermissionsTarget] = useState<Profile | null>(null);
  const [changePasswordTarget, setChangePasswordTarget] = useState<Profile | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profiles = await listUsers();
      setUsers(profiles);

      const ids = profiles.map((p) => p.id);
      const emailMap = await getUserEmails(ids);
      setEmails(emailMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar usuarios');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [fetchUsers, isAdmin]);

  async function handleToggleActive(targetUser: Profile) {
    try {
      await toggleUserActive(targetUser.id, !targetUser.is_active);
      toast({
        title: targetUser.is_active ? 'Usuario desativado' : 'Usuario ativado',
      });
      fetchUsers();
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
    setConfirmAction(null);
  }

  async function handleToggleRole(targetUser: Profile) {
    const newRole = targetUser.role === 'admin' ? 'normal' : 'admin';
    try {
      await updateProfile(targetUser.id, { role: newRole });
      toast({ title: `Papel alterado para ${newRole}` });
      fetchUsers();
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
    setConfirmAction(null);
  }

  async function handleDeleteUser(targetUser: Profile) {
    try {
      const { error: delErr } = await deleteUser(targetUser.id);
      if (delErr) throw new Error(delErr);
      toast({ title: 'Usuario excluido' });
      fetchUsers();
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
    setConfirmAction(null);
  }

  function handleConfirmAction() {
    if (!confirmAction) return;
    if (confirmAction.action === 'toggle') {
      handleToggleActive(confirmAction.user);
    } else if (confirmAction.action === 'role') {
      handleToggleRole(confirmAction.user);
    } else {
      handleDeleteUser(confirmAction.user);
    }
  }

  return {
    isAdmin,
    currentUserId: user?.id ?? null,
    users,
    emails,
    loading,
    error,
    createOpen,
    setCreateOpen,
    permissionsTarget,
    setPermissionsTarget,
    changePasswordTarget,
    setChangePasswordTarget,
    confirmAction,
    setConfirmAction,
    handleConfirmAction,
    fetchUsers,
    toast,
  };
}
