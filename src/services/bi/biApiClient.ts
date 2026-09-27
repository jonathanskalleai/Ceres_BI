import { supabase } from "@/integrations/supabase/client";

/**
 * Shared authentication primitive for the canonical BI transport.
 *
 * Keeping session lookup in one module prevents the dashboard clients from
 * growing a second, incompatible HTTP implementation. The request/response
 * contract, telemetry and fail-closed handling remain in biApiTransport.
 */
export async function getBiAccessToken(): Promise<string | undefined> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
}
