import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { UserRow } from '@/components/admin/UserRow';
import type { Profile } from '@/types/auth';

vi.mock('@/services/adminService', () => ({
  hasAdminClient: false,
}));

const user: Profile = {
  id: '4f44bd31-533b-4a16-89a8-657224e415d3',
  full_name: 'Usuário Teste',
  avatar_url: null,
  role: 'admin',
  is_active: true,
  created_at: '2026-09-21T00:00:00Z',
  updated_at: '2026-09-21T00:00:00Z',
};

const handlers = {
  currentUserId: user.id,
  onPermissions: vi.fn(),
  onChangePassword: vi.fn(),
  onDelete: vi.fn(),
  onConfirm: vi.fn(),
};

describe('UserRow', () => {
  it('exibe o e-mail associado sem mostrar o UUID', () => {
    render(<UserRow user={user} email="admin@example.com" {...handlers} />);

    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
    expect(screen.queryByText(user.id)).not.toBeInTheDocument();
  });

  it('exibe um estado explícito quando a conta não tem e-mail', () => {
    render(<UserRow user={user} email={undefined} {...handlers} />);

    expect(screen.getByText('E-mail não cadastrado')).toBeInTheDocument();
    expect(screen.queryByText(user.id)).not.toBeInTheDocument();
  });
});
