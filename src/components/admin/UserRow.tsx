import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Shield, ShieldOff, UserCog, Key, KeyRound, Trash2 } from 'lucide-react';
import { hasAdminClient } from '@/services/adminService';
import type { Profile } from '@/types/auth';
import type { ConfirmAction } from '@/hooks/useAdminUsers';

interface UserRowProps {
  user: Profile;
  email: string | undefined;
  currentUserId: string | null;
  onPermissions: (user: Profile) => void;
  onChangePassword: (user: Profile) => void;
  onDelete: (user: Profile) => void;
  onConfirm: (action: ConfirmAction) => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function UserRow({
  user: u,
  email,
  currentUserId,
  onPermissions,
  onChangePassword,
  onDelete,
  onConfirm,
}: UserRowProps) {
  const isSelf = u.id === currentUserId;
  const canDelete = hasAdminClient && !isSelf;
  const canAdminPassword = hasAdminClient;

  return (
    <div className="flex items-center gap-4 rounded-xl bg-card border border-border px-5 py-4 hover:border-champagne-400/30 transition-colors">
      {/* Avatar */}
      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-muted flex items-center justify-center text-xs font-mono uppercase text-muted-foreground tracking-wider overflow-hidden">
        {u.avatar_url ? (
          <img src={u.avatar_url} alt={u.full_name} className="h-10 w-10 rounded-full object-cover" />
        ) : (
          getInitials(u.full_name || 'U')
        )}
      </div>

      {/* Name + badges */}
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
            <Badge className="bg-red-950/40 text-red-400 border-red-800/40 text-[10px]">inativo</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{email || u.id}</p>
      </div>

      {/* Actions dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-8 w-8 p-0 flex-shrink-0"
            aria-label={`Acoes para ${u.full_name || 'usuario'}`}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-card border-border text-foreground w-52">
          {u.role !== 'admin' && (
            <DropdownMenuItem onClick={() => onPermissions(u)} className="cursor-pointer">
              <Key className="mr-2 h-4 w-4" />
              Editar Permissoes
            </DropdownMenuItem>
          )}

          {canAdminPassword && (
            <DropdownMenuItem onClick={() => onChangePassword(u)} className="cursor-pointer">
              <KeyRound className="mr-2 h-4 w-4" />
              Alterar Senha
            </DropdownMenuItem>
          )}

          {!isSelf && (
            <>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={() => onConfirm({ user: u, action: 'role' })}
                className="cursor-pointer"
              >
                <UserCog className="mr-2 h-4 w-4" />
                {u.role === 'admin' ? 'Remover Admin' : 'Tornar Admin'}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onConfirm({ user: u, action: 'toggle' })}
                className={`cursor-pointer ${u.is_active ? 'text-red-400 focus:text-red-400' : ''}`}
              >
                {u.is_active ? <ShieldOff className="mr-2 h-4 w-4" /> : <Shield className="mr-2 h-4 w-4" />}
                {u.is_active ? 'Desativar' : 'Ativar'}
              </DropdownMenuItem>
            </>
          )}

          {canDelete && (
            <>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={() => onDelete(u)}
                className="cursor-pointer text-red-400 focus:text-red-400"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir Usuario
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
