import { useState, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Shield, ShieldOff, UserCog, Key } from 'lucide-react';
import { CreateUserDialog } from '@/components/admin/CreateUserDialog';
import { UserPermissionsSheet } from '@/components/admin/UserPermissionsSheet';
import {
  listUsers,
  toggleUserActive,
  updateProfile,
  getUserEmails,
} from '@/services/adminService';
import type { Profile } from '@/types/auth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function AdminUsers() {
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();

  const [users, setUsers] = useState<Profile[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialogs state
  const [createOpen, setCreateOpen] = useState(false);
  const [permissionsTarget, setPermissionsTarget] = useState<Profile | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    user: Profile;
    action: 'toggle' | 'role';
  } | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const profiles = await listUsers();
      setUsers(profiles);

      // Try to get emails (may fail if no admin API access)
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

  // Guard: only admins (after all hooks)
  if (!isAdmin) return <Navigate to="/" replace />;

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

  function getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-display text-2xl text-foreground tracking-tight">
            Gerenciar Usuarios
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {users.length} usuario{users.length !== 1 && 's'} cadastrado{users.length !== 1 && 's'}
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-champagne-400 text-ink-1000 hover:bg-champagne-300 rounded-full px-5"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Novo Usuario
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-champagne-400" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-xl bg-red-950/30 border border-red-800/40 p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Users list */}
      {!loading && !error && (
        <div className="flex flex-col gap-3">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-4 rounded-xl bg-card border border-border px-5 py-4 hover:border-border transition-colors"
            >
              {/* Avatar */}
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs font-mono uppercase text-muted-foreground tracking-wider">
                {u.avatar_url ? (
                  <img
                    src={u.avatar_url}
                    alt={u.full_name}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  getInitials(u.full_name || 'U')
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground truncate">
                    {u.full_name || 'Sem nome'}
                  </span>
                  <Badge
                    className={
                      u.role === 'admin'
                        ? 'bg-champagne-400/20 text-champagne-400 border-champagne-400/30 text-[10px]'
                        : 'bg-secondary text-muted-foreground border-border text-[10px]'
                    }
                  >
                    {u.role}
                  </Badge>
                  {!u.is_active && (
                    <Badge className="bg-red-950/40 text-red-400 border-red-800/40 text-[10px]">
                      inativo
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {emails[u.id] || u.id}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Permissions (only for non-admin users) */}
                {u.role !== 'admin' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPermissionsTarget(u)}
                    className="text-muted-foreground hover:text-champagne-400 h-8 w-8 p-0"
                    title="Editar permissoes"
                  >
                    <Key className="h-4 w-4" />
                  </Button>
                )}

                {/* Toggle role */}
                {u.id !== user?.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmAction({ user: u, action: 'role' })}
                    className="text-muted-foreground hover:text-champagne-400 h-8 w-8 p-0"
                    title={u.role === 'admin' ? 'Remover admin' : 'Tornar admin'}
                  >
                    <UserCog className="h-4 w-4" />
                  </Button>
                )}

                {/* Toggle active */}
                {u.id !== user?.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmAction({ user: u, action: 'toggle' })}
                    className={`h-8 w-8 p-0 ${u.is_active ? 'text-muted-foreground hover:text-red-400' : 'text-muted-foreground hover:text-green-400'}`}
                    title={u.is_active ? 'Desativar' : 'Ativar'}
                  >
                    {u.is_active ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create user dialog */}
      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          toast({ title: 'Usuario criado com sucesso' });
          fetchUsers();
        }}
      />

      {/* Permissions sheet */}
      <UserPermissionsSheet
        open={!!permissionsTarget}
        onOpenChange={(open) => { if (!open) setPermissionsTarget(null); }}
        targetUser={permissionsTarget}
        onSaved={() => {
          toast({ title: 'Permissoes atualizadas' });
        }}
      />

      {/* Confirmation dialog */}
      <AlertDialog
        open={!!confirmAction}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
      >
        <AlertDialogContent className="bg-card border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              {confirmAction?.action === 'toggle'
                ? confirmAction.user.is_active
                  ? 'Desativar usuario?'
                  : 'Ativar usuario?'
                : confirmAction?.action === 'role'
                  ? confirmAction.user.role === 'admin'
                    ? 'Remover permissao de admin?'
                    : 'Tornar admin?'
                  : ''}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {confirmAction?.action === 'toggle' && confirmAction.user.is_active
                ? `${confirmAction.user.full_name} nao podera mais acessar o sistema.`
                : confirmAction?.action === 'toggle'
                  ? `${confirmAction.user.full_name} podera acessar o sistema novamente.`
                  : confirmAction?.action === 'role' && confirmAction.user.role !== 'admin'
                    ? `${confirmAction.user.full_name} tera acesso total ao sistema.`
                    : `${confirmAction?.user.full_name} perdera acesso administrativo.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-muted text-muted-foreground border-input hover:bg-accent">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirmAction) return;
                if (confirmAction.action === 'toggle') {
                  handleToggleActive(confirmAction.user);
                } else {
                  handleToggleRole(confirmAction.user);
                }
              }}
              className="bg-champagne-400 text-ink-1000 hover:bg-champagne-300"
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
