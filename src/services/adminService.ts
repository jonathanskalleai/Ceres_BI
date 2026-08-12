import { supabase } from '@/integrations/supabase/client';
import { supabaseAdmin } from '@/integrations/supabase/adminClient';
import type { Profile, AppModule, UserPermission } from '@/types/auth';

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

/** Get full permission records for a user (including is_visible). */
export async function getUserPermissions(userId: string): Promise<UserPermission[]> {
  const { data, error } = await supabase
    .from('user_permissions')
    .select('*')
    .eq('user_id', userId);

  if (error) throw new Error(`Erro ao buscar permissoes: ${error.message}`);
  return data as UserPermission[];
}

/** Get module IDs that a user has access to. */
export async function getUserPermissionIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('user_permissions')
    .select('module_id')
    .eq('user_id', userId);

  if (error) throw new Error(`Erro ao buscar permissoes: ${error.message}`);
  return (data ?? []).map((r) => r.module_id);
}

/** Get visibility settings for a user: map of moduleId -> is_visible. */
export async function getUserVisibility(userId: string): Promise<Record<string, boolean>> {
  const { data, error } = await supabase
    .from('user_permissions')
    .select('module_id, is_visible')
    .eq('user_id', userId);

  if (error) throw new Error(`Erro ao buscar visibilidade: ${error.message}`);

  const visibility: Record<string, boolean> = {};
  for (const row of data ?? []) {
    // Default to true (is_visible is true by default in DB)
    visibility[row.module_id] = row.is_visible !== false;
  }
  return visibility;
}

/** Set visibility for a specific module (preserves existing permission if exists). */
export async function setUserVisibility(
  userId: string,
  moduleId: string,
  isVisible: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('user_permissions')
    .update({ is_visible: isVisible })
    .eq('user_id', userId)
    .eq('module_id', moduleId);

  if (error) throw new Error(`Erro ao salvar visibilidade: ${error.message}`);
}

/**
 * Permission record with visibility.
 * Used by UI to track both the permission (access) and visibility state.
 */
export interface UserPermissionWithVisibility {
  moduleId: string;
  isVisible: boolean;
}

/** Replace all permissions for a user with visibility settings (transactional delete + insert). */
export async function setUserPermissions(
  userId: string,
  permissions: UserPermissionWithVisibility[],
  grantedBy: string,
): Promise<void> {
  // Build permissions payload for the transactional function
  const permPayload = permissions.map((perm) => ({
    moduleId: perm.moduleId,
    isVisible: perm.isVisible,
  }));

  // Use the transactional RPC function to prevent permission loss on failure
  // The function uses advisory lock + atomic DELETE+INSERT
  const { error } = await supabase.rpc('set_user_permissions_tx', {
    p_user_id: userId,
    // Pass the array itself. Stringifying here makes PostgREST receive a JSONB
    // string rather than a JSONB array, so the RPC deletes rows and skips its
    // array-only INSERT branch.
    p_permissions: permPayload,
    p_granted_by: grantedBy,
  });

  if (error) {
    // Se a RPC falhar, lancamos erro indicando que a migration pode nao ter sido aplicada.
    // Nao usamos fallback DELETE+INSERT sequencial porque ha risco de perda de permissoes
    // se DELETE succeed mas INSERT falha.
    throw new Error(
      `Erro ao salvar permissoes: ${error.message}. ` +
      `Se a funcao 'set_user_permissions_tx' nao existir, aplique a migration.`
    );
  }
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
// Admin-only operations (require VITE_SUPABASE_SERVICE_ROLE_KEY)
// ---------------------------------------------------------------------------

/** Delete user completely (auth + profile). Requires VITE_SUPABASE_SERVICE_ROLE_KEY. */
export async function deleteUser(userId: string): Promise<{ error: string | null }> {
  if (!supabaseAdmin) return { error: 'Admin API não disponível (SERVICE_ROLE_KEY não configurada)' };
  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  return { error: null };
}

/** Set a new password for any user. Requires VITE_SUPABASE_SERVICE_ROLE_KEY. */
export async function adminSetPassword(
  userId: string,
  newPassword: string,
): Promise<{ error: string | null }> {
  if (!supabaseAdmin) return { error: 'Admin API não disponível (SERVICE_ROLE_KEY não configurada)' };
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword });
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
  const emailMap: Record<string, string> = {};
  if (!supabaseAdmin) return emailMap;

  for (const uid of userIds) {
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(uid);
      if (data?.user?.email) {
        emailMap[uid] = data.user.email;
      }
    } catch {
      continue;
    }
  }

  return emailMap;
}

// Re-export so UI components can check service-role availability from one place.
export { hasAdminClient } from '@/integrations/supabase/adminClient';
