import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpcMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: rpcMock },
}));

vi.mock('@/integrations/supabase/adminClient', () => ({
  supabaseAdmin: null,
  hasAdminClient: false,
}));

import { getUserEmails } from '@/services/adminService';

describe('getUserEmails', () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it('busca todos os e-mails em uma única RPC e cria o mapa por usuário', async () => {
    rpcMock.mockResolvedValue({
      data: [
        { user_id: 'user-1', email: 'admin@example.com' },
        { user_id: 'user-2', email: 'gestor@example.com' },
      ],
      error: null,
    });

    await expect(getUserEmails(['user-1', 'user-2'])).resolves.toEqual({
      'user-1': 'admin@example.com',
      'user-2': 'gestor@example.com',
    });
    expect(rpcMock).toHaveBeenCalledOnce();
    expect(rpcMock).toHaveBeenCalledWith('admin_get_user_emails', {
      p_user_ids: ['user-1', 'user-2'],
    });
  });

  it('não chama a RPC quando não existem usuários', async () => {
    await expect(getUserEmails([])).resolves.toEqual({});
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('ignora e-mail nulo sem voltar a exibir o identificador', async () => {
    rpcMock.mockResolvedValue({
      data: [{ user_id: 'user-1', email: null }],
      error: null,
    });

    await expect(getUserEmails(['user-1'])).resolves.toEqual({});
  });

  it('propaga falhas da RPC para impedir uma lista silenciosamente incompleta', async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'permission denied' },
    });

    await expect(getUserEmails(['user-1'])).rejects.toThrow(
      'Erro ao listar e-mails dos usuarios: permission denied',
    );
  });
});
