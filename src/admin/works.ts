/**
 * Simple "works" operations for the Projects page: add images as new works, add images to a
 * project's gallery, show/hide, reorder. Every new work is visible on the site immediately;
 * there is no separate draft step. Uploads use the same bucket and paths as the full editor.
 */
import { supabase } from '../lib/supabase';
import { isThumbnailPath, thumbnailPath, uploadThumbnail } from '../lib/imageThumbnail';
import type { AdminCategoryRow, AdminProjectRow } from './types';

const BUCKET = 'portfolio-images';
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif',
};
const ALLOWED_MIME = new Set(Object.values(MIME_BY_EXTENSION));

export type GalleryImage = { id: string; path: string; url: string; order: number };

function client() {
  if (!supabase) throw new Error('not_configured');
  return supabase;
}

export function imageMimeType(file: File) {
  if (ALLOWED_MIME.has(file.type)) return file.type;
  return MIME_BY_EXTENSION[file.name.split('.').pop()?.toLowerCase() ?? ''] ?? '';
}

/** Splits a picked/dropped file list into usable images and the names of rejected files. */
export function splitImageFiles(files: Iterable<File>) {
  const accepted: File[] = [];
  const rejected: string[] = [];
  for (const file of files) {
    if (imageMimeType(file) && file.size <= MAX_IMAGE_BYTES) accepted.push(file);
    else rejected.push(file.name);
  }
  return { accepted, rejected };
}

function safeFilename(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? 'img';
  const base = file.name.slice(0, Math.max(0, file.name.lastIndexOf('.')))
    .normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  return `${crypto.randomUUID()}-${base || 'image'}.${extension}`;
}

async function uploadImage(projectId: string, file: File) {
  const path = `${projectId}/${safeFilename(file)}`;
  const { error } = await client().storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600', contentType: imageMimeType(file), upsert: false,
  });
  if (error) throw error;
  // A light copy for the site's small views (if it fails, the site shows the original).
  await uploadThumbnail(client(), BUCKET, path, file);
  return path;
}

export type ThumbnailReport = { total: number; made: number; failed: number; existing: number };

/**
 * Makes light copies for every stored work image (main images and galleries, hidden works too)
 * that doesn't have one yet. Originals are only read, never changed. Three at a time.
 */
export async function createMissingThumbnails(onProgress?: (done: number, total: number) => void): Promise<ThumbnailReport> {
  const db = client();
  const [projects, gallery] = await Promise.all([
    db.from('portfolio_projects').select('cover_image_path').is('deleted_at', null).not('cover_image_path', 'is', null),
    db.from('portfolio_gallery_images').select('image_path'),
  ]);
  if (projects.error) throw projects.error;
  if (gallery.error) throw gallery.error;
  const paths = [...new Set([
    ...((projects.data ?? []) as { cover_image_path: string }[]).map((row) => row.cover_image_path),
    ...((gallery.data ?? []) as { image_path: string }[]).map((row) => row.image_path),
  ])].filter((path) => path && !isThumbnailPath(path));

  // Which ones already have a light copy (a signed link can only be made for an existing file).
  const existing = new Set<string>();
  for (let start = 0; start < paths.length; start += 100) {
    const batch = paths.slice(start, start + 100);
    const { data } = await db.storage.from(BUCKET).createSignedUrls(batch.map(thumbnailPath), 60);
    (data ?? []).forEach((item, index) => { if (item.signedUrl) existing.add(batch[index]); });
  }
  const missing = paths.filter((path) => !existing.has(path));

  let done = 0;
  let made = 0;
  let failed = 0;
  onProgress?.(0, missing.length);
  const queue = [...missing];
  const worker = async () => {
    for (let path = queue.shift(); path; path = queue.shift()) {
      const { data: file, error } = await db.storage.from(BUCKET).download(path);
      if (!error && file && await uploadThumbnail(db, BUCKET, path, file)) made += 1;
      else failed += 1;
      done += 1;
      onProgress?.(done, missing.length);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return { total: paths.length, made, failed, existing: existing.size };
}

/** Works of one category in site order (the order the public catalog uses). */
export function worksInCategory(projects: AdminProjectRow[], categoryId: string) {
  return projects
    .filter((project) => project.category_id === categoryId && project.deleted_at === null)
    .sort((a, b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at));
}

/** Writes display_order 0..n-1 for the given works, only touching rows whose order changes. */
export async function saveWorkOrder(ordered: AdminProjectRow[]) {
  const changes = ordered.flatMap((project, index) => project.display_order === index ? [] : [{ id: project.id, order: index }]);
  for (let start = 0; start < changes.length; start += 6) {
    const results = await Promise.all(changes.slice(start, start + 6).map(({ id, order }) =>
      client().from('portfolio_projects').update({ display_order: order }).eq('id', id)));
    const failed = results.find((result) => result.error);
    if (failed?.error) throw failed.error;
  }
  return changes.length;
}

/**
 * Creates one visible work. With one file it is a single image; with more, the first file is
 * the main image and the rest form its gallery. Placed first in the category.
 */
export async function createWork(options: {
  category: AdminCategoryRow;
  files: File[];
  title: string;
  existing: AdminProjectRow[];
  onProgress?: (done: number) => void;
}) {
  if (!options.files.length) throw new Error('no_files');
  const isGallery = options.files.length > 1;
  const id = crypto.randomUUID();
  const db = client();
  const { error: insertError } = await db.from('portfolio_projects').insert({
    id,
    slug: `project-${id.replaceAll('-', '').slice(0, 12)}`,
    title: options.title,
    description: '',
    category_id: options.category.id,
    presentation_type: isGallery ? 'project' : 'image',
    tags: [], tools: [], year: null,
    cover_image_path: null,
    display_order: 0,
    is_published: false,
    is_featured: false,
  });
  if (insertError) throw insertError;

  try {
    const paths = [];
    for (const file of options.files) {
      paths.push(await uploadImage(id, file));
      options.onProgress?.(paths.length);
    }
    // A multi-image work opens as a project page, which shows its gallery, so the main image
    // is part of the gallery too (as in the existing projects).
    if (isGallery) await insertGalleryRows(id, paths, 0, options.title);
    const { error } = await db.from('portfolio_projects')
      .update({ cover_image_path: paths[0], is_published: true })
      .eq('id', id);
    if (error) throw error;
  } catch (failure) {
    // Don't leave a half-made, invisible row behind.
    await db.from('portfolio_projects').delete().eq('id', id);
    throw failure;
  }

  // New work first, everything else keeps its relative order behind it.
  await saveWorkOrder([{ id, display_order: 0 } as AdminProjectRow, ...options.existing]).catch(() => 0);
  return id;
}

async function insertGalleryRows(projectId: string, paths: string[], startOrder: number, altText: string) {
  if (!paths.length) return;
  const { error } = await client().from('portfolio_gallery_images').insert(paths.map((path, index) => ({
    project_id: projectId, image_path: path, alt_text: altText, caption: '', display_order: startOrder + index,
  })));
  if (error) throw error;
}

/** Uploads images into an existing project's gallery, after the images it already has. */
export async function addGalleryImages(projectId: string, files: File[], startOrder: number, altText: string, onProgress?: (done: number) => void) {
  const paths = [];
  for (const file of files) {
    paths.push(await uploadImage(projectId, file));
    onProgress?.(paths.length);
  }
  await insertGalleryRows(projectId, paths, startOrder, altText);
}

export async function loadGallery(projectId: string): Promise<GalleryImage[]> {
  const { data, error } = await client().from('portfolio_gallery_images')
    .select('id, image_path, display_order')
    .eq('project_id', projectId)
    .order('display_order', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as { id: string; image_path: string; display_order: number }[];
  if (!rows.length) return [];
  const { data: signed, error: signedError } = await client().storage.from(BUCKET)
    .createSignedUrls(rows.map((row) => row.image_path), 3600);
  if (signedError) throw signedError;
  const urlByPath = new Map((signed ?? []).filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl as string]));
  return rows.map((row) => ({ id: row.id, path: row.image_path, url: urlByPath.get(row.image_path) ?? '', order: row.display_order }));
}

export async function saveGalleryOrder(images: GalleryImage[]) {
  const changes = images.flatMap((image, index) => image.order === index ? [] : [{ id: image.id, order: index }]);
  for (const change of changes) {
    const { error } = await client().from('portfolio_gallery_images').update({ display_order: change.order }).eq('id', change.id);
    if (error) throw error;
  }
}

/** Removes the image from the gallery; the stored file is kept, like everywhere else in the admin. */
export async function removeGalleryImage(imageId: string) {
  const { error } = await client().from('portfolio_gallery_images').delete().eq('id', imageId);
  if (error) throw error;
}

export async function setMainImage(projectId: string, path: string) {
  const { error } = await client().from('portfolio_projects').update({ cover_image_path: path }).eq('id', projectId);
  if (error) throw error;
}

export async function setWorkVisible(projectId: string, visible: boolean) {
  const { error } = await client().from('portfolio_projects').update({ is_published: visible }).eq('id', projectId);
  if (error) throw error;
}

export async function renameWork(projectId: string, title: string) {
  const { error } = await client().from('portfolio_projects').update({ title }).eq('id', projectId);
  if (error) throw error;
}

export type PickableWork = { id: string; title: string; url: string; categoryName: string };

/** Visible works with their main image, for choosing what appears in the hero strip. */
export async function loadPickableWorks(): Promise<PickableWork[]> {
  const db = client();
  const [projectResult, categoryResult] = await Promise.all([
    db.from('portfolio_projects').select('id, title, cover_image_path, category_id, display_order')
      .is('deleted_at', null).eq('is_published', true).not('cover_image_path', 'is', null)
      .order('display_order', { ascending: true }),
    db.from('portfolio_categories').select('id, name'),
  ]);
  if (projectResult.error) throw projectResult.error;
  const rows = (projectResult.data ?? []) as { id: string; title: string; cover_image_path: string; category_id: string }[];
  const names = new Map(((categoryResult.data ?? []) as { id: string; name: string }[]).map((row) => [row.id, row.name]));
  if (!rows.length) return [];
  const { data: signed, error } = await db.storage.from(BUCKET).createSignedUrls(rows.map((row) => row.cover_image_path), 3600);
  if (error) throw error;
  const urlByPath = new Map((signed ?? []).filter((item) => item.signedUrl).map((item) => [item.path, item.signedUrl as string]));
  return rows.flatMap((row) => {
    const url = urlByPath.get(row.cover_image_path);
    return url ? [{ id: row.id, title: row.title, url, categoryName: names.get(row.category_id) ?? '' }] : [];
  });
}

/** Uploads one image as a new visible work in Product Posters (first in order); returns its id. */
export async function uploadPosterWork(file: File) {
  const db = client();
  const { data: category, error } = await db.from('portfolio_categories')
    .select('id, slug, name, description, display_order, is_active').eq('slug', 'product-posters').maybeSingle();
  if (error || !category) throw error ?? new Error('category_missing');
  const { data: existing } = await db.from('portfolio_projects')
    .select('id, display_order, created_at').eq('category_id', category.id).is('deleted_at', null)
    .order('display_order', { ascending: true });
  const works = (existing ?? []) as AdminProjectRow[];
  return createWork({ category: category as AdminCategoryRow, files: [file], title: nextWorkTitle(category.name, works), existing: works });
}

/** "Product Posters 28" — a neutral name so nobody has to invent titles for every image. */
export function nextWorkTitle(categoryName: string, works: AdminProjectRow[]) {
  return `${categoryName} ${works.length + 1}`;
}
