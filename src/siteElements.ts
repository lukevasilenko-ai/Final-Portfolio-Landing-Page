/**
 * Per-element changes made in the admin's visual editor that go beyond section copy:
 * hiding any element, relabelling small texts, changing link targets and choosing which
 * works appear in the hero's poster strip. Stored as one published site_content row
 * (content_key "site-elements"), read by the public site; missing or invalid values are
 * ignored, so an empty row means "the site as designed".
 */
import { isSafeWebsiteImage, isSafeWebsiteLink } from './websiteSections/model';
import { normalizeStyleMap, type StyleMap } from './siteElementStyles';

export const SITE_ELEMENTS_KEY = 'site-elements';
/** Unpublished working copy (admin-only: site_content rows are public only when published). */
export const SITE_ELEMENTS_DRAFT_KEY = 'site-elements-draft';
export const SITE_ELEMENTS_LOCALE = 'ka';
export const STRIP_LIMIT = 30;

export interface SiteElements {
  /** Element ids hidden on the site. */
  hidden: string[];
  /** Replacement text per element id. */
  text: Record<string, string>;
  /** Replacement link per element id. */
  href: Record<string, string>;
  /** Poster strip in order: "static:<file>" (bundled) or "work:<project id>"; null = default set. */
  strip: string[] | null;
  /** Visual style changes per element and screen size (see siteElementStyles). */
  style: StyleMap;
  /**
   * Text and images placed freely on top of a section. Their position, size, rotation and look
   * live in `style` under "free.<id>"; a text's words live in `text` under the same key.
   */
  free: FreeItem[];
}

export interface FreeItem {
  id: string;
  /** Section the item belongs to (it moves with that section). */
  section: string;
  type: 'text' | 'image';
  /** Image address (an uploaded file's public link). */
  src?: string;
  alt?: string;
}

export const FREE_LIMIT = 60;
export const freeElementId = (item: Pick<FreeItem, 'id'>) => `free.${item.id}`;

export const EMPTY_SITE_ELEMENTS: SiteElements = { hidden: [], text: {}, href: {}, strip: null, style: {}, free: [] };

const ID_PATTERN = /^[a-z0-9][a-z0-9:._-]{0,119}$/i;
const STRIP_KEY_PATTERN = /^(static:[\w().-]{1,80}|work:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isStripKey = (value: string) => STRIP_KEY_PATTERN.test(value);

/** Keeps only well-formed entries; never throws. */
export function normalizeSiteElements(raw: unknown): SiteElements {
  const source = isRecord(raw) ? raw : {};
  const hidden = Array.isArray(source.hidden)
    ? [...new Set(source.hidden.filter((id): id is string => typeof id === 'string' && ID_PATTERN.test(id)))].slice(0, 300)
    : [];
  const text: Record<string, string> = {};
  if (isRecord(source.text)) {
    for (const [id, value] of Object.entries(source.text)) {
      if (ID_PATTERN.test(id) && typeof value === 'string' && value.length <= 500) text[id] = value;
    }
  }
  const href: Record<string, string> = {};
  if (isRecord(source.href)) {
    for (const [id, value] of Object.entries(source.href)) {
      if (ID_PATTERN.test(id) && typeof value === 'string' && isSafeWebsiteLink(value)) href[id] = value.trim();
    }
  }
  const strip = Array.isArray(source.strip)
    ? source.strip.filter((key): key is string => typeof key === 'string' && isStripKey(key)).slice(0, STRIP_LIMIT)
    : null;
  const free = Array.isArray(source.free) ? normalizeFreeItems(source.free) : [];
  return { hidden, text, href, strip, style: normalizeStyleMap(source.style), free };
}

const FREE_ID = /^[a-z0-9]{6,24}$/;
const SECTION_ID = /^[a-z0-9][a-z0-9-]{1,100}$/i;

function normalizeFreeItems(raw: unknown[]): FreeItem[] {
  const seen = new Set<string>();
  return raw.flatMap((entry): FreeItem[] => {
    if (!isRecord(entry) || typeof entry.id !== 'string' || !FREE_ID.test(entry.id) || seen.has(entry.id)) return [];
    if (typeof entry.section !== 'string' || !SECTION_ID.test(entry.section)) return [];
    if (entry.type !== 'text' && entry.type !== 'image') return [];
    if (entry.type === 'image' && (typeof entry.src !== 'string' || !isSafeWebsiteImage(entry.src) || !entry.src.startsWith('https://'))) return [];
    seen.add(entry.id);
    return [{
      id: entry.id,
      section: entry.section,
      type: entry.type,
      ...(entry.type === 'image' ? { src: (entry.src as string).trim() } : {}),
      ...(typeof entry.alt === 'string' && entry.alt.length <= 200 ? { alt: entry.alt } : {}),
    }];
  }).slice(0, FREE_LIMIT);
}

const newFreeId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

/** Adds a text or image to a section, near its top-left, and returns the new item's element id. */
export function addFreeItem(elements: SiteElements, section: string, type: FreeItem['type'], src?: string): { elements: SiteElements; elementId: string } {
  const item: FreeItem = { id: newFreeId(), section, type, ...(src ? { src } : {}) };
  const elementId = freeElementId(item);
  const offset = elements.free.filter((entry) => entry.section === section).length * 24;
  return {
    elementId,
    elements: {
      ...elements,
      free: [...elements.free, item].slice(0, FREE_LIMIT),
      text: type === 'text' ? { ...elements.text, [elementId]: 'ახალი ტექსტი' } : elements.text,
      style: {
        ...elements.style,
        [elementId]: { base: type === 'text'
          ? { posX: 8, posY: 96 + offset, widthPct: 30, fontSize: 28, zIndex: 10 }
          : { posX: 60, posY: 96 + offset, widthPct: 22, zIndex: 10 } },
      },
    },
  };
}

/** Copies an item (words, image and all screen-size styles), placed a little lower. */
export function duplicateFreeItem(elements: SiteElements, elementId: string): { elements: SiteElements; elementId: string } | null {
  const source = elements.free.find((item) => freeElementId(item) === elementId);
  if (!source || elements.free.length >= FREE_LIMIT) return null;
  const copy: FreeItem = { ...source, id: newFreeId() };
  const copyId = freeElementId(copy);
  const style = structuredClone(elements.style[elementId] ?? {});
  // Shift the copy on every screen size that has its own position, so it never hides the original.
  for (const size of ['base', 'tablet', 'mobile'] as const) {
    if (size === 'base' || style[size]?.posY !== undefined) style[size] = { ...style[size], posY: (style[size]?.posY ?? 48) + 32 };
  }
  return {
    elementId: copyId,
    elements: {
      ...elements,
      free: [...elements.free, copy],
      text: elements.text[elementId] !== undefined ? { ...elements.text, [copyId]: elements.text[elementId] } : elements.text,
      style: { ...elements.style, [copyId]: style },
    },
  };
}

/** Removes an item together with its words, styles and hidden flag. */
export function removeFreeItem(elements: SiteElements, elementId: string): SiteElements {
  const text = { ...elements.text };
  const style = { ...elements.style };
  delete text[elementId];
  delete style[elementId];
  return {
    ...elements,
    free: elements.free.filter((item) => freeElementId(item) !== elementId),
    text,
    style,
    hidden: elements.hidden.filter((id) => id !== elementId),
  };
}

export function setFreeImage(elements: SiteElements, elementId: string, src: string): SiteElements {
  return { ...elements, free: elements.free.map((item) => freeElementId(item) === elementId ? { ...item, src } : item) };
}

/** Sets (or clears) the image description read by screen readers and search engines. */
export function setFreeAlt(elements: SiteElements, elementId: string, alt: string): SiteElements {
  const value = alt.trim().slice(0, 200);
  return {
    ...elements,
    free: elements.free.map((item) => {
      if (freeElementId(item) !== elementId) return item;
      const next = { ...item };
      if (value) next.alt = value; else delete next.alt;
      return next;
    }),
  };
}

export const findFreeItem = (elements: SiteElements, elementId: string) =>
  elements.free.find((item) => freeElementId(item) === elementId);

export function siteElementsEqual(first: SiteElements, second: SiteElements) {
  return JSON.stringify(normalizeSiteElements(first)) === JSON.stringify(normalizeSiteElements(second));
}

export function setElementHidden(elements: SiteElements, id: string, hidden: boolean): SiteElements {
  const rest = elements.hidden.filter((item) => item !== id);
  return { ...elements, hidden: hidden ? [...rest, id] : rest };
}

export function setElementText(elements: SiteElements, id: string, value: string | null): SiteElements {
  const text = { ...elements.text };
  if (value === null) delete text[id]; else text[id] = value.slice(0, 500);
  return { ...elements, text };
}

export function setElementHref(elements: SiteElements, id: string, value: string | null): SiteElements {
  const href = { ...elements.href };
  if (value === null) delete href[id]; else href[id] = value.trim();
  return { ...elements, href };
}

type ElementsQuery = PromiseLike<{ data: { content: unknown } | null; error: unknown }>;
export interface SiteElementsClient {
  from(table: 'site_content'): {
    select(columns: string): {
      eq(column: string, value: string): { eq(column: string, value: string): { maybeSingle(): ElementsQuery } };
    };
  };
}

/**
 * Loads the saved element changes; null means none saved yet or unreachable (callers use the
 * defaults). `draft` reads the admin's working copy (only an administrator session can).
 */
export async function loadSiteElements(client: SiteElementsClient, draft = false): Promise<SiteElements | null> {
  const { data, error } = await client
    .from('site_content')
    .select('content')
    .eq('content_key', draft ? SITE_ELEMENTS_DRAFT_KEY : SITE_ELEMENTS_KEY)
    .eq('locale', SITE_ELEMENTS_LOCALE)
    .maybeSingle();
  if (error || !data) return null;
  return normalizeSiteElements(data.content);
}
