/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BI_API_ENABLED?: string;
  readonly VITE_BI_API_BASE_URL?: string;
  readonly VITE_BI_LEGACY_RPC_FALLBACK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
