/**
 * Works shown in the hero's poster strip, read from the live catalogue:
 *  - by default, every published work of the posters category, in the admin's order;
 *  - or the works placed there from the visual editor ("work:<id>" keys).
 * Only published works are readable by visitors, so anything unpublished simply drops out.
 */
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { signThumbnails } from '../lib/imageThumbnail';

export type StripWork = { id: string; title: string; url: string };

type Row = { id: string; title: string; cover_image_path: string | null };

const cache = new Map<string, { work: StripWork | null; at: number }>();
const MAX_AGE = 50 * 60 * 1000; // signed links last an hour
const POSTER_CATEGORY = 'product-posters';
const POSTER_LIMIT = 60;
const liveCatalog = import.meta.env.VITE_PUBLIC_CATALOG_SOURCE === 'supabase';

/** Links for the works' main images: the light copy where there is one (the strip shows them small). */
async function signCovers(rows: Row[]) {
  const paths = rows.flatMap((row) => (row.cover_image_path ? [row.cover_image_path] : []));
  if (!paths.length || !supabase) return new Map<string, string>();
  const [signed, thumbnails] = await Promise.all([
    supabase.storage.from('portfolio-images').createSignedUrls(paths, 3600),
    signThumbnails(supabase, 'portfolio-images', paths).catch(() => new Map<string, string>()),
  ]);
  const urls = new Map((signed.data ?? []).filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl as string]));
  for (const [path, url] of thumbnails) urls.set(path, url);
  return urls;
}

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
  const rows = ((data ?? []) as Row[]).filter((row) => row.cover_image_path);
  const urlByPath = await signCovers(rows);

  for (const id of missing) {
    const row = rows.find((item) => item.id === id);
    const url = row?.cover_image_path ? urlByPath.get(row.cover_image_path) : undefined;
    const work = row && url ? { id, title: row.title, url } : null;
    cache.set(id, { work, at: now });
    if (work) result.set(id, work);
  }
  return result;
}

let posters: { works: StripWork[]; at: number } | null = null;
let posterRequest: Promise<StripWork[]> | null = null;

/** Published works of the posters category, in the admin's order (images signed for an hour). */
export function loadPosterWorks(): Promise<StripWork[]> {
  if (posters && Date.now() - posters.at < MAX_AGE) return Promise.resolve(posters.works);
  posterRequest ??= (async () => {
    const client = supabase;
    if (!client) throw new Error('Supabase-ის კავშირი გამართული არ არის.');
    const { data: category, error } = await client.from('portfolio_categories')
      .select('id')
      .eq('slug', POSTER_CATEGORY)
      .eq('is_active', true)
      .maybeSingle();
    if (error) throw error;
    if (!category) return [];
    const { data, error: projectError } = await client.from('portfolio_projects')
      .select('id, title, cover_image_path')
      .eq('category_id', (category as { id: string }).id)
      .eq('is_published', true)
      .is('deleted_at', null)
      .not('cover_image_path', 'is', null)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(POSTER_LIMIT);
    if (projectError) throw projectError;
    const rows = (data ?? []) as Row[];
    const urlByPath = await signCovers(rows);
    const at = Date.now();
    const works = rows.flatMap((row) => {
      const url = row.cover_image_path ? urlByPath.get(row.cover_image_path) : undefined;
      return url ? [{ id: row.id, title: row.title, url }] : [];
    });
    for (const work of works) cache.set(work.id, { work, at });
    posters = { works, at };
    return works;
  })().finally(() => { posterRequest = null; });
  return posterRequest;
}

/** Image links of the posters category already loaded on this page (none yet: empty). */
export const loadedPosterUrls = () => posters?.works.map((work) => work.url) ?? [];

/**
 * The posters category for the hero strip. `works` stays null where the live catalogue isn't
 * used (local preview) or if it can't be read; `loading` is true until the first answer. The
 * list is read again before its image links run out.
 */
export function usePosterWorks(): { works: StripWork[] | null; loading: boolean } {
  const [works, setWorks] = useState<StripWork[] | null>(() => (liveCatalog && posters ? posters.works : null));
  const [loading, setLoading] = useState(() => liveCatalog && !posters);
  useEffect(() => {
    if (!liveCatalog) return;
    let active = true;
    const read = () => loadPosterWorks()
      .then((list) => { if (active) { setWorks(list); setLoading(false); } })
      .catch(() => { if (active) setLoading(false); });
    void read();
    const timer = window.setInterval(read, MAX_AGE);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  return { works, loading };
}
