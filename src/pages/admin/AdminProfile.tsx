import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { updateProfile, changePassword } from '@/services/adminService';

export default function AdminProfile() {
  const { profile, user } = useAuth();
  const { toast } = useToast();

  // Profile form state
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  function getInitials(name: string): string {
    return name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !fullName.trim()) return;

    setSavingProfile(true);
    try {
      await updateProfile(user.id, { full_name: fullName.trim() });
      toast({ title: 'Perfil atualizado' });
    } catch (err) {
      toast({
        title: 'Erro ao salvar',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast({
        title: 'Senha muito curta',
        description: 'Minimo de 6 caracteres',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Senhas nao conferem',
        description: 'A nova senha e a confirmacao devem ser iguais',
        variant: 'destructive',
      });
      return;
    }

    setSavingPassword(true);
    try {
      const result = await changePassword(newPassword);
      if (result.error) {
        toast({ title: 'Erro', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Senha alterada com sucesso' });
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      toast({
        title: 'Erro',
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="p-6 md:p-10 max-w-2xl mx-auto">
      {/* Header with avatar */}
      <div className="flex items-center gap-5 mb-10">
        <div className="h-16 w-16 rounded-full bg-muted border border-border flex items-center justify-center text-lg font-mono uppercase text-muted-foreground tracking-wider flex-shrink-0">
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.full_name}
              className="h-16 w-16 rounded-full object-cover"
            />
          ) : (
            getInitials(profile?.full_name || 'U')
          )}
        </div>
        <div>
          <h2 className="font-display text-2xl text-foreground tracking-tight">
            Meu Perfil
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {user?.email}
          </p>
        </div>
      </div>

      {/* Profile form */}
      <section className="rounded-xl bg-card border border-border p-6 mb-6">
        <h3 className="text-[10px] font-mono uppercase tracking-[0.22em] text-champagne-400 mb-4">
          Informacoes pessoais
        </h3>

        <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-name" className="text-muted-foreground text-xs font-mono uppercase tracking-[0.22em]">
              Nome completo
            </Label>
            <Input
              id="profile-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="bg-muted border-input text-foreground"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="profile-email" className="text-muted-foreground text-xs font-mono uppercase tracking-[0.22em]">
              Email
            </Label>
            <Input
              id="profile-email"
              value={user?.email ?? ''}
              disabled
              className="bg-muted border-input text-muted-foreground cursor-not-allowed"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-muted-foreground text-xs font-mono uppercase tracking-[0.22em]">
              Papel
            </Label>
            <div className="text-sm text-muted-foreground bg-muted border border-input rounded-md px-3 py-2">
              {profile?.role === 'admin' ? 'Administrador' : 'Normal'}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={savingProfile}
              className="bg-champagne-400 text-ink-1000 hover:bg-champagne-300 rounded-full px-6"
            >
              {savingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </form>
      </section>

      {/* Password form */}
      <section className="rounded-xl bg-card border border-border p-6">
        <h3 className="text-[10px] font-mono uppercase tracking-[0.22em] text-champagne-400 mb-4">
          Alterar senha
        </h3>

        <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password" className="text-muted-foreground text-xs font-mono uppercase tracking-[0.22em]">
              Nova senha
            </Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min. 6 caracteres"
              className="bg-muted border-input text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-password" className="text-muted-foreground text-xs font-mono uppercase tracking-[0.22em]">
              Confirmar senha
            </Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a nova senha"
              className="bg-muted border-input text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              disabled={savingPassword || !newPassword}
              className="bg-champagne-400 text-ink-1000 hover:bg-champagne-300 rounded-full px-6"
            >
              {savingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Alterar senha
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
