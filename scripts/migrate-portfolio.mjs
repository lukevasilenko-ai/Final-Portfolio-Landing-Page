import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline/promises';
import { StringDecoder } from 'node:string_decoder';
import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dryRunScript = join(root, 'scripts', 'portfolio-migration-dry-run.mjs');
const migrationNamespace = '49d7d99d-17f7-5c3d-9876-f1dce21718c6';
const bucketName = 'portfolio-images';
const pageSize = 500;
const applyRequested = process.argv.includes('--apply');
const publishRequested = process.argv.includes('--publish');

function parseEnvFile(filename, acceptedNames) {
  let content;
  try {
    content = readFileSync(join(root, filename), 'utf8');
  } catch {
    return {};
  }

  const result = {};
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || !acceptedNames.has(match[1])) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

function readConfiguration() {
  const publicNames = new Set(['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']);
  const localPublic = parseEnvFile('.env.local', publicNames);
  const rootPublic = parseEnvFile('.env', publicNames);
  return {
    url: process.env.VITE_SUPABASE_URL || localPublic.VITE_SUPABASE_URL || rootPublic.VITE_SUPABASE_URL,
    publishableKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY
      || localPublic.VITE_SUPABASE_PUBLISHABLE_KEY
      || rootPublic.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

function tokenPayload(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function isPrivilegedCredential(value) {
  if (!value) return false;
  if (value.startsWith('sb_secret_')) return true;
  return tokenPayload(value)?.role === 'service_role';
}

function makeUuidV5(name) {
  const namespace = Buffer.from(migrationNamespace.replaceAll('-', ''), 'hex');
  const digest = createHash('sha1').update(namespace).update(name, 'utf8').digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function stableImageKey(category, filename) {
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

function getInventory() {
  const child = spawnSync(process.execPath, [dryRunScript, '--json', '--local-only'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 12 * 1024 * 1024,
  });
  if (child.status !== 0) throw new Error('Local inventory failed. No database or Storage writes were attempted.');
  try {
    return JSON.parse(child.stdout);
  } catch {
    throw new Error('Local inventory output could not be parsed. No database or Storage writes were attempted.');
  }
}

function makeExpectedRecords(inventory) {
  return inventory.local.records.map((record) => {
    const projectId = makeUuidV5(`portfolio-project:${record.sourceKey}`);
    const coverPath = record.cover ? `${projectId}/${basename(record.cover.path)}` : null;
    const gallery = record.gallery.map((asset) => {
      const filename = basename(asset.path);
      const relativeFilename = record.categorySlug === 'branding'
        ? `focus/${filename}`
        : filename;
      return {
        sourceKey: stableImageKey(record.categorySlug, relativeFilename),
        id: makeUuidV5(`portfolio-gallery:${record.sourceKey}:${relativeFilename}`),
        projectId,
        imagePath: `${projectId}/${filename}`,
        altText: record.categorySlug === 'branding'
          ? `${record.title} · ${filename.replace(/\.[^.]+$/, '')}`
          : record.title,
        caption: record.categorySlug === 'branding' ? record.title : '',
        displayOrder: asset.order,
        asset,
      };
    });

    const metadata = record.metadata ?? {};
    const sourceMetadata = { ...(metadata.sourceMetadata ?? {}) };
    sourceMetadata._lukaMigrationIntegrity = {
      version: 1,
      cover: record.cover ? {
        path: record.cover.path,
        bytes: record.cover.bytes,
        sha256: record.cover.sha256,
      } : null,
      gallery: gallery.map(({ asset, displayOrder }) => ({
        path: asset.path,
        bytes: asset.bytes,
        sha256: asset.sha256,
        displayOrder,
      })),
    };
    return {
      ...record,
      id: projectId,
      coverPath,
      gallery,
      projectRow: {
        id: projectId,
        source_key: record.sourceKey,
        slug: record.slug,
        title: record.title,
        description: metadata.description ?? '',
        category_id: null,
        presentation_type: record.presentationType,
        cover_image_path: coverPath,
        display_order: record.displayOrder,
        is_published: false,
        is_featured: false,
        tags: metadata.tags ?? [],
        tools: metadata.tools ?? [],
        year: metadata.year ?? null,
        published_date: metadata.publishedDate ?? null,
        client: metadata.client ?? null,
        service_type: metadata.serviceType ?? null,
        industry: metadata.industry ?? null,
        author: metadata.author ?? null,
        location: metadata.location ?? null,
        source_metadata: sourceMetadata,
      },
    };
  });
}

function verifyLocalBaseline(inventory, records) {
  const issues = [];
  const counts = inventory.local.categories;
  if (inventory.local.cardCount !== 29) issues.push(`Expected 29 source cards; found ${inventory.local.cardCount}.`);
  if (inventory.local.fileCount !== 63) issues.push(`Expected 63 source image files; found ${inventory.local.fileCount}.`);
  if (counts['product-posters']?.cardCount !== 27) issues.push('Product Posters baseline is not 27 cards.');
  if (counts.branding?.cardCount !== 1 || counts.branding?.galleryImageCount !== 34) {
    issues.push('Focus baseline is not one project with 34 gallery images.');
  }
  if (counts['billboards-print']?.cardCount !== 1) issues.push('Billboards & Print baseline is not one card.');

  const focus = records.find((record) => record.sourceKey === 'behance-246573009-cover');
  const focusNames = focus?.gallery.map(({ asset }) => basename(asset.path));
  if (!focus?.cover || basename(focus.cover.path).toLowerCase() !== 'cover.webp') {
    issues.push('Focus cover.webp is missing from the source inventory.');
  }
  if (!focusNames || focusNames.length !== 34
      || focusNames.some((name, index) => name !== `${String(index + 1).padStart(2, '0')}.webp`)) {
    issues.push('Focus gallery is not the exact 01.webp through 34.webp sequence.');
  }
  return issues;
}

function getSanitizedErrorCode(error) {
  const code = String(error?.code ?? error?.status ?? error?.statusCode ?? 'REQUEST_FAILED');
  return /^[a-z0-9_:-]{1,64}$/i.test(code) ? code : 'REQUEST_FAILED';
}

async function getAllRows(client, table, columns) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from(table).select(columns).range(offset, offset + pageSize - 1);
    if (error) throw Object.assign(new Error('Read-only administrator inventory request failed.'), { code: getSanitizedErrorCode(error) });
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

async function promptForEmail() {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await terminal.question('Administrator email: ')).trim();
  } finally {
    terminal.close();
  }
}

function promptForHiddenPassword() {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== 'function') {
    throw Object.assign(new Error('interactive-terminal-required'), { code: 'INTERACTIVE_TERMINAL_REQUIRED' });
  }

  const oldRawMode = Boolean(input.isRaw);
  // Raw byte handling avoids PowerShell-host differences in readline keypress events.
  const decoder = new StringDecoder('utf8');
  input.setRawMode(true);
  return new Promise((resolvePassword, rejectPassword) => {
    let password = '';
    let escapeState = 0;
    let complete = false;
    const cleanup = () => {
      if (complete) return false;
      complete = true;
      input.off('data', onData);
      process.off('SIGINT', onInterrupt);
      try {
        input.setRawMode(oldRawMode);
      } catch {
        // The terminal may already be closing; never let cleanup expose input.
      }
      input.pause();
      process.stdout.write('\n');
      return true;
    };
    const cancel = () => {
      if (!cleanup()) return;
      password = '';
      rejectPassword(Object.assign(new Error('login-cancelled'), { code: 'LOGIN_CANCELLED' }));
    };
    const submit = () => {
      if (!cleanup()) return;
      const submittedPassword = password;
      password = '';
      resolvePassword(submittedPassword);
    };
    const onInterrupt = () => cancel();
    const onData = (chunk) => {
      const text = decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      for (const character of text) {
        if (escapeState === 1) {
          escapeState = character === '[' ? 2 : character === ']' ? 3 : 0;
          continue;
        }
        if (escapeState === 2) {
          if (character >= '@' && character <= '~') escapeState = 0;
          continue;
        }
        if (escapeState === 3) {
          if (character === '\u0007') escapeState = 0;
          else if (character === '\u001b') escapeState = 4;
          continue;
        }
        if (escapeState === 4) {
          escapeState = character === '\\' ? 0 : 3;
          continue;
        }
        if (character === '\u001b') {
          escapeState = 1;
          continue;
        }
        if (character === '\r' || character === '\n') {
          submit();
          break;
        }
        if (character === '\u0003' || character === '\u0004') {
          cancel();
          break;
        }
        if (character === '\b' || character === '\u007f') {
          password = Array.from(password).slice(0, -1).join('');
          continue;
        }
        if (character.codePointAt(0) >= 0x20 && character.codePointAt(0) !== 0x7f) {
          password += character;
        }
      }
    };

    process.on('SIGINT', onInterrupt);
    input.on('data', onData);
    process.stdout.write('Administrator password (input hidden): ');
    input.resume();
  });
}

async function confirmApply(phrase, description) {
  if (!process.stdin.isTTY) return { confirmed: false, unavailable: true };
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: Boolean(process.stdout.isTTY),
  });
  try {
    const response = await terminal.question(`\n${description}\nType "${phrase}" to confirm: `);
    return { confirmed: response.trim() === phrase, unavailable: false };
  } finally {
    terminal.close();
  }
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

const comparableProjectFields = [
  'id', 'source_key', 'slug', 'title', 'description', 'category_id', 'presentation_type',
  'cover_image_path', 'display_order', 'is_published', 'is_featured', 'tags', 'tools',
  'year', 'published_date', 'client', 'service_type', 'industry', 'author', 'location', 'source_metadata',
];

function projectMatches(existing, expected) {
  return comparableProjectFields.every((field) => stableJson(existing[field] ?? null) === stableJson(expected[field] ?? null));
}

function galleryMatches(existing, expected) {
  return existing.id === expected.id
    && existing.source_key === expected.sourceKey
    && existing.project_id === expected.projectId
    && existing.image_path === expected.imagePath
    && existing.alt_text === expected.altText
    && existing.caption === expected.caption
    && existing.display_order === expected.displayOrder;
}

async function signInAuthorizedAdmin(config) {
  if (!process.stdin.isTTY || !process.stdout.isTTY || typeof process.stdin.setRawMode !== 'function') {
    return {
      status: 'interactive-terminal-required',
      note: 'Run this command directly in an interactive Windows PowerShell terminal.',
      canApply: false,
    };
  }

  const client = createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  let email = '';
  let password = '';
  try {
    email = await promptForEmail();
    if (!email) return { status: 'login-cancelled', note: 'An administrator email is required.', canApply: false };
    password = await promptForHiddenPassword();
    if (!password) return { status: 'login-cancelled', note: 'An administrator password is required.', canApply: false };

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    password = '';
    if (error || !data.session || !data.user) {
      return {
        status: 'login-failed',
        errorCode: error ? getSanitizedErrorCode(error) : 'SESSION_NOT_RETURNED',
        note: 'Supabase Auth did not return a valid administrator session. Credentials were not logged.',
        canApply: false,
      };
    }

    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError || !sessionData.session || sessionData.session.user.id !== data.user.id) {
      return {
        status: 'session-verification-failed',
        errorCode: sessionError ? getSanitizedErrorCode(sessionError) : 'SESSION_MISMATCH',
        note: 'The in-memory Supabase session could not be verified.',
        canApply: false,
      };
    }

    const { data: adminRow, error: adminError } = await client.from('authorized_administrators')
      .select('user_id')
      .eq('user_id', sessionData.session.user.id)
      .maybeSingle();
    if (adminError || !adminRow) {
      return {
        status: 'not-authorized-administrator',
        errorCode: adminError ? getSanitizedErrorCode(adminError) : undefined,
        note: 'The signed-in account is not verified in authorized_administrators under RLS.',
        canApply: false,
      };
    }
    return { status: 'authorized', client };
  } catch (error) {
    return {
      status: error?.code === 'INTERACTIVE_TERMINAL_REQUIRED' ? 'interactive-terminal-required'
        : error?.code === 'LOGIN_CANCELLED' ? 'login-cancelled'
          : 'login-failed',
      errorCode: error?.code ? getSanitizedErrorCode(error) : undefined,
      note: 'Interactive sign-in did not complete. No credentials or tokens were logged.',
      canApply: false,
    };
  } finally {
    password = '';
    email = '';
  }
}

async function listAllBucketObjects(client) {
  const objects = new Map();
  const pendingDirectories = [''];
  const visitedDirectories = new Set(['']);
  while (pendingDirectories.length) {
    const directory = pendingDirectories.shift();
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await client.storage.from(bucketName).list(directory, { limit: pageSize, offset });
      if (error) throw Object.assign(new Error('Full read-only bucket listing failed.'), { code: getSanitizedErrorCode(error) });
      const entries = data ?? [];
      for (const entry of entries) {
        const path = directory ? `${directory}/${entry.name}` : entry.name;
        if (entry.id == null && entry.metadata == null) {
          if (!visitedDirectories.has(path)) {
            visitedDirectories.add(path);
            pendingDirectories.push(path);
          }
        } else {
          objects.set(path, entry);
          if (objects.size > 100000) throw Object.assign(new Error('Storage inventory exceeded the safety limit.'), { code: 'OBJECT_LIMIT_EXCEEDED' });
        }
      }
      if (entries.length < pageSize) break;
    }
  }
  return objects;
}

async function authorizeAndInspect(config, records) {
  const authorization = await signInAuthorizedAdmin(config);
  if (authorization.status !== 'authorized') return authorization;
  const client = authorization.client;

  let categories;
  let projects;
  let galleryRows;
  try {
    [categories, projects, galleryRows] = await Promise.all([
      getAllRows(client, 'portfolio_categories', 'id, slug, is_active'),
      getAllRows(client, 'portfolio_projects', comparableProjectFields.join(', ')),
      getAllRows(client, 'portfolio_gallery_images', 'id, source_key, project_id, image_path, alt_text, caption, display_order'),
    ]);
  } catch (error) {
    return {
      status: 'admin-inventory-failed',
      errorCode: getSanitizedErrorCode(error),
      note: 'A full read-only database scan did not complete; apply mode is blocked.',
      existingCounts: null,
      conflicts: [],
      resumableProjects: [],
      resumableGalleryRows: [],
      objectStates: null,
      categoriesBySlug: null,
      canApply: false,
    };
  }

  const categoriesBySlug = new Map(categories.map((row) => [row.slug, row]));
  const projectsByKey = new Map(projects.filter((row) => row.source_key).map((row) => [row.source_key, row]));
  const projectsBySlug = new Map(projects.map((row) => [row.slug, row]));
  const projectsById = new Map(projects.map((row) => [row.id, row]));
  const conflicts = [];
  const resumableProjects = [];

  for (const record of records) {
    const category = categoriesBySlug.get(record.categorySlug);
    if (!category || !category.is_active) {
      conflicts.push({ type: 'category-missing-or-inactive', slug: record.categorySlug });
      continue;
    }
    const expected = { ...record.projectRow, category_id: category.id };
    const sourceMatch = projectsByKey.get(record.sourceKey);
    const slugMatch = projectsBySlug.get(record.slug);
    const idMatch = projectsById.get(record.id);

    if (sourceMatch) {
      if (projectMatches(sourceMatch, expected)) resumableProjects.push(record.sourceKey);
      else conflicts.push({ type: 'source_key-mismatch', sourceKey: record.sourceKey, slug: record.slug, existingId: sourceMatch.id });
      continue;
    }
    if (slugMatch) conflicts.push({ type: 'slug-conflict', sourceKey: record.sourceKey, slug: record.slug, existingId: slugMatch.id });
    if (idMatch) conflicts.push({ type: 'deterministic-id-conflict', sourceKey: record.sourceKey, slug: record.slug, existingId: idMatch.id });
  }

  const galleryBySourceKey = new Map(galleryRows.filter((row) => row.source_key).map((row) => [row.source_key, row]));
  const galleryByPath = new Map(galleryRows.map((row) => [`${row.project_id}/${row.image_path}`, row]));
  const resumableGalleryRows = [];
  for (const record of records) {
    for (const expected of record.gallery) {
      const sourceMatch = galleryBySourceKey.get(expected.sourceKey);
      const pathMatch = galleryByPath.get(`${expected.projectId}/${expected.imagePath}`);
      const match = sourceMatch ?? pathMatch;
      if (!match) continue;
      if (galleryMatches(match, expected)) resumableGalleryRows.push(expected.sourceKey);
      else conflicts.push({ type: 'gallery-row-conflict', sourceKey: expected.sourceKey, path: expected.imagePath });
    }
  }

  const candidateProjectIds = new Set(records.map((record) => record.id));
  const expectedGalleryIdentities = new Set(records.flatMap((record) => record.gallery.map(
    (image) => `${image.projectId}/${image.imagePath}`,
  )));
  for (const row of galleryRows) {
    if (candidateProjectIds.has(row.project_id)
        && !expectedGalleryIdentities.has(`${row.project_id}/${row.image_path}`)) {
      conflicts.push({ type: 'unexpected-gallery-row', projectId: row.project_id, path: row.image_path });
    }
  }

  let objectStates = {};
  let storageObjects;
  try {
    storageObjects = await listAllBucketObjects(client);
    const expectedAssets = new Map();
    const projectPrefixes = new Set(records.map((record) => record.id));
    for (const record of records) {
      expectedAssets.set(record.coverPath, record.cover);
      for (const image of record.gallery) expectedAssets.set(image.imagePath, image.asset);
    }
    for (const path of storageObjects.keys()) {
      const expectedAsset = expectedAssets.get(path);
      if (expectedAsset) {
        const { data: blob, error } = await client.storage.from(bucketName).download(path);
        if (error || !blob) throw Object.assign(new Error('Existing Storage object could not be read for hash verification.'), { code: getSanitizedErrorCode(error) });
        const bytes = Buffer.from(await blob.arrayBuffer());
        const sha256 = createHash('sha256').update(bytes).digest('hex');
        const same = bytes.byteLength === expectedAsset.bytes && sha256 === expectedAsset.sha256;
        objectStates[path] = same ? 'present-and-matching' : 'present-but-mismatched';
        if (!same) conflicts.push({ type: 'storage-object-hash-mismatch', path });
      } else {
        const candidateProjectId = path.split('/')[0];
        if (projectPrefixes.has(candidateProjectId)) {
          conflicts.push({ type: 'unexpected-storage-object', projectId: candidateProjectId, path });
        }
      }
    }
    for (const path of expectedAssets.keys()) {
      if (!(path in objectStates)) objectStates[path] = 'not-yet-uploaded';
    }
  } catch (error) {
    return {
      status: 'storage-inventory-failed',
      errorCode: getSanitizedErrorCode(error),
      note: 'Read-only Storage path/hash inspection did not complete; apply mode is blocked.',
      existingCounts: { categories: categories.length, projects: projects.length, galleryRows: galleryRows.length },
      conflicts,
      resumableProjects,
      resumableGalleryRows,
      objectStates: null,
      existingStorageObjectCount: null,
      existingStoragePaths: null,
      categoriesBySlug,
      canApply: false,
    };
  }

  const finalProjectRows = projects.length + records.filter((record) => !resumableProjects.includes(record.sourceKey)).length;
  const missingObjectCount = Object.values(objectStates).filter((state) => state === 'not-yet-uploaded').length;
  return {
    status: 'complete-authorized-read-only',
    existingCounts: { categories: categories.length, projects: projects.length, galleryRows: galleryRows.length },
    existingDrafts: projects.filter((project) => !project.is_published).length,
    existingStorageObjectCount: storageObjects.size,
    existingStoragePaths: [...storageObjects.keys()],
    unrelatedExistingStorageObjectCount: [...storageObjects.keys()].filter((path) => !path.split('/')[0] || !records.some((record) => record.id === path.split('/')[0])).length,
    resumableProjects,
    resumableGalleryRows,
    conflicts,
    objectStates,
    expectedFinalProjectCount: finalProjectRows,
    expectedFinalCategoryCount: categories.length,
    expectedFinalGalleryRowCount: galleryRows.length + records.reduce((sum, record) => (
      sum + record.gallery.filter((image) => !resumableGalleryRows.includes(image.sourceKey)).length
    ), 0),
    expectedFinalStorageObjectCount: storageObjects.size + missingObjectCount,
    categoriesBySlug,
    canApply: conflicts.length === 0,
    client,
    projects,
    galleryRows,
  };
}

function buildPublishReport(records, inspection) {
  const sourceKeys = records.map((record) => record.sourceKey);
  const sourceKeySet = new Set(sourceKeys);
  const completeScan = inspection.status === 'complete-authorized-read-only';
  const projects = inspection.projects ?? [];
  const galleryRows = inspection.galleryRows ?? [];
  const categoriesBySlug = inspection.categoriesBySlug;
  const categoriesById = new Map(
    [...(categoriesBySlug?.entries() ?? [])].map(([slug, category]) => [category.id, slug]),
  );
  const targetProjects = projects.filter((project) => sourceKeySet.has(project.source_key));
  const manualDrafts = projects.filter((project) => project.source_key === null);
  const preservedDraft = manualDrafts.length === 1 && !manualDrafts[0].is_published
    ? manualDrafts[0]
    : null;
  const manualDraftGallery = preservedDraft
    ? galleryRows.filter((image) => image.project_id === preservedDraft.id)
    : [];
  const storagePathSet = new Set(inspection.existingStoragePaths ?? []);
  const manualDraftPaths = preservedDraft
    ? [
      ...(preservedDraft.cover_image_path ? [preservedDraft.cover_image_path] : []),
      ...manualDraftGallery.map((image) => image.image_path),
    ]
    : [];
  const manualDraftStorageComplete = manualDraftPaths.every((path) => storagePathSet.has(path));
  const focus = records.find((record) => record.sourceKey === 'behance-246573009-cover');
  const focusRows = focus ? galleryRows
    .filter((image) => image.project_id === focus.id)
    .sort((first, second) => first.display_order - second.display_order) : [];
  const focusGalleryOrdered = Boolean(focus && focusRows.length === 34 && focus.gallery.every((expected, index) => (
    galleryMatches(focusRows[index], expected)
  )));
  const imageStates = Object.values(inspection.objectStates ?? {});
  const imageSummary = {
    expected: records.reduce((sum, record) => sum + (record.cover ? 1 : 0) + record.gallery.length, 0),
    byteAndSha256Matches: completeScan ? imageStates.filter((state) => state === 'present-and-matching').length : null,
    missing: completeScan ? imageStates.filter((state) => state === 'not-yet-uploaded').length : null,
    mismatched: completeScan ? imageStates.filter((state) => state === 'present-but-mismatched').length : null,
  };
  const actualImportedCategoryCounts = Object.fromEntries(
    records.map((record) => record.categorySlug).filter((slug, index, all) => all.indexOf(slug) === index)
      .map((slug) => [slug, targetProjects.filter((project) => categoriesById.get(project.category_id) === slug).length]),
  );
  const expectedImportedCategoryCounts = records.reduce((counts, record) => {
    counts[record.categorySlug] = (counts[record.categorySlug] ?? 0) + 1;
    return counts;
  }, {});
  const targetAlreadyPublished = targetProjects.filter((project) => project.is_published).length;
  const otherPublishedProjects = projects.filter((project) => project.is_published && !sourceKeySet.has(project.source_key));
  const requiredCategorySlugs = Object.keys(expectedImportedCategoryCounts).sort();
  const activeCategorySlugs = [...(categoriesBySlug?.entries() ?? [])]
    .filter(([, category]) => category.is_active)
    .map(([slug]) => slug)
    .sort();
  const plannedPublicCategoryCounts = { ...expectedImportedCategoryCounts };
  for (const project of otherPublishedProjects) {
    const slug = categoriesById.get(project.category_id);
    if (slug) plannedPublicCategoryCounts[slug] = (plannedPublicCategoryCounts[slug] ?? 0) + 1;
  }

  const blockers = [];
  if (!completeScan) blockers.push('Full authenticated database and Storage scan did not complete.');
  if ((inspection.conflicts ?? []).length) blockers.push('Conflicts were found in project rows, gallery rows, or Storage objects.');
  if (completeScan && (records.length !== 29 || targetProjects.length !== 29 || (inspection.resumableProjects ?? []).length !== 29)) {
    blockers.push('Not all 29 local projects exactly match their imported database rows.');
  }
  if (completeScan && (imageSummary.expected !== 63 || imageSummary.byteAndSha256Matches !== 63
      || imageSummary.missing !== 0 || imageSummary.mismatched !== 0)) {
    blockers.push('All 63 original image files are not present with matching byte sizes and SHA-256 hashes.');
  }
  if (completeScan && ((inspection.resumableGalleryRows ?? []).length !== 34 || !focusGalleryOrdered)) {
    blockers.push('Focus does not have exactly 34 verified gallery rows in original order.');
  }
  if (completeScan && projects.length !== 30) blockers.push('Database project count differs from the expected 30, including the existing test draft.');
  if (completeScan && (manualDrafts.length !== 1 || !preservedDraft)) blockers.push('The single source_key-null test draft is missing or is no longer unpublished.');
  if (completeScan && (galleryRows.length !== 35 || manualDraftGallery.length !== 1)) {
    blockers.push('The expected 35 gallery rows (34 Focus images plus the test draft image) were not found.');
  }
  if (completeScan && !manualDraftStorageComplete) blockers.push('A cover or gallery object referenced by the preserved test draft is missing from Storage.');
  if (completeScan && targetAlreadyPublished !== 0) blockers.push('At least one migrated project is already published; expected all 29 to remain drafts before publishing.');
  if (completeScan && otherPublishedProjects.length !== 0) blockers.push('Other projects are already public, so the public catalog would exceed the requested 29 projects.');
  if (completeScan && (inspection.existingCounts?.categories !== 3 || requiredCategorySlugs.length !== 3
      || activeCategorySlugs.length !== 3
      || requiredCategorySlugs.some((slug) => !activeCategorySlugs.includes(slug)))) {
    blockers.push('The three expected active project categories are not the complete active category set.');
  }
  if (completeScan && requiredCategorySlugs.some((slug) => actualImportedCategoryCounts[slug] !== expectedImportedCategoryCounts[slug])) {
    blockers.push('Imported project category assignments do not match the original local catalog.');
  }

  const targetByKey = new Map(targetProjects.map((project) => [project.source_key, project]));
  return {
    status: blockers.length ? 'blocked' : 'ready-for-explicit-approval',
    ready: blockers.length === 0,
    targetProjectCount: records.length,
    targetSourceKeys: records.map((record) => ({
      source_key: record.sourceKey,
      slug: record.slug,
      category: record.categorySlug,
      display_order: record.displayOrder,
      currently_published: targetByKey.get(record.sourceKey)?.is_published ?? null,
    })),
    verification: {
      exactProjectRows: completeScan ? (inspection.resumableProjects ?? []).length : null,
      targetProjectsFound: completeScan ? targetProjects.length : null,
      imageIntegrity: imageSummary,
      focusGallery: { expected: 34, found: completeScan ? focusRows.length : null, originalOrderVerified: completeScan ? focusGalleryOrdered : null },
      projectCount: { expected: 30, found: completeScan ? projects.length : null },
      categoryCount: { expected: 3, found: inspection.existingCounts?.categories ?? null },
      galleryRowCount: { expected: 35, found: completeScan ? galleryRows.length : null },
      preservedTestDraft: {
        found: completeScan ? manualDrafts.length === 1 : null,
        unpublished: completeScan ? Boolean(preservedDraft) : null,
        galleryImageCount: completeScan ? manualDraftGallery.length : null,
        referencedStorageObjectsPresent: completeScan ? manualDraftStorageComplete : null,
      },
      importedCategoryCounts: {
        expected: expectedImportedCategoryCounts,
        found: completeScan ? actualImportedCategoryCounts : null,
      },
      otherPublishedProjects: completeScan ? otherPublishedProjects.length : null,
      plannedPublicCategoryCounts,
    },
    publisher: {
      rpc: 'public.publish_migrated_portfolio_projects(text[])',
      atomic: true,
      requiresPreparedSqlMigration: true,
      applyFlag: '--publish --apply',
      confirmationPhrase: 'PUBLISH EXACTLY 29 MIGRATED PROJECTS',
    },
    blockers,
  };
}

function getAssetContentType(path) {
  const extension = path.toLowerCase().split('.').at(-1);
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' })[extension] ?? 'application/octet-stream';
}

async function readAndVerifyLocalAsset(asset) {
  const bytes = await readFile(join(root, asset.path));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (bytes.byteLength !== asset.bytes || sha256 !== asset.sha256) {
    throw new Error(`Local source changed after preflight: ${asset.path}`);
  }
  return bytes;
}

async function verifyRemoteObject(client, objectPath, asset) {
  const { data, error } = await client.storage.from(bucketName).download(objectPath);
  if (error || !data) throw Object.assign(new Error('Uploaded object could not be read back.'), { code: getSanitizedErrorCode(error) });
  const bytes = Buffer.from(await data.arrayBuffer());
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (bytes.byteLength !== asset.bytes || sha256 !== asset.sha256) {
    throw new Error(`Remote hash/size verification failed for ${objectPath}`);
  }
}

async function uploadAsset(client, objectPath, asset, state) {
  if (state === 'present-and-matching') return 'verified-existing';
  const bytes = await readAndVerifyLocalAsset(asset);
  const { error } = await client.storage.from(bucketName).upload(objectPath, bytes, {
    cacheControl: '3600',
    contentType: getAssetContentType(asset.path),
    upsert: false,
  });
  if (error) {
    // A concurrent rerun may have created it after preflight. Only accept an exact byte match.
    try {
      await verifyRemoteObject(client, objectPath, asset);
      return 'verified-after-concurrent-create';
    } catch {
      throw Object.assign(new Error('Storage upload failed; no existing object was overwritten.'), { code: getSanitizedErrorCode(error) });
    }
  }
  await verifyRemoteObject(client, objectPath, asset);
  return 'uploaded-and-verified';
}

async function insertOrResumeProject(client, record, expected, existingProjects) {
  const present = existingProjects.find((project) => project.source_key === record.sourceKey);
  if (present) {
    if (!projectMatches(present, expected)) throw new Error(`Existing source_key changed after preflight: ${record.sourceKey}`);
    return 'resumed';
  }
  const { data, error } = await client.from('portfolio_projects').insert(expected).select(comparableProjectFields.join(', ')).single();
  if (!error && data) {
    existingProjects.push(data);
    return 'created-as-draft';
  }
  const { data: raced, error: readError } = await client.from('portfolio_projects')
    .select(comparableProjectFields.join(', ')).eq('source_key', record.sourceKey).maybeSingle();
  if (!readError && raced && projectMatches(raced, expected)) {
    if (!existingProjects.some((project) => project.id === raced.id)) existingProjects.push(raced);
    return 'resumed-after-concurrent-create';
  }
  throw Object.assign(new Error('Project insert failed; existing records were not updated or deleted.'), { code: getSanitizedErrorCode(error) });
}

async function insertOrResumeGalleryRow(client, image, existingGallery) {
  const present = existingGallery.find((row) => row.source_key === image.sourceKey
    || (row.project_id === image.projectId && row.image_path === image.imagePath));
  if (present) {
    if (!galleryMatches(present, image)) throw new Error(`Existing gallery row changed after preflight: ${image.sourceKey}`);
    return 'resumed';
  }
  const row = {
    id: image.id,
    source_key: image.sourceKey,
    project_id: image.projectId,
    image_path: image.imagePath,
    alt_text: image.altText,
    caption: image.caption,
    display_order: image.displayOrder,
  };
  const { data, error } = await client.from('portfolio_gallery_images').insert(row)
    .select('id, source_key, project_id, image_path, alt_text, caption, display_order').single();
  if (!error && data) {
    existingGallery.push(data);
    return 'created';
  }
  const { data: raced, error: readError } = await client.from('portfolio_gallery_images')
    .select('id, source_key, project_id, image_path, alt_text, caption, display_order')
    .eq('source_key', image.sourceKey).maybeSingle();
  if (!readError && raced && galleryMatches(raced, image)) {
    if (!existingGallery.some((entry) => entry.id === raced.id)) existingGallery.push(raced);
    return 'resumed-after-concurrent-create';
  }
  throw Object.assign(new Error('Gallery row insert failed; existing records were not updated or deleted.'), { code: getSanitizedErrorCode(error) });
}

async function applyMigration(records, inspection) {
  const client = inspection.client;
  const projects = [...inspection.projects];
  const galleryRows = [...inspection.galleryRows];
  const categoriesBySlug = inspection.categoriesBySlug;
  const summary = { projectsCreated: 0, projectsResumed: 0, objectsUploaded: 0, objectsReused: 0, galleryRowsCreated: 0, galleryRowsResumed: 0 };

  for (const record of records) {
    const expected = { ...record.projectRow, category_id: categoriesBySlug.get(record.categorySlug).id };
    const projectResult = await insertOrResumeProject(client, record, expected, projects);
    if (projectResult.startsWith('created')) summary.projectsCreated += 1;
    else summary.projectsResumed += 1;

    const assets = [
      { path: record.coverPath, asset: record.cover },
      ...record.gallery.map((image) => ({ path: image.imagePath, asset: image.asset })),
    ];
    for (const { path, asset } of assets) {
      const state = inspection.objectStates[path];
      const result = await uploadAsset(client, path, asset, state);
      if (result === 'uploaded-and-verified') summary.objectsUploaded += 1;
      else summary.objectsReused += 1;
    }

    for (const image of record.gallery) {
      const result = await insertOrResumeGalleryRow(client, image, galleryRows);
      if (result === 'created') summary.galleryRowsCreated += 1;
      else summary.galleryRowsResumed += 1;
    }
  }

  const migratedKeys = records.map((record) => record.sourceKey);
  const { data: finalProjects, error: projectError } = await client.from('portfolio_projects')
    .select('source_key, is_published').in('source_key', migratedKeys);
  if (projectError || finalProjects?.length !== records.length || finalProjects.some((project) => project.is_published)) {
    throw new Error('Final verification failed: imported projects are missing or not all unpublished. No automatic rollback was attempted.');
  }
  const focus = records.find((record) => record.sourceKey === 'behance-246573009-cover');
  const { data: focusGallery, error: focusGalleryError } = await client.from('portfolio_gallery_images')
    .select('image_path, display_order').eq('project_id', focus.id).order('display_order', { ascending: true });
  if (focusGalleryError || focusGallery?.length !== 34 || focusGallery.some((row, index) => (
    row.display_order !== index || row.image_path !== focus.gallery[index]?.imagePath
  ))) {
    throw new Error('Final Focus gallery verification failed. No automatic rollback was attempted.');
  }
  return summary;
}

async function publishMigratedProjects(records, client) {
  const sourceKeys = records.map((record) => record.sourceKey);
  const { data: updatedCount, error } = await client.rpc('publish_migrated_portfolio_projects', {
    p_source_keys: sourceKeys,
  });
  if (error) throw Object.assign(new Error('Atomic publishing RPC failed.'), { code: getSanitizedErrorCode(error) });
  if (updatedCount !== 29) {
    throw Object.assign(new Error('Atomic publishing RPC returned an unexpected row count.'), { code: 'PUBLISH_COUNT_MISMATCH' });
  }

  const { data: publishedRows, error: verifyError } = await client.from('portfolio_projects')
    .select('source_key, is_published')
    .in('source_key', sourceKeys);
  if (verifyError || publishedRows?.length !== 29 || publishedRows.some((row) => !row.is_published)) {
    throw Object.assign(new Error('The atomic publish completed but its read-back verification failed.'), {
      code: verifyError ? getSanitizedErrorCode(verifyError) : 'POST_PUBLISH_VERIFY_FAILED',
    });
  }
  return { projectsPublished: updatedCount, publishedRowsVerified: publishedRows.length };
}

function printResult(result) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function main() {
  const config = readConfiguration();
  if (!config.url || !config.publishableKey) {
    printResult({ mode: applyRequested ? 'apply' : 'dry-run', status: 'blocked', issue: 'Supabase URL or publishable key is missing; values were not printed.' });
    process.exitCode = 1;
    return;
  }
  if (isPrivilegedCredential(config.publishableKey)) {
    printResult({ mode: applyRequested ? 'apply' : 'dry-run', status: 'blocked', issue: 'VITE_SUPABASE_PUBLISHABLE_KEY contains a privileged credential; no request was made.' });
    process.exitCode = 1;
    return;
  }

  const inventory = getInventory();
  const records = makeExpectedRecords(inventory);
  const localIssues = verifyLocalBaseline(inventory, records);
  const localConflicts = [
    ...inventory.preflight.duplicateLocalSourceKeys.map((sourceKey) => ({ type: 'duplicate-local-source-key', sourceKey })),
    ...inventory.preflight.duplicateLocalSlugs.map((slug) => ({ type: 'duplicate-local-slug', slug })),
  ];
  const inspection = localIssues.length === 0 && localConflicts.length === 0
    ? await authorizeAndInspect(config, records)
    : { status: 'blocked-by-local-inventory', canApply: false, conflicts: [], existingCounts: null };
  const conflicts = [...localConflicts, ...(inspection.conflicts ?? [])];
  const imageCount = records.reduce((sum, record) => sum + (record.cover ? 1 : 0) + record.gallery.length, 0);
  const completeAdminScan = inspection.status === 'complete-authorized-read-only';
  const canApply = localIssues.length === 0 && conflicts.length === 0 && inspection.canApply === true;
  const summary = {
    mode: publishRequested
      ? (applyRequested ? 'publish apply requested' : 'publish dry-run; no database or Storage writes are performed')
      : applyRequested ? 'apply requested' : 'dry-run only; no database or Storage writes are performed',
    status: localIssues.length || conflicts.length ? 'blocked-or-conflicts-found' : completeAdminScan ? 'preflight-clear' : 'local-inventory-clear-admin-scan-incomplete',
    source: {
      projects: records.length,
      imageFiles: imageCount,
      categories: inventory.local.categories,
      sourcePathsAndSha256Recorded: true,
      originalFilesModified: false,
    },
    remote: {
      fullAdminScan: inspection.status,
      existingCounts: inspection.existingCounts,
      existingDraftCount: inspection.existingDrafts ?? null,
      existingStorageObjectCount: inspection.existingStorageObjectCount ?? null,
      unrelatedExistingStorageObjectCount: inspection.unrelatedExistingStorageObjectCount ?? null,
      expectedFinalProjectCount: inspection.expectedFinalProjectCount ?? null,
      expectedFinalCategoryCount: inspection.expectedFinalCategoryCount ?? null,
      expectedFinalGalleryRowCount: inspection.expectedFinalGalleryRowCount ?? null,
      expectedFinalStorageObjectCount: inspection.expectedFinalStorageObjectCount ?? null,
      databaseAndStorageWritesPerformed: false,
    },
    conflicts,
    conflictCheck: {
      completeAcrossAllDatabaseRowsAndStorage: completeAdminScan,
      sourceKeySlugDraftAndStorageConflicts: completeAdminScan ? 'checked' : 'unknown; interactive administrator scan required',
    },
    issues: [...localIssues, ...(inspection.note ? [inspection.note] : []), ...(inspection.errorCode ? [`Sanitized request code: ${inspection.errorCode}`] : [])],
    resumePlan: {
      projectIds: 'UUIDv5 derived from source_key using a fixed namespace',
      storagePathFormat: '<deterministic-project-uuid>/<original-filename>',
      uploadMode: 'upsert:false; existing objects are downloaded and SHA-256/byte-size checked before reuse',
      rowMode: 'insert missing rows only; matching completed rows are skipped; mismatches stop without update/delete',
      importedPublicationState: 'all new projects start unpublished; no publish operation exists in this migration',
    },
    localInventoryIssues: localIssues,
    applyEligible: canApply,
  };

  if (publishRequested) {
    const publishPlan = buildPublishReport(records, inspection);
    summary.publishPlan = publishPlan;
    summary.publishEligible = publishPlan.ready;
    summary.status = publishPlan.ready ? 'ready-for-explicit-approval' : 'publishing-blocked';
    if (!applyRequested) {
      printResult(summary);
      return;
    }
    if (!publishPlan.ready) {
      summary.mode = 'publish refused';
      printResult(summary);
      process.exitCode = 1;
      return;
    }

    printResult(summary);
    const confirmation = await confirmApply(
      'PUBLISH EXACTLY 29 MIGRATED PROJECTS',
      'This will publish the 29 listed source_key records in one atomic database operation.',
    );
    if (!confirmation.confirmed) {
      summary.mode = confirmation.unavailable ? 'publish confirmation unavailable' : 'publish cancelled';
      summary.status = 'no-writes-performed';
      summary.confirmation = confirmation.unavailable
        ? 'Run from an interactive Windows PowerShell terminal. No changes were made.'
        : 'The exact confirmation phrase was not entered. No changes were made.';
      printResult(summary);
      return;
    }

    try {
      summary.publish = await publishMigratedProjects(records, inspection.client);
      summary.mode = 'publish complete';
      summary.status = 'published-and-verified';
      summary.remote.databaseAndStorageWritesPerformed = true;
      printResult(summary);
    } catch (error) {
      summary.mode = 'publish attempted; verify current state before retrying';
      summary.status = 'publish-failed-or-postcheck-incomplete';
      summary.remote.databaseAndStorageWritesPerformed = 'unknown; no Storage writes are performed by publish mode';
      summary.publishError = error?.code
        ? `Sanitized request code: ${getSanitizedErrorCode(error)}`
        : 'The publishing operation could not be fully verified.';
      printResult(summary);
      process.exitCode = 1;
    }
    return;
  }

  if (!applyRequested) {
    printResult(summary);
    return;
  }
  if (!canApply) {
    summary.mode = 'apply refused';
    summary.status = 'blocked';
    printResult(summary);
    process.exitCode = 1;
    return;
  }

  printResult(summary);
  const confirmation = await confirmApply(
    `IMPORT ${records.length} DRAFT PROJECTS`,
    'This will write project and gallery rows and upload missing images.',
  );
  if (!confirmation.confirmed) {
    summary.mode = confirmation.unavailable ? 'apply confirmation unavailable' : 'apply cancelled';
    summary.status = 'no-writes-performed';
    summary.confirmation = confirmation.unavailable
      ? 'Run from an interactive Windows PowerShell terminal. No changes were made.'
      : 'The exact confirmation phrase was not entered. No changes were made.';
    printResult(summary);
    return;
  }

  try {
    // Both --apply and the exact terminal confirmation are required before writes begin.
    const applied = await applyMigration(records, inspection);
    summary.mode = 'apply complete';
    summary.status = 'verified-unpublished';
    summary.remote.databaseAndStorageWritesPerformed = true;
    summary.apply = applied;
    printResult(summary);
  } catch (error) {
    summary.mode = 'apply interrupted; safe to re-run after reviewing the issue';
    summary.status = 'apply-failed-no-automatic-rollback';
    summary.remote.databaseAndStorageWritesPerformed = true;
    summary.applyError = error?.code ? `Sanitized request code: ${getSanitizedErrorCode(error)}` : 'A migration step failed; sensitive request details were suppressed.';
    printResult(summary);
    process.exitCode = 1;
  }
}

main().catch(() => {
  printResult({ mode: applyRequested ? 'apply' : 'dry-run', status: 'failed', issue: 'Migration preflight failed. Sensitive request details were suppressed.' });
  process.exitCode = 1;
});
