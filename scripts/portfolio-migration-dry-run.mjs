import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const catalogRoot = join(root, 'src', 'assets', 'catalog');
const localOnly = process.argv.includes('--local-only');
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

function loadLocalEnvironment() {
  for (const filename of ['.env.local', '.env']) {
    let content;
    try {
      content = readFileSync(join(root, filename), 'utf8');
    } catch {
      continue;
    }

    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || process.env[match[1]]) continue;
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  }
}

async function listImages(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listImages(path);
    if (!entry.isFile() || !allowedExtensions.has(extname(entry.name).toLowerCase())) return [];
    return [path];
  }));
  return nested.flat();
}

function getLeadingNumber(filename) {
  const match = filename.match(/^\s*(\d+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

function compareFilenames(first, second) {
  const firstNumber = getLeadingNumber(first);
  const secondNumber = getLeadingNumber(second);
  return firstNumber === secondNumber ? collator.compare(first, second) : firstNumber - secondNumber;
}

function getSourceKey(category, filename) {
  const label = filename
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'image';
  const hash = Array.from(`${category}/${filename}`).reduce(
    (value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0,
    0,
  ).toString(36);
  return `${category}-${label}-${hash}`;
}

function titleFromFilename(filename) {
  return filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || filename;
}

async function inspectAsset(path, order) {
  const bytes = await readFile(path);
  return {
    path: relative(root, path).split(sep).join('/'),
    bytes: bytes.byteLength,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    order,
  };
}

async function inspectLocalCatalog() {
  const allPaths = (await listImages(catalogRoot)).sort((a, b) => collator.compare(a, b));
  const groups = new Map();

  for (const path of allPaths) {
    const rel = relative(catalogRoot, path).split(sep).join('/');
    const [folder, ...parts] = rel.split('/');
    const filename = parts.join('/');
    const entries = groups.get(folder) ?? [];
    entries.push({ path, filename });
    groups.set(folder, entries);
  }

  const categoryFolders = ['product-posters', 'branding-identity', 'billboards-print'];
  const records = [];
  for (const folder of categoryFolders) {
    const files = groups.get(folder) ?? [];
    if (folder === 'branding-identity') {
      for (const projectFolder of [...new Set(files.map(({ filename }) => filename.split('/')[0]))].sort(collator.compare)) {
        const projectFiles = files
          .filter(({ filename }) => filename.startsWith(`${projectFolder}/`))
          .map(({ path, filename }) => ({ path, filename: filename.slice(projectFolder.length + 1) }));
        const manifestPath = join(catalogRoot, folder, projectFolder, 'project.json');
        const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
        const cover = projectFiles.find(({ filename }) => /^cover\.[^.]+$/i.test(filename));
        const gallery = projectFiles
          .filter(({ filename }) => !/^cover\.[^.]+$/i.test(filename))
          .sort((a, b) => compareFilenames(a.filename, b.filename));
        records.push({
          sourceKey: `${manifest.id}-cover`,
          slug: manifest.slug,
          title: manifest.title,
          categorySlug: 'branding',
          presentationType: 'project',
          displayOrder: 0,
          cover: cover ? await inspectAsset(cover.path, 0) : null,
          gallery: await Promise.all(gallery.map(({ path }, index) => inspectAsset(path, index))),
          metadata: {
            description: manifest.description ?? '',
            tags: manifest.tags ?? [],
            tools: manifest.tools ?? [],
            year: manifest.publishedDate ? Number(String(manifest.publishedDate).slice(0, 4)) : null,
            publishedDate: manifest.publishedDate ?? null,
            serviceType: 'Branding & Identity',
            industry: 'Brand Identity',
            author: manifest.author?.name ?? null,
            location: manifest.author?.location ?? null,
            sourceMetadata: manifest,
          },
        });
      }
      continue;
    }

    const ordered = files
      .filter(({ filename }) => !filename.includes('/'))
      .sort((a, b) => compareFilenames(a.filename, b.filename));
    const categorySlug = folder;
    const categoryLabel = folder === 'product-posters' ? 'Product Posters' : 'Billboards & Print';
    records.push(...await Promise.all(ordered.map(async ({ path, filename }, index) => ({
      sourceKey: getSourceKey(categorySlug, filename),
      slug: getSourceKey(categorySlug, filename).replace(/[^a-z0-9-]/g, '-'),
      title: titleFromFilename(filename),
      categorySlug,
      presentationType: 'image',
      displayOrder: index,
      cover: await inspectAsset(path, 0),
      gallery: [],
      metadata: {
        description: '',
        tags: [],
        tools: [],
        year: null,
        serviceType: categoryLabel,
        industry: categoryLabel,
        sourceMetadata: { sourceFilename: filename },
      },
    }))));
  }

  return records;
}

async function inspectRemotePublicRows() {
  loadLocalEnvironment();
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { status: 'not-configured', note: 'Supabase environment variables are missing.' };

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const [categories, projects, gallery] = await Promise.all([
    client.from('portfolio_categories').select('id, slug, name, is_active').order('display_order'),
    client.from('portfolio_projects')
      .select('id, source_key, slug, category_id, presentation_type, display_order, is_published, cover_image_path')
      .order('display_order'),
    client.from('portfolio_gallery_images').select('id, project_id, image_path, display_order').order('display_order'),
  ]);
  const errors = [categories.error, projects.error, gallery.error].filter(Boolean);
  if (errors.length) {
    return { status: 'request-failed', errorCodes: errors.map((error) => error.code ?? 'UNKNOWN') };
  }

  const galleryCounts = new Map();
  for (const image of gallery.data ?? []) galleryCounts.set(image.project_id, (galleryCounts.get(image.project_id) ?? 0) + 1);
  return {
    status: 'read-only-public-scope',
    note: 'RLS limits this publishable-key inventory to active categories and published records; drafts, including any existing draft, are intentionally not observable here.',
    categories: (categories.data ?? []).map(({ id, slug, name }) => ({ id, slug, name })),
    visibleProjects: (projects.data ?? []).map((project) => ({
      id: project.id,
      sourceKey: project.source_key,
      slug: project.slug,
      categoryId: project.category_id,
      presentationType: project.presentation_type,
      displayOrder: project.display_order,
      isPublished: project.is_published,
      galleryCount: galleryCounts.get(project.id) ?? 0,
      hasCover: Boolean(project.cover_image_path),
    })),
    visibleGalleryRows: (gallery.data ?? []).length,
  };
}

const records = await inspectLocalCatalog();
const remote = localOnly
  ? { status: 'skipped-local-only', note: 'Remote checks are performed later through the verified administrator session.' }
  : await inspectRemotePublicRows();
const localKeyCounts = new Map();
const localSlugCounts = new Map();
for (const record of records) {
  localKeyCounts.set(record.sourceKey, (localKeyCounts.get(record.sourceKey) ?? 0) + 1);
  localSlugCounts.set(record.slug, (localSlugCounts.get(record.slug) ?? 0) + 1);
}
const remoteProjects = remote.status === 'read-only-public-scope' ? remote.visibleProjects : [];
const remoteKeys = new Set(remoteProjects.flatMap((project) => project.sourceKey ? [project.sourceKey] : []));
const remoteBySlug = new Map(remoteProjects.map((project) => [project.slug, project.sourceKey]));
const preflight = {
  duplicateLocalSourceKeys: [...localKeyCounts].filter(([, count]) => count > 1).map(([key]) => key),
  duplicateLocalSlugs: [...localSlugCounts].filter(([, count]) => count > 1).map(([slug]) => slug),
  visibleRemoteSourceKeyMatches: records.filter((record) => remoteKeys.has(record.sourceKey)).map((record) => record.sourceKey),
  visibleRemoteSlugConflicts: records.filter((record) => remoteBySlug.has(record.slug) && remoteBySlug.get(record.slug) !== record.sourceKey).map((record) => record.slug),
  matchingSourceKeySlugMismatches: records.filter((record) => remoteKeys.has(record.sourceKey) && remoteBySlug.get(record.slug) !== record.sourceKey).map((record) => record.sourceKey),
  fullRemoteCheckRequired: remote.status !== 'read-only-public-scope' || remote.note?.includes('drafts') === true,
  noRowsWillBeInserted: true,
};
const categorySummary = records.reduce((summary, record) => {
  const category = summary[record.categorySlug] ?? { cardCount: 0, galleryImageCount: 0 };
  category.cardCount += 1;
  category.galleryImageCount += record.gallery.length;
  summary[record.categorySlug] = category;
  return summary;
}, {});
const result = {
  generatedAt: new Date().toISOString(),
  mode: 'dry-run; no Supabase writes or Storage uploads are performed',
  local: {
    cardCount: records.length,
    galleryImageCount: records.reduce((sum, record) => sum + record.gallery.length, 0),
    fileCount: records.reduce((sum, record) => sum + (record.cover ? 1 : 0) + record.gallery.length, 0),
    categories: categorySummary,
    records,
  },
  remote,
  preflight,
  migrationSafety: {
    preserveExistingDrafts: true,
    updateOrDeleteExistingRows: false,
    deduplicationKey: 'portfolio_projects.source_key',
    conflictRule: 'Stop if a source_key or slug already exists; do not overwrite an existing draft or infer identity from title alone.',
  },
};

if (process.argv.includes('--json')) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  const summary = {
    generatedAt: result.generatedAt,
    mode: result.mode,
    local: {
      cardCount: result.local.cardCount,
      galleryImageCount: result.local.galleryImageCount,
      fileCount: result.local.fileCount,
      categories: result.local.categories,
      records: records.map(({ sourceKey, slug, title, categorySlug, presentationType, displayOrder, cover, gallery, metadata }) => ({
        sourceKey, slug, title, categorySlug, presentationType, displayOrder,
        cover: cover && { path: cover.path, bytes: cover.bytes, sha256: cover.sha256 },
        gallery: gallery.map(({ path, bytes, sha256, order }) => ({ path, bytes, sha256, order })),
        metadata,
      })),
    },
    remote,
    preflight,
    migrationSafety: result.migrationSafety,
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}
