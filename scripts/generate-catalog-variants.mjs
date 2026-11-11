/**
 * Writes resized WebP copies of the catalog's tile images so grid tiles can
 * download an image close to their display size instead of the full source file.
 *
 * The originals in src/assets/catalog/ are only read, never modified:
 * scripts/migrate-portfolio.mjs verifies their exact count, names and hashes.
 * Variants go to src/assets/catalog-variants/ (gitignored) as
 * `<original relative path>.<width>x<height>.webp`, which is the naming
 * src/data/catalogImages.ts relies on to pair each variant with its source.
 *
 * Runs automatically from the Vite config on build and dev-server start; it can
 * also be run on its own: `node scripts/generate-catalog-variants.mjs`.
 * Unchanged sources are skipped based on their SHA-256 hash.
 */

import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

export const catalogDirectory = join(root, 'src', 'assets', 'catalog');
export const variantsDirectory = join(root, 'src', 'assets', 'catalog-variants');

/** Target widths; a source narrower than a target gets one variant at its own width instead. */
export const variantWidths = [320, 640, 960, 1280, 1920];

const webpOptions = { quality: 80, effort: 4 };
const sourceExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const manifestName = '.manifest.json';
// Changing the widths or encoder settings invalidates every cached variant.
const settingsKey = JSON.stringify({ version: 1, variantWidths, webpOptions });

const toPosix = (path) => path.split(sep).join('/');

// Only images shown as grid tiles need variants: files directly inside a category
// folder and project covers (`<category>/<project>/cover.*`). Project galleries and
// the lightbox keep using the originals.
const isTileImage = (source) => {
  const parts = source.split('/');
  return parts.length === 2 || (parts.length === 3 && /^cover\.[^.]+$/i.test(parts[2]));
};

async function listFiles(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listFiles(path);
    return entry.isFile() ? [path] : [];
  }));
  return nested.flat();
}

async function readManifest() {
  try {
    const manifest = JSON.parse(await readFile(join(variantsDirectory, manifestName), 'utf8'));
    return manifest?.settingsKey === settingsKey && manifest.sources ? manifest.sources : {};
  } catch {
    return {};
  }
}

async function allExist(directory, filenames) {
  const results = await Promise.all(filenames.map((filename) => (
    stat(join(directory, filename)).then((info) => info.isFile() && info.size > 0, () => false)
  )));
  return results.every(Boolean);
}

async function createVariants(sharp, source, bytes) {
  const metadata = await sharp(bytes).metadata();
  // EXIF orientations 5-8 swap the displayed width and height.
  const sourceWidth = (metadata.orientation ?? 1) >= 5 ? metadata.height : metadata.width;
  if (!sourceWidth) throw new Error(`Could not read the dimensions of ${source}`);

  const widths = [...new Set(variantWidths.map((width) => Math.min(width, sourceWidth)))];
  const outputs = [];
  for (const width of widths) {
    const { data, info } = await sharp(bytes)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp(webpOptions)
      .toBuffer({ resolveWithObject: true });
    const filename = `${source}.${info.width}x${info.height}.webp`;
    await mkdir(dirname(join(variantsDirectory, filename)), { recursive: true });
    await writeFile(join(variantsDirectory, filename), data);
    outputs.push(filename);
  }
  return outputs;
}

async function runWithConcurrency(items, limit, task) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await task(item);
    }
  });
  await Promise.all(workers);
}

export async function generateCatalogVariants() {
  const { default: sharp } = await import('sharp');
  const sources = (await listFiles(catalogDirectory))
    .filter((path) => sourceExtensions.has(extname(path).toLowerCase()))
    .map((path) => toPosix(relative(catalogDirectory, path)))
    .filter(isTileImage)
    .sort();
  const previous = await readManifest();
  const next = {};
  let generated = 0;

  await runWithConcurrency(sources, Math.max(1, Math.min(4, availableParallelism())), async (source) => {
    const bytes = await readFile(join(catalogDirectory, source));
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const cached = previous[source];

    if (cached?.sha256 === sha256 && await allExist(variantsDirectory, cached.variants)) {
      next[source] = cached;
      return;
    }

    next[source] = { sha256, variants: await createVariants(sharp, source, bytes) };
    generated += 1;
  });

  const expected = new Set(Object.values(next).flatMap((entry) => entry.variants));
  const stale = (await listFiles(variantsDirectory))
    .map((path) => toPosix(relative(variantsDirectory, path)))
    .filter((filename) => filename !== manifestName && !expected.has(filename));
  await Promise.all(stale.map((filename) => rm(join(variantsDirectory, filename), { force: true })));

  const sortedSources = Object.fromEntries(Object.entries(next).sort(([first], [second]) => first.localeCompare(second)));
  await mkdir(variantsDirectory, { recursive: true });
  await writeFile(
    join(variantsDirectory, manifestName),
    `${JSON.stringify({ settingsKey, sources: sortedSources }, null, 2)}\n`
  );

  return {
    sources: sources.length,
    generated,
    reused: sources.length - generated,
    variants: expected.size,
    removed: stale.length,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const startedAt = Date.now();
  const result = await generateCatalogVariants();
  console.log(
    `Catalog image variants: ${result.generated} generated, ${result.reused} unchanged, `
    + `${result.removed} stale removed (${result.variants} files, ${((Date.now() - startedAt) / 1000).toFixed(1)}s).`
  );
}
