import { supabase } from '../lib/supabase';
import {
  DEFAULT_WEBSITE_LAYOUT,
  dropRetiredLayoutContent,
  validateWebsiteLayout,
  type WebsiteLayoutConfig,
} from './model';

export const WEBSITE_ASSET_BUCKET = 'website-layout-assets';

export interface WebsiteLayoutVersion {
  id: string;
  version: number;
  status: 'draft' | 'published' | 'archived';
  config: WebsiteLayoutConfig;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface WebsiteLayoutAsset {
  id: string;
  storage_path: string;
  alt_text: string;
  is_published: boolean;
  created_at: string;
  previewUrl?: string;
}

export interface PublicWebsiteLayout {
  config: WebsiteLayoutConfig;
  imageUrls: Record<string, string>;
  warning?: string;
  usingPublishedConfig: boolean;
}

function collectAssetIds(config: WebsiteLayoutConfig) {
  const ids = new Set<string>();
  const visit = (block: WebsiteLayoutConfig['sections'][number]['elements'][number]) => {
    if (block.src?.startsWith('asset:')) ids.add(block.src.slice('asset:'.length));
    block.children?.forEach(visit);
  };
  config.sections.forEach((section) => {
    const heroImage = section.copy.heroImageSrc;
    if (heroImage?.startsWith('asset:')) ids.add(heroImage.slice('asset:'.length));
    section.elements.forEach(visit);
  });
  return [...ids];
}

export async function loadPublishedWebsiteLayout(): Promise<PublicWebsiteLayout> {
  if (!supabase) return { config: DEFAULT_WEBSITE_LAYOUT, imageUrls: {}, usingPublishedConfig: false };
  try {
    const { data, error } = await supabase
      .from('website_layout_versions')
      .select('config')
      .eq('status', 'published')
      .maybeSingle();
    if (error) return { config: DEFAULT_WEBSITE_LAYOUT, imageUrls: {}, warning: 'გამოქვეყნებული საიტის კონფიგურაცია ვერ ჩაიტვირთა; ნაჩვენებია საწყისი განლაგება.', usingPublishedConfig: false };
    if (!data) return { config: DEFAULT_WEBSITE_LAYOUT, imageUrls: {}, usingPublishedConfig: false };
    data.config = dropRetiredLayoutContent(data.config);
    if (!validateWebsiteLayout(data.config)) return { config: DEFAULT_WEBSITE_LAYOUT, imageUrls: {}, warning: 'გამოქვეყნებული საიტის კონფიგურაცია დაზიანებულია; ნაჩვენებია საწყისი განლაგება.', usingPublishedConfig: false };

    const ids = collectAssetIds(data.config);
    if (ids.length === 0) return { config: data.config, imageUrls: {}, usingPublishedConfig: true };
    const { data: assets, error: assetError } = await supabase
      .from('website_layout_assets')
      .select('id, storage_path, alt_text')
      .eq('is_published', true)
      .in('id', ids);
    if (assetError || (assets ?? []).length !== ids.length) {
      return { config: DEFAULT_WEBSITE_LAYOUT, imageUrls: {}, warning: 'სექციის ერთ-ერთი სურათი მიუწვდომელია; ნაჩვენებია საწყისი განლაგება.', usingPublishedConfig: false };
    }
    const paths = assets.map((asset) => asset.storage_path);
    const { data: signed, error: signError } = await supabase.storage.from(WEBSITE_ASSET_BUCKET).createSignedUrls(paths, 600);
    if (signError) return { config: DEFAULT_WEBSITE_LAYOUT, imageUrls: {}, warning: 'სექციის სურათების უსაფრთხო ბმულები ვერ შეიქმნა; ნაჩვენებია საწყისი განლაგება.', usingPublishedConfig: false };
    const signedByPath = new Map((signed ?? []).filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl as string]));
    const imageUrls: Record<string, string> = {};
    for (const asset of assets) {
      const url = signedByPath.get(asset.storage_path);
      if (!url) return { config: DEFAULT_WEBSITE_LAYOUT, imageUrls: {}, warning: 'სექციის სურათის უსაფრთხო ბმული ვერ განახლდა; ნაჩვენებია საწყისი განლაგება.', usingPublishedConfig: false };
      imageUrls[asset.id] = url;
    }
    return { config: data.config, imageUrls, usingPublishedConfig: true };
  } catch {
    return { config: DEFAULT_WEBSITE_LAYOUT, imageUrls: {}, warning: 'საიტის განლაგების ჩატვირთვა ვერ მოხერხდა; ნაჩვენებია საწყისი განლაგება.', usingPublishedConfig: false };
  }
}

export async function loadWebsiteLayoutManager() {
  if (!supabase) throw new Error('supabase_unconfigured');
  const [versionsResult, assetsResult] = await Promise.all([
    supabase.from('website_layout_versions')
      .select('id, version, status, config, created_at, updated_at, published_at')
      .order('version', { ascending: false })
      .limit(30),
    supabase.from('website_layout_assets')
      .select('id, storage_path, alt_text, is_published, created_at')
      .order('created_at', { ascending: false }),
  ]);
  if (versionsResult.error || assetsResult.error) {
    const error = versionsResult.error ?? assetsResult.error;
    throw new Error(error?.code === 'PGRST205' ? 'website_schema_missing' : 'website_manager_load_failed');
  }

  const versions = (versionsResult.data ?? []).flatMap((version) => {
    const config = dropRetiredLayoutContent(version.config);
    return validateWebsiteLayout(config) ? [{ ...version, config } as WebsiteLayoutVersion] : [];
  });
  const assets = (assetsResult.data ?? []) as WebsiteLayoutAsset[];
  const signed = assets.length > 0
    ? await supabase.storage.from(WEBSITE_ASSET_BUCKET).createSignedUrls(assets.map((asset) => asset.storage_path), 600)
    : { data: [], error: null };
  if (signed.error) throw new Error('website_asset_preview_failed');
  const signedByPath = new Map((signed.data ?? []).filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl as string]));
  return {
    versions,
    assets: assets.map((asset) => ({ ...asset, previewUrl: signedByPath.get(asset.storage_path) })),
  };
}

export async function saveWebsiteLayoutDraft(config: WebsiteLayoutConfig) {
  if (!supabase) throw new Error('supabase_unconfigured');
  if (!validateWebsiteLayout(config)) throw new Error('website_layout_invalid');
  const { data, error } = await supabase.rpc('save_website_layout_draft', { p_config: config });
  if (error) throw new Error(error.code === '42501' ? 'website_admin_forbidden' : 'website_draft_save_failed');
  return data as { id: string; version: number };
}

export async function publishWebsiteLayoutDraft(versionId: string) {
  if (!supabase) throw new Error('supabase_unconfigured');
  const { data, error } = await supabase.rpc('publish_website_layout', { p_version_id: versionId });
  if (error) throw new Error(error.code === '42501' ? 'website_admin_forbidden' : 'website_publish_failed');
  return data as { id: string; version: number };
}

export async function restoreWebsiteLayout(versionId: string) {
  if (!supabase) throw new Error('supabase_unconfigured');
  const { data, error } = await supabase.rpc('restore_website_layout', { p_version_id: versionId });
  if (error) throw new Error(error.code === '42501' ? 'website_admin_forbidden' : 'website_restore_failed');
  return data as { id: string; version: number; restoredFrom: string };
}

export async function uploadWebsiteLayoutAsset(file: File, altText: string) {
  if (!supabase) throw new Error('supabase_unconfigured');
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
  if (!allowedTypes.has(file.type) || file.size > 20 * 1024 * 1024) throw new Error('website_asset_invalid');
  const id = crypto.randomUUID();
  const safeName = file.name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(-100) || 'image';
  const storagePath = `${id}/${safeName}`;
  const { error: rowError } = await supabase.from('website_layout_assets').insert({ id, storage_path: storagePath, alt_text: altText.trim() });
  if (rowError) throw new Error(rowError.code === '42501' ? 'website_admin_forbidden' : 'website_asset_record_failed');
  const { error: uploadError } = await supabase.storage.from(WEBSITE_ASSET_BUCKET).upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) {
    await supabase.rpc('discard_unuploaded_website_layout_asset', { p_asset_id: id });
    throw new Error('website_asset_upload_failed');
  }
  const { data: signed, error: signedError } = await supabase.storage.from(WEBSITE_ASSET_BUCKET).createSignedUrl(storagePath, 600);
  if (signedError || !signed.signedUrl) throw new Error('website_asset_preview_failed');
  return { id, storage_path: storagePath, alt_text: altText.trim(), is_published: false, created_at: new Date().toISOString(), previewUrl: signed.signedUrl } satisfies WebsiteLayoutAsset;
}
