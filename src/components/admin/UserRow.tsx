import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, ShieldOff, UserCog, Key } from 'lucide-react';
import type { Profile } from '@/types/auth';
import type { ConfirmAction } from '@/hooks/useAdminUsers';

interface UserRowProps {
  user: Profile;
  email: string | undefined;
  currentUserId: string | null;
  onPermissions: (user: Profile) => void;
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

export function UserRow({ user: u, email, currentUserId, onPermissions, onConfirm }: UserRowProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl bg-card border border-border px-5 py-4 hover:border-border transition-colors">
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
          {email || u.id}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {u.role !== 'admin' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPermissions(u)}
            className="text-muted-foreground hover:text-champagne-400 h-8 w-8 p-0"
            title="Editar permissoes"
          >
            <Key className="h-4 w-4" />
          </Button>
        )}

        {u.id !== currentUserId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onConfirm({ user: u, action: 'role' })}
            className="text-muted-foreground hover:text-champagne-400 h-8 w-8 p-0"
            title={u.role === 'admin' ? 'Remover admin' : 'Tornar admin'}
          >
            <UserCog className="h-4 w-4" />
          </Button>
        )}

        {u.id !== currentUserId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onConfirm({ user: u, action: 'toggle' })}
            className={`h-8 w-8 p-0 ${u.is_active ? 'text-muted-foreground hover:text-red-400' : 'text-muted-foreground hover:text-green-400'}`}
            title={u.is_active ? 'Desativar' : 'Ativar'}
          >
            {u.is_active ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}
