import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn, session, isLoading: authLoading, authError, retrySession } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if already logged in
  if (!authLoading && !isSubmitting && session) {
    navigate('/', { replace: true });
    return null;
  }

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isPasswordValid = password.length >= 6;
  const canSubmit = isEmailValid && isPasswordValid && !isSubmitting && !authLoading;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    try {
      const { error } = await signIn(email, password);

      if (error) {
        toast.error('Falha no login', {
          description: error,
        });
        return;
      }

      navigate('/', { replace: true });
    } catch (error) {
      console.error('[LoginPage] Unexpected sign-in failure:', error);
      toast.error('Falha no login', {
        description: 'Não foi possível concluir o login. Tente novamente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="dark">
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-3xl border border-border bg-gradient-to-b from-muted to-card p-10 shadow-xl">
          {/* Logo */}
          <div className="mb-8 text-center">
            <h1 className="font-display text-4xl">
              <span className="italic text-champagne-400">Ceres</span>
              <span className="ml-2 font-sans font-bold text-foreground">BI</span>
            </h1>
            <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Sistema de Business Intelligence
            </p>
          </div>

          {authError && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <p>{authError}</p>
              <button
                type="button"
                onClick={() => void retrySession()}
                disabled={authLoading}
                className="mt-2 text-xs font-semibold underline underline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {authLoading ? 'Verificando sessão...' : 'Tentar novamente'}
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="login-email"
                className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground"
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-champagne-400 focus:outline-none focus:ring-1 focus:ring-champagne-400/50 transition-colors"
                placeholder="seu@email.com"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="login-password"
                className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground"
              >
                Senha
              </label>
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-champagne-400 focus:outline-none focus:ring-1 focus:ring-champagne-400/50 transition-colors"
                placeholder="******"
              />
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-2 rounded-full bg-champagne-400 px-6 py-3.5 font-medium text-ink-1000 transition-colors hover:bg-champagne-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {authLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-1000 border-t-transparent" />
                  Verificando sessão...
                </span>
              ) : isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink-1000 border-t-transparent" />
                  Entrando...
                </span>
              ) : (
                'Entrar'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
