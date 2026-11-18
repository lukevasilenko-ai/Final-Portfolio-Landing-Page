/**
 * Light copies ("thumbnails") of portfolio images, for places that show them small: the catalogue
 * grid, the hero strip, the lightbox's filmstrip. The admin makes one in the browser whenever an
 * image is uploaded (at most 900 px on the long side, WebP) and stores it next to the original as
 * "<folder>/thumb-<name without extension>.webp". The original is never changed. The site uses the
 * light copy when it exists and can be read, and the original otherwise.
 *
 * Visitors may read a light copy exactly when they may read its original; the matching storage
 * rule (supabase/migrations/20261119120000_portfolio_thumbnails.sql) builds the same name in SQL,
 * so the two must stay in step.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const THUMBNAIL_MAX_SIDE = 900;
const THUMBNAIL_QUALITY = 0.82;

/** "a1/b2-poster.jpg" → "a1/thumb-b2-poster.webp" */
export function thumbnailPath(path: string) {
  const slash = path.lastIndexOf('/');
  const folder = path.slice(0, slash + 1);
  const name = path.slice(slash + 1);
  return `${folder}thumb-${name.replace(/\.[^./]*$/, '')}.webp`;
}

export const isThumbnailPath = (path: string) => /(^|\/)thumb-[^/]*$/.test(path);

/** A smaller WebP copy of an image, or null if this browser can't make one. */
export async function makeThumbnail(source: Blob, maxSide = THUMBNAIL_MAX_SIDE): Promise<Blob | null> {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source);
  } catch {
    return null;
  }
  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', THUMBNAIL_QUALITY));
    // Some browsers quietly fall back to PNG; a PNG "light copy" would not be light.
    return blob?.type === 'image/webp' ? blob : null;
  } finally {
    bitmap.close();
  }
}

/**
 * Makes the light copy of an uploaded image and stores it next to it (replacing an older one).
 * Never throws: if it can't be made, the site simply keeps showing the original.
 */
export async function uploadThumbnail(client: SupabaseClient, bucket: string, path: string, source: Blob) {
  try {
    const blob = await makeThumbnail(source);
    if (!blob) return false;
    const { error } = await client.storage.from(bucket).upload(thumbnailPath(path), blob, {
      cacheControl: '31536000', contentType: 'image/webp', upsert: true,
    });
    return !error;
  } catch {
    return false;
  }
}

/**
 * Signed links for the light copies of the given images that exist and can be read; the result
 * maps each original's path to its light copy's link. Missing copies are simply left out.
 */
export async function signThumbnails(client: SupabaseClient, bucket: string, paths: string[], seconds = 3600) {
  const result = new Map<string, string>();
  const originals = paths.filter((path) => !isThumbnailPath(path));
  for (let start = 0; start < originals.length; start += 100) {
    const batch = originals.slice(start, start + 100);
    const { data, error } = await client.storage.from(bucket).createSignedUrls(batch.map(thumbnailPath), seconds);
    if (error) continue;
    (data ?? []).forEach((item, index) => { if (item.signedUrl) result.set(batch[index], item.signedUrl); });
  }
  return result;
}
