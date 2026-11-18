/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { PORTFOLIO_ITEMS } from '../data/catalogImages';
import { PORTFOLIO_CATEGORIES } from '../data/portfolioItems';
import { loadStripWorks, type StripWork } from '../data/stripWorks';
import { navigateWithinSite } from '../navigation';
import { useWebsiteEditorRuntime } from '../websiteSections/EditorRuntime';
import { useSiteElements } from '../SiteProfileContext';

// Square (1:1) product posters only, lighter files first so the first screen stays fast.
// Any bundled image that turns out not to be square is hidden at runtime (see onLoad below).
const SQUARE_POSTERS = ['15_result', '2_result', '9_result', '1_result', '14_result', '16_result', '11_result', '5(2)', '3_result', '13_result', '6(1)', '18_result', '8_result'];

const PIXELS_PER_SECOND = 28;

interface StripItem {
  key: string;
  src: string;
  href: string;
  label: string;
  /** Bundled defaults are checked for squareness; works chosen in the editor are always shown. */
  checkSquare: boolean;
}

const fileBase = (filename?: string) => (filename ?? '').replace(/\.[^.]+$/, '');

const postersHref = `/portfolio/${PORTFOLIO_CATEGORIES.find((category) => category.id === 'product-posters')?.slug ?? ''}`;

/** Every bundled product poster, keyed "static:<file name>" (also offered in the editor's picker). */
export const STATIC_STRIP_POSTERS = PORTFOLIO_ITEMS
  .filter((item) => item.category === 'product-posters' && item.filename)
  .map((item) => ({ key: `static:${fileBase(item.filename)}`, src: item.image, label: item.title }));

export const DEFAULT_STRIP_KEYS = SQUARE_POSTERS.map((name) => `static:${name}`);

const isSquare = (image: HTMLImageElement) =>
  image.naturalWidth > 0 && Math.abs(image.naturalWidth / image.naturalHeight - 1) < 0.02;

/** The poster image as a CSS variable, for the coloured glow drawn behind it in site.css. */
export const posterStyle = (src: string) => ({ '--poster': `url(${JSON.stringify(src)})` }) as CSSProperties;

/** Where the pointer is on the poster (-0.5…0.5 each way), for the 3D tilt and its light. */
function followPointer(event: ReactPointerEvent<HTMLElement>) {
  if (event.pointerType !== 'mouse' || !(event.target instanceof HTMLElement)) return;
  const item = event.target.closest<HTMLElement>('.work-strip-item');
  if (!item) return;
  const box = event.target;
  const clamp = (value: number) => Math.max(-0.5, Math.min(0.5, value));
  item.style.setProperty('--mx', clamp(event.nativeEvent.offsetX / Math.max(1, box.offsetWidth) - 0.5).toFixed(3));
  item.style.setProperty('--my', clamp(event.nativeEvent.offsetY / Math.max(1, box.offsetHeight) - 0.5).toFixed(3));
}

/**
 * A slow, grey, endlessly drifting row of square posters, tilted slightly on a diagonal. It
 * settles to a stop under the pointer (or keyboard focus), where the poster you point at lifts
 * out of the slope in its real colours, leans in 3D after the pointer with a soft light on it
 * and a glow of its own colours behind it (site.css). It eases back when the pointer leaves,
 * pauses while off screen, and stays still for reduced-motion users. `lead(copy)` renders
 * first (the editable hero artwork); the set is drawn twice for a seamless loop. Which posters
 * appear can be changed in the admin's visual editor.
 */
export default function WorkStrip({ lead }: { lead?: (copy: boolean) => ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const holdRef = useRef(false);
  const [notSquare, setNotSquare] = useState<ReadonlySet<string>>(() => new Set());
  const [works, setWorks] = useState<Map<string, StripWork>>(() => new Map());
  // Inside the admin's visual editor the strip stands still, so nothing moves under the cursor.
  const { enabled: editing } = useWebsiteEditorRuntime();
  const elements = useSiteElements();
  const keys = elements.strip ?? DEFAULT_STRIP_KEYS;

  const workIds = useMemo(() => keys.filter((key) => key.startsWith('work:')).map((key) => key.slice(5)), [keys]);
  useEffect(() => {
    if (!workIds.length) return;
    let active = true;
    void loadStripWorks(workIds).then((loaded) => { if (active) setWorks(loaded); }).catch(() => undefined);
    return () => { active = false; };
  }, [workIds]);

  // `slot` is the position in the saved list, which the editor uses to move/replace/remove.
  const items = useMemo(() => keys.flatMap((key, slot): (StripItem & { slot: number })[] => {
    if (key.startsWith('static:')) {
      const poster = STATIC_STRIP_POSTERS.find((item) => item.key === key);
      return poster ? [{ key, slot, src: poster.src, href: postersHref, label: poster.label, checkSquare: true }] : [];
    }
    const work = works.get(key.slice(5));
    return work ? [{ key, slot, src: work.url, href: '/portfolio', label: work.title, checkSquare: false }] : [];
  }), [keys, works]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    if (editing) { track.style.transform = ''; return; }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let offset = 0;
    let speed = PIXELS_PER_SECOND;
    let last = performance.now();
    let frame = 0;
    let visible = true;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // Under the pointer it settles quickly (so the poster you aim at stays put); it picks
      // up again gently once the pointer leaves.
      const target = holdRef.current ? 0 : PIXELS_PER_SECOND;
      speed += (target - speed) * Math.min(1, dt * (holdRef.current ? 9 : 2.4));
      // One set's width (its trailing padding equals the gap), so the wrap is seamless.
      const loopWidth = (track.firstElementChild as HTMLElement | null)?.offsetWidth ?? 0;
      if (loopWidth > 0) {
        offset = (offset + speed * dt) % loopWidth;
        track.style.transform = `translate3d(${-offset}px, 0, 0)`;
      }
      frame = visible ? requestAnimationFrame(tick) : 0;
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) {
        last = performance.now();
        frame = requestAnimationFrame(tick);
      }
    });
    observer.observe(viewport);
    frame = requestAnimationFrame(tick);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [editing]);

  const markNotSquare = (key: string, image: HTMLImageElement) => {
    if (isSquare(image)) return;
    setNotSquare((current) => (current.has(key) ? current : new Set(current).add(key)));
  };

  const renderSet = (copy: boolean) => (
    <div className="work-strip-set" aria-hidden={copy || undefined}>
      {lead?.(copy)}
      {items.map((item) => {
        if (item.checkSquare && notSquare.has(item.key)) return null;
        // Only the first copy of the loop is editable; the editor needs the item's position.
        const editAttrs = editing && !copy ? {
          'data-el': `hero.strip.${item.slot}`,
          'data-edit-id': `hero.strip.${item.slot}`,
          'data-edit-kind': 'image',
          'data-edit-label': 'ნამუშევარი ზოლში',
          'data-edit-props': 'strip',
          'data-edit-strip-index': String(item.slot),
        } : { 'data-el': `hero.strip.${item.slot}` };
        return (
          <a
            key={`${copy ? 'b' : 'a'}-${item.key}-${item.slot}`}
            {...editAttrs}
            href={item.href}
            onClick={(event) => {
              event.preventDefault();
              navigateWithinSite(item.href);
            }}
            className="work-strip-item"
            style={posterStyle(item.src)}
            aria-hidden={copy || undefined}
            tabIndex={copy ? -1 : undefined}
            aria-label={copy ? undefined : item.label}
          >
            <img
              src={item.src}
              alt=""
              loading="lazy"
              decoding="async"
              onLoad={(event) => { if (item.checkSquare) markNotSquare(item.key, event.currentTarget); }}
            />
          </a>
        );
      })}
    </div>
  );

  return (
    <div
      ref={viewportRef}
      className="work-strip"
      onPointerEnter={() => { holdRef.current = true; }}
      onPointerLeave={() => { holdRef.current = false; }}
      onPointerOver={followPointer}
      onPointerMove={followPointer}
      onFocus={() => { holdRef.current = true; }}
      onBlur={() => { holdRef.current = false; }}
    >
      <div ref={trackRef} className="work-strip-track">
        {renderSet(false)}
        {renderSet(true)}
      </div>
    </div>
  );
}
