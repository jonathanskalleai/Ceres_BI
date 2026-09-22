interface SupabaseUrlOptions {
  configuredUrl: string;
  isProduction: boolean;
  origin: string;
}

/**
 * Production browsers use the BI origin so auth, REST and RPC traffic stays
 * on the already-established web connection. Vite/dev keeps the configured
 * Supabase URL for local development and preview environments.
 */
export function resolveSupabaseUrl({
  configuredUrl,
  isProduction,
  origin,
}: SupabaseUrlOptions): string {
  if (!isProduction) return configuredUrl;
  return `${origin.replace(/\/$/, "")}/supabase`;
}
