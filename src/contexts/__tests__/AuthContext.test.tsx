import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: authMocks,
  },
  clearPersistedAuthSession: vi.fn(),
}));

import { AuthProvider, useAuthContext } from '../AuthContext';

function AuthProbe() {
  const { authError, isLoading, signIn } = useAuthContext();

  return (
    <>
      <span>{isLoading ? 'carregando' : 'pronto'}</span>
      <span>{authError ?? 'sem erro'}</span>
      <button onClick={() => void signIn('teste@ceres.com.br', 'senha-segura')}>Entrar</button>
    </>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    authMocks.signOut.mockResolvedValue({ error: null });
  });

  it('sai do carregamento quando a leitura da sessão falha', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    authMocks.getSession.mockRejectedValue(new Error('network failed'));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(await screen.findByText('pronto')).toBeInTheDocument();
    expect(screen.getByText(/Não foi possível verificar sua sessão/)).toBeInTheDocument();
  });

  it('permite outra tentativa quando o login falha por erro de rede', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    authMocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    authMocks.signInWithPassword.mockRejectedValue(new Error('network failed'));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await screen.findByText('pronto');
    await act(async () => {
      screen.getByRole('button', { name: 'Entrar' }).click();
    });

    await waitFor(() => {
      expect(screen.getByText('Não foi possível concluir o login. Tente novamente.')).toBeInTheDocument();
    });
  });
});
