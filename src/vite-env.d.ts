/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BI_API_ENABLED?: string;
  readonly VITE_BI_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
