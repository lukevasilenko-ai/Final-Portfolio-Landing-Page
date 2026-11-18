import { createClient } from '@supabase/supabase-js';
import { getSupabaseAuthOptions } from './authLifecycle';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const isStagingMode = import.meta.env.MODE === 'staging';
// The same-origin builder iframe is a public preview, not a second owner of the admin session.
const isWebsiteBuilderPreview = typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).has('website-builder-preview');
const stagingConfigurationIsValid = !isStagingMode || (
  supabaseUrl === 'https://xkdmtkckxwcsrxnokcah.supabase.co'
  && supabasePublishableKey?.startsWith('sb_publishable_')
);

if (isStagingMode && !stagingConfigurationIsValid) {
  console.error('Staging safety check failed. Supabase was not initialized.');
}

export const supabase =
  supabaseUrl && supabasePublishableKey && stagingConfigurationIsValid
    ? createClient(supabaseUrl, supabasePublishableKey, {
        auth: getSupabaseAuthOptions(isWebsiteBuilderPreview),
      })
    : null;
