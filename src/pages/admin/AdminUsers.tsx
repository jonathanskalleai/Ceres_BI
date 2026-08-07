import { Navigate } from 'react-router-dom';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CreateUserDialog } from '@/components/admin/CreateUserDialog';
import { ChangePasswordDialog } from '@/components/admin/ChangePasswordDialog';
import { UserPermissionsSheet } from '@/components/admin/UserPermissionsSheet';
import { UserRow } from '@/components/admin/UserRow';
import { useAdminUsers } from '@/hooks/useAdminUsers';
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
  const {
    isAdmin,
    currentUserId,
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
  } = useAdminUsers();

  if (!isAdmin) return <Navigate to="/" replace />;

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
            <UserRow
              key={u.id}
              user={u}
              email={emails[u.id]}
              currentUserId={currentUserId}
              onPermissions={setPermissionsTarget}
              onChangePassword={setChangePasswordTarget}
              onDelete={(target) => setConfirmAction({ user: target, action: 'delete' })}
              onConfirm={setConfirmAction}
            />
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

      {/* Change password dialog */}
      <ChangePasswordDialog
        targetUser={changePasswordTarget}
        onOpenChange={(open) => { if (!open) setChangePasswordTarget(null); }}
        onChanged={() => {
          toast({ title: 'Senha alterada com sucesso' });
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
              {confirmAction?.action === 'delete'
                ? 'Excluir usuario?'
                : confirmAction?.action === 'toggle'
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
              {confirmAction?.action === 'delete'
                ? `${confirmAction.user.full_name} sera removido permanentemente (conta e perfil). Esta acao nao pode ser desfeita.`
                : confirmAction?.action === 'toggle' && confirmAction.user.is_active
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
              onClick={handleConfirmAction}
              className={
                confirmAction?.action === 'delete'
                  ? 'bg-red-600 text-white hover:bg-red-500'
                  : 'bg-champagne-400 text-ink-1000 hover:bg-champagne-300'
              }
            >
              {confirmAction?.action === 'delete' ? 'Excluir' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
