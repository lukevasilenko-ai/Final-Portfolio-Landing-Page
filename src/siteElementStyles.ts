/**
 * Visual style changes made in the editor's properties panel, per element and per screen size.
 * Values are validated against a fixed list of properties and ranges, then compiled into one
 * stylesheet keyed by the elements' stable `data-el` ids. Nothing is emitted for elements that
 * were never styled, so the site keeps its designed look by default.
 */

export type Breakpoint = 'base' | 'tablet' | 'mobile';
export const BREAKPOINTS: Breakpoint[] = ['base', 'tablet', 'mobile'];
/** Widths at which tablet and phone values take over (same steps as the editor's device sizes). */
export const BREAKPOINT_MAX: Record<Exclude<Breakpoint, 'base'>, number> = { tablet: 1023, mobile: 767 };

export const FONT_FAMILIES = {
  site: { label: 'საიტის ძირითადი (Mersad)', css: '"Mersad", ui-sans-serif, system-ui, sans-serif' },
  display: { label: 'სათაურის (LGV Anastasia)', css: '"LGV Anastasia", "Mersad", sans-serif' },
  script: { label: 'ხელნაწერი (DM Elene)', css: '"DM Elene Akhvlediani", "Mersad", cursive' },
  system: { label: 'სისტემური', css: 'ui-sans-serif, system-ui, sans-serif' },
  serif: { label: 'სერიფიანი', css: 'Georgia, "Times New Roman", serif' },
} as const;
export type FontFamilyKey = keyof typeof FONT_FAMILIES;

export const SHADOWS = {
  none: 'none',
  soft: '0 12px 30px -14px rgba(0, 0, 0, 0.35)',
  strong: '0 26px 60px -22px rgba(0, 0, 0, 0.6)',
} as const;
export type ShadowKey = keyof typeof SHADOWS;

export interface ElementStyle {
  fontFamily?: FontFamilyKey;
  fontSize?: number;      // px
  fontWeight?: number;    // 300–900
  fontStyle?: 'normal' | 'italic';
  color?: string;
  lineHeight?: number;    // unitless
  letterSpacing?: number; // em
  textAlign?: 'left' | 'center' | 'right';
  textTransform?: 'none' | 'uppercase';
  background?: string;
  paddingY?: number;      // px
  paddingX?: number;      // px
  marginTop?: number;     // px
  marginBottom?: number;  // px
  width?: number;         // px, 0 = auto
  radius?: number;        // px
  borderWidth?: number;   // px
  borderColor?: string;
  shadow?: ShadowKey;
  opacity?: number;       // 0–100
  x?: number;             // px
  y?: number;             // px
  rotate?: number;        // deg
  scale?: number;         // %
  zIndex?: number;
  hidden?: boolean;       // hide on this screen size only
  // Freely placed items only (relative to their section):
  posX?: number;          // % of section width from the left
  posY?: number;          // px from the section top
  widthPct?: number;      // % of section width
  heightPx?: number;      // px; for images this crops to the box
  objectX?: number;       // crop focus, % (0 = left, 100 = right)
  objectY?: number;       // crop focus, % (0 = top, 100 = bottom)
}

export type ResponsiveStyle = Partial<Record<Breakpoint, ElementStyle>>;
export type StyleMap = Record<string, ResponsiveStyle>;

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)|transparent)$/i;
const ID = /^[a-z0-9][a-z0-9:._-]{0,119}$/i;
const NUMBER_RANGES: Partial<Record<keyof ElementStyle, [number, number]>> = {
  fontSize: [6, 240], fontWeight: [100, 900], lineHeight: [0.6, 4], letterSpacing: [-0.2, 1],
  paddingY: [0, 400], paddingX: [0, 400], marginTop: [-400, 800], marginBottom: [-400, 800],
  width: [0, 2400], radius: [0, 400], borderWidth: [0, 40], opacity: [0, 100],
  x: [-2000, 2000], y: [-2000, 2000], rotate: [-360, 360], scale: [5, 500], zIndex: [-50, 200],
  posX: [-100, 200], posY: [-2000, 8000], widthPct: [1, 300], heightPx: [8, 4000], objectX: [0, 100], objectY: [0, 100],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function normalizeStyle(raw: unknown): ElementStyle | undefined {
  if (!isRecord(raw)) return undefined;
  const style: ElementStyle = {};
  for (const [key, range] of Object.entries(NUMBER_RANGES) as [keyof ElementStyle, [number, number]][]) {
    const value = raw[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= range[0] && value <= range[1]) {
      (style as Record<string, number>)[key] = Math.round(value * 1000) / 1000;
    }
  }
  for (const key of ['color', 'background', 'borderColor'] as const) {
    const value = raw[key];
    if (typeof value === 'string' && COLOR.test(value.trim())) style[key] = value.trim();
  }
  if (typeof raw.fontFamily === 'string' && raw.fontFamily in FONT_FAMILIES) style.fontFamily = raw.fontFamily as FontFamilyKey;
  if (raw.fontStyle === 'normal' || raw.fontStyle === 'italic') style.fontStyle = raw.fontStyle;
  if (raw.textAlign === 'left' || raw.textAlign === 'center' || raw.textAlign === 'right') style.textAlign = raw.textAlign;
  if (raw.textTransform === 'none' || raw.textTransform === 'uppercase') style.textTransform = raw.textTransform;
  if (typeof raw.shadow === 'string' && raw.shadow in SHADOWS) style.shadow = raw.shadow as ShadowKey;
  if (raw.hidden === true) style.hidden = true;
  return Object.keys(style).length ? style : undefined;
}

export function normalizeStyleMap(raw: unknown): StyleMap {
  if (!isRecord(raw)) return {};
  const map: StyleMap = {};
  for (const [id, value] of Object.entries(raw).slice(0, 500)) {
    if (!ID.test(id) || !isRecord(value)) continue;
    const responsive: ResponsiveStyle = {};
    for (const breakpoint of BREAKPOINTS) {
      const style = normalizeStyle(value[breakpoint]);
      if (style) responsive[breakpoint] = style;
    }
    if (Object.keys(responsive).length) map[id] = responsive;
  }
  return map;
}

/** Sets (or clears, with undefined) one property for one element at one screen size. */
export function setStyleValue<K extends keyof ElementStyle>(
  map: StyleMap, id: string, breakpoint: Breakpoint, key: K, value: ElementStyle[K] | undefined,
): StyleMap {
  const current = { ...(map[id]?.[breakpoint] ?? {}) };
  if (value === undefined || value === '' as unknown) delete current[key]; else current[key] = value;
  const responsive = { ...(map[id] ?? {}), [breakpoint]: current };
  if (!Object.keys(current).length) delete responsive[breakpoint];
  const next = { ...map, [id]: responsive };
  if (!Object.keys(responsive).length) delete next[id];
  return next;
}

export function clearElementStyle(map: StyleMap, id: string, breakpoint?: Breakpoint): StyleMap {
  const next = { ...map };
  if (!breakpoint) { delete next[id]; return next; }
  const responsive = { ...(next[id] ?? {}) };
  delete responsive[breakpoint];
  if (Object.keys(responsive).length) next[id] = responsive; else delete next[id];
  return next;
}

/** The value in effect at a screen size: phone falls back to tablet, tablet to desktop. */
export function effectiveStyle(map: StyleMap, id: string, breakpoint: Breakpoint): ElementStyle {
  const style = map[id] ?? {};
  if (breakpoint === 'base') return { ...style.base };
  if (breakpoint === 'tablet') return { ...style.base, ...style.tablet };
  return { ...style.base, ...style.tablet, ...style.mobile };
}

function declarations(style: ElementStyle, isFree = false): string[] {
  const rules: string[] = [];
  const add = (property: string, value: string) => rules.push(`${property}:${value} !important`);
  if (style.fontFamily) add('font-family', FONT_FAMILIES[style.fontFamily].css);
  if (style.fontSize !== undefined) add('font-size', `${style.fontSize}px`);
  if (style.fontWeight !== undefined) add('font-weight', String(style.fontWeight));
  if (style.fontStyle) add('font-style', style.fontStyle);
  if (style.color) add('color', style.color);
  if (style.lineHeight !== undefined) add('line-height', String(style.lineHeight));
  if (style.letterSpacing !== undefined) add('letter-spacing', `${style.letterSpacing}em`);
  if (style.textAlign) add('text-align', style.textAlign);
  if (style.textTransform) add('text-transform', style.textTransform);
  if (style.background) add('background', style.background);
  if (style.paddingY !== undefined) { add('padding-top', `${style.paddingY}px`); add('padding-bottom', `${style.paddingY}px`); }
  if (style.paddingX !== undefined) { add('padding-left', `${style.paddingX}px`); add('padding-right', `${style.paddingX}px`); }
  if (style.marginTop !== undefined) add('margin-top', `${style.marginTop}px`);
  if (style.marginBottom !== undefined) add('margin-bottom', `${style.marginBottom}px`);
  if (style.width) { add('width', `${style.width}px`); add('max-width', '100%'); }
  if (style.radius !== undefined) { add('border-radius', `${style.radius}px`); add('overflow', 'hidden'); }
  if (style.borderWidth !== undefined) add('border', `${style.borderWidth}px solid ${style.borderColor ?? 'currentColor'}`);
  else if (style.borderColor) add('border-color', style.borderColor);
  if (style.shadow) add('box-shadow', SHADOWS[style.shadow]);
  if (style.opacity !== undefined) add('opacity', String(style.opacity / 100));
  const transforms: string[] = [];
  if (style.x || style.y) transforms.push(`translate(${style.x ?? 0}px, ${style.y ?? 0}px)`);
  if (style.rotate) transforms.push(`rotate(${style.rotate}deg)`);
  if (style.scale !== undefined && style.scale !== 100) transforms.push(`scale(${style.scale / 100})`);
  if (transforms.length) add('transform', transforms.join(' '));
  if (style.zIndex !== undefined) {
    // Freely placed items are already positioned; others need it for z-index to work.
    if (!isFree) add('position', 'relative');
    add('z-index', String(style.zIndex));
  }
  if (style.posX !== undefined) add('left', `${style.posX}%`);
  if (style.posY !== undefined) add('top', `${style.posY}px`);
  if (style.widthPct !== undefined) add('width', `${style.widthPct}%`);
  if (style.heightPx !== undefined) add('height', `${style.heightPx}px`);
  if (style.hidden) add('display', 'none');
  return rules;
}

/** Rules for an image inside a freely placed item: fill the cropped box from the chosen focus. */
function imageDeclarations(style: ElementStyle): string[] {
  const rules: string[] = [];
  if (style.heightPx !== undefined) rules.push('height:100% !important', 'object-fit:cover !important');
  if (style.objectX !== undefined || style.objectY !== undefined) rules.push(`object-position:${style.objectX ?? 50}% ${style.objectY ?? 50}% !important`);
  return rules;
}

/** Inline elements can't be moved, sized or padded until they become inline blocks. */
const needsBlockBox = (style: ElementStyle) =>
  Boolean(style.x || style.y || style.rotate || (style.scale !== undefined && style.scale !== 100) || style.width
    || style.paddingX !== undefined || style.paddingY !== undefined || style.background || style.borderWidth !== undefined);

/** One stylesheet for every styled element; empty string when nothing was styled. */
export function compileStyleMap(map: StyleMap): string {
  const chunks: Record<Breakpoint, string[]> = { base: [], tablet: [], mobile: [] };
  for (const [id, responsive] of Object.entries(map)) {
    if (!ID.test(id)) continue;
    for (const breakpoint of BREAKPOINTS) {
      const style = responsive[breakpoint];
      if (!style) continue;
      const body = declarations(style, id.startsWith('free.'));
      if (!body.length) continue;
      const selector = `[data-el="${id}"]`;
      chunks[breakpoint].push(`${selector}{${body.join(';')}}`);
      const imageBody = imageDeclarations(style);
      if (imageBody.length) chunks[breakpoint].push(`${selector} > img{${imageBody.join(';')}}`);
      if (needsBlockBox(style) && !style.hidden) chunks[breakpoint].push(`span${selector}{display:inline-block !important}`);
    }
  }
  return [
    chunks.base.join('\n'),
    chunks.tablet.length ? `@media (max-width:${BREAKPOINT_MAX.tablet}px){${chunks.tablet.join('\n')}}` : '',
    chunks.mobile.length ? `@media (max-width:${BREAKPOINT_MAX.mobile}px){${chunks.mobile.join('\n')}}` : '',
  ].filter(Boolean).join('\n');
}
