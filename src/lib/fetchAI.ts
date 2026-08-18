import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch wrapper that injects the Supabase JWT into requests to the AI service.
 * Falls back to unauthenticated fetch if no session is available (will get 401).
 */
export async function fetchAI(url: string, init?: RequestInit): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string> || {}),
  };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  return fetch(url, { ...init, headers });
}
