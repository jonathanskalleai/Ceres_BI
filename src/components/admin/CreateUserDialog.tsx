import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { createUser } from '@/services/adminService';

interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateUserDialog({ open, onOpenChange, onCreated }: CreateUserDialogProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'normal'>('normal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email || !password || !fullName) {
      setError('Preencha todos os campos');
      return;
    }

    if (password.length < 6) {
      setError('Senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      const result = await createUser(email, password, fullName, role);
      if (result.error) {
        setError(result.error);
      } else {
        // Reset form and close
        setEmail('');
        setPassword('');
        setFullName('');
        setRole('normal');
        onOpenChange(false);
        onCreated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-ink-900 border-ink-700 text-ink-50 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-ink-50">
            Novo Usuario
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-name" className="text-ink-200 text-xs font-mono uppercase tracking-[0.22em]">
              Nome completo
            </Label>
            <Input
              id="create-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Nome Sobrenome"
              className="bg-ink-850 border-ink-600 text-ink-50 placeholder:text-ink-400"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-email" className="text-ink-200 text-xs font-mono uppercase tracking-[0.22em]">
              Email
            </Label>
            <Input
              id="create-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
              className="bg-ink-850 border-ink-600 text-ink-50 placeholder:text-ink-400"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-password" className="text-ink-200 text-xs font-mono uppercase tracking-[0.22em]">
              Senha
            </Label>
            <Input
              id="create-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 6 caracteres"
              className="bg-ink-850 border-ink-600 text-ink-50 placeholder:text-ink-400"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="create-role" className="text-ink-200 text-xs font-mono uppercase tracking-[0.22em]">
              Papel
            </Label>
            <select
              id="create-role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'normal')}
              className="rounded-md bg-ink-850 border border-ink-600 text-ink-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-champagne-400/40"
            >
              <option value="normal">Normal</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="text-ink-300 hover:text-ink-50"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-champagne-400 text-ink-1000 hover:bg-champagne-300 rounded-full px-6"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar usuario
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
