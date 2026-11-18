/**
 * Images for works placed in the hero strip from the editor ("work:<id>" keys). Only published
 * works are readable by visitors, so anything unpublished simply drops out of the strip.
 */
import { supabase } from '../lib/supabase';

export type StripWork = { id: string; title: string; url: string };

const cache = new Map<string, { work: StripWork | null; at: number }>();
const MAX_AGE = 50 * 60 * 1000; // signed links last an hour

export async function loadStripWorks(ids: string[]): Promise<Map<string, StripWork>> {
  const result = new Map<string, StripWork>();
  const now = Date.now();
  const missing = ids.filter((id) => {
    const hit = cache.get(id);
    if (hit && now - hit.at < MAX_AGE) { if (hit.work) result.set(id, hit.work); return false; }
    return true;
  });
  if (!missing.length || !supabase) return result;

  const { data, error } = await supabase.from('portfolio_projects')
    .select('id, title, cover_image_path')
    .in('id', missing)
    .is('deleted_at', null);
  if (error) return result;
  const rows = ((data ?? []) as { id: string; title: string; cover_image_path: string | null }[]).filter((row) => row.cover_image_path);
  const paths = rows.map((row) => row.cover_image_path as string);
  const signed = paths.length ? await supabase.storage.from('portfolio-images').createSignedUrls(paths, 3600) : { data: [], error: null };
  const urlByPath = new Map((signed.data ?? []).filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl as string]));

  for (const id of missing) {
    const row = rows.find((item) => item.id === id);
    const url = row?.cover_image_path ? urlByPath.get(row.cover_image_path) : undefined;
    const work = row && url ? { id, title: row.title, url } : null;
    cache.set(id, { work, at: now });
    if (work) result.set(id, work);
  }
  return result;
}
