/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_PUBLIC_CATALOG_SOURCE?: 'local' | 'supabase';
  readonly VITE_CATALOG_PREVIEW_DRAFTS?: 'true' | 'false';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
