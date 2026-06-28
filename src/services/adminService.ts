import { supabase } from '@/integrations/supabase/client';
import type { Profile, AppModule } from '@/types/auth';

// ---------------------------------------------------------------------------
// Users CRUD
// ---------------------------------------------------------------------------

/** List all user profiles (admin only). */
export async function listUsers(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Erro ao listar usuarios: ${error.message}`);
  return data as Profile[];
}

/** Update a user profile (name, avatar_url, role). */
export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile, 'full_name' | 'avatar_url' | 'role'>>,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw new Error(`Erro ao atualizar perfil: ${error.message}`);
}

/** Toggle user active/inactive status. */
export async function toggleUserActive(
  userId: string,
  isActive: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) throw new Error(`Erro ao alterar status: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Permissions
// ---------------------------------------------------------------------------

/** Get module IDs that a user has access to. */
export async function getUserPermissions(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_permissions')
    .select('module_id')
    .eq('user_id', userId);

  if (error) throw new Error(`Erro ao buscar permissoes: ${error.message}`);
  return (data ?? []).map((r) => r.module_id);
}

/** Replace all permissions for a user (delete + insert). */
export async function setUserPermissions(
  userId: string,
  moduleIds: string[],
  grantedBy: string,
): Promise<void> {
  // Delete existing
  const { error: delErr } = await supabase
    .from('user_permissions')
    .delete()
    .eq('user_id', userId);

  if (delErr) throw new Error(`Erro ao limpar permissoes: ${delErr.message}`);

  if (moduleIds.length === 0) return;

  // Insert new
  const rows = moduleIds.map((moduleId) => ({
    user_id: userId,
    module_id: moduleId,
    granted_by: grantedBy,
  }));

  const { error: insErr } = await supabase
    .from('user_permissions')
    .insert(rows);

  if (insErr) throw new Error(`Erro ao salvar permissoes: ${insErr.message}`);
}

// ---------------------------------------------------------------------------
// User Creation (MVP: signUp approach)
// ---------------------------------------------------------------------------

/**
 * Create a new user via Supabase Auth signUp.
 *
 * NOTE: For a production system this should be an Edge Function using
 * SERVICE_ROLE_KEY. The signUp approach works for MVP self-hosted where
 * email confirmation is disabled.
 */
export async function createUser(
  email: string,
  password: string,
  fullName: string,
  role: 'admin' | 'normal',
): Promise<{ userId: string | null; error: string | null }> {
  // Save admin session before signUp replaces it
  const { data: { session: adminSession } } = await supabase.auth.getSession();

  // signUp creates the auth user; DB trigger should create profile
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  // Restore admin session immediately (signUp replaces it with new user's session)
  if (adminSession) {
    await supabase.auth.setSession({
      access_token: adminSession.access_token,
      refresh_token: adminSession.refresh_token,
    });
  }

  if (error) return { userId: null, error: error.message };

  const userId = data.user?.id;
  if (!userId) return { userId: null, error: 'Usuário criado mas sem ID retornado' };

  // Update role in profile (trigger creates with 'normal' by default)
  if (role === 'admin') {
    const { error: roleErr } = await supabase
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (roleErr) {
      // User was created but role failed — not fatal
      console.error('[adminService] Failed to set role:', roleErr.message);
    }
  }

  return { userId, error: null };
}

// ---------------------------------------------------------------------------
// Password change (for own profile)
// ---------------------------------------------------------------------------

/** Change the current user's password. */
export async function changePassword(newPassword: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };
  return { error: null };
}

// ---------------------------------------------------------------------------
// Fetch all modules (used by permissions UI)
// ---------------------------------------------------------------------------

/** Get all app_modules ordered by sort_order. */
export async function listModules(): Promise<AppModule[]> {
  const { data, error } = await supabase
    .from('app_modules')
    .select('*')
    .order('sort_order');

  if (error) throw new Error(`Erro ao listar modulos: ${error.message}`);
  return data as AppModule[];
}

// ---------------------------------------------------------------------------
// Fetch user email from auth (admin needs to see emails in the list)
// ---------------------------------------------------------------------------

/**
 * Get emails for profiles. Since profiles table may not store email,
 * we query auth.users via the admin endpoint. If that fails (no admin access),
 * fall back to session user metadata or return empty.
 *
 * For MVP: we store email directly from a join or assume email is available
 * through auth metadata in the profile creation trigger.
 */
export async function getUserEmails(
  userIds: string[],
): Promise<Record<string, string>> {
  // Try fetching from auth.users via admin API
  // This might not work with anon key; graceful fallback
  const emailMap: Record<string, string> = {};

  for (const uid of userIds) {
    try {
      const { data } = await supabase.auth.admin.getUserById(uid);
      if (data?.user?.email) {
        emailMap[uid] = data.user.email;
      }
    } catch {
      // admin API not available with anon key — skip
      break;
    }
  }

  return emailMap;
}
