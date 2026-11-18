/**
 * Uploads for pictures placed freely on the site from the visual editor. They go to the public
 * "site-editor-assets" bucket (created by supabase/apply-editor-assets.sql) and are referenced
 * by their public link, so they keep working after publishing without signed URLs.
 */
import { supabase } from '../lib/supabase';

export const EDITOR_ASSET_BUCKET = 'site-editor-assets';
const ALLOWED = new Map([['image/png', 'png'], ['image/jpeg', 'jpg'], ['image/webp', 'webp'], ['image/avif', 'avif']]);
const MAX_BYTES = 20 * 1024 * 1024;

export class EditorAssetError extends Error {
  constructor(public reason: 'type' | 'size' | 'bucket' | 'upload') { super(reason); }
}

export function editorAssetMessage(error: unknown) {
  const reason = error instanceof EditorAssetError ? error.reason : 'upload';
  if (reason === 'type') return 'აირჩიეთ PNG (გამჭვირვალეც), JPG, WebP ან AVIF.';
  if (reason === 'size') return 'სურათი 20 მბ-ზე დიდი არ უნდა იყოს.';
  if (reason === 'bucket') return 'სურათების საცავი ჯერ არ არის შექმნილი — Supabase-ში ერთხელ გაუშვით ფაილი supabase/apply-editor-assets.sql.';
  return 'ატვირთვა ვერ მოხერხდა. სცადეთ ხელახლა.';
}

/** Uploads an image and returns its public https link. */
export async function uploadEditorImage(file: File): Promise<string> {
  if (!supabase) throw new EditorAssetError('upload');
  const extension = ALLOWED.get(file.type);
  if (!extension) throw new EditorAssetError('type');
  if (file.size > MAX_BYTES) throw new EditorAssetError('size');
  const base = file.name.replace(/\.[^.]+$/, '').normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'image';
  const path = `${new Date().getFullYear()}/${crypto.randomUUID()}-${base}.${extension}`;
  const { error } = await supabase.storage.from(EDITOR_ASSET_BUCKET).upload(path, file, { cacheControl: '31536000', contentType: file.type, upsert: false });
  if (error) {
    const message = `${error.message ?? ''} ${(error as { statusCode?: string }).statusCode ?? ''}`.toLowerCase();
    throw new EditorAssetError(message.includes('bucket') && message.includes('not found') ? 'bucket' : 'upload');
  }
  return supabase.storage.from(EDITOR_ASSET_BUCKET).getPublicUrl(path).data.publicUrl;
}
