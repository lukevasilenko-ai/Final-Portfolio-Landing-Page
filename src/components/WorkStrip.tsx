/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { PORTFOLIO_ITEMS } from '../data/catalogImages';
import { PORTFOLIO_CATEGORIES } from '../data/portfolioItems';
import { loadStripWorks, usePosterWorks, type StripWork } from '../data/stripWorks';
import { navigateWithinSite } from '../navigation';
import { useWebsiteEditorRuntime } from '../websiteSections/EditorRuntime';
import { useSiteElements } from '../SiteProfileContext';

// Bundled fallback (local preview, or if the live catalogue can't be read): square product
// posters, lighter files first so the first screen stays fast.
const SQUARE_POSTERS = ['15_result', '2_result', '9_result', '1_result', '14_result', '16_result', '11_result', '5(2)', '3_result', '13_result', '6(1)', '18_result', '8_result'];

const PIXELS_PER_SECOND = 28;
/** Empty tiles shown for the moment the live list is loading. */
const PLACEHOLDERS = 8;

interface StripItem {
  key: string;
  src: string;
  href: string;
  label: string;
}

const fileBase = (filename?: string) => (filename ?? '').replace(/\.[^.]+$/, '');

const postersHref = `/portfolio/${PORTFOLIO_CATEGORIES.find((category) => category.id === 'product-posters')?.slug ?? ''}`;

/** Every bundled product poster, keyed "static:<file name>" (also offered in the editor's picker). */
export const STATIC_STRIP_POSTERS = PORTFOLIO_ITEMS
  .filter((item) => item.category === 'product-posters' && item.filename)
  .map((item) => ({ key: `static:${fileBase(item.filename)}`, src: item.image, label: item.title }));

export const DEFAULT_STRIP_KEYS = SQUARE_POSTERS.map((name) => `static:${name}`);

/**
 * What the strip shows when nothing was chosen in the editor: the live posters category (every
 * published poster, in the admin's order), or the bundled set where that isn't available.
 * `loading` is true while the live list is on its way.
 */
export function useDefaultStripKeys() {
  const posters = usePosterWorks();
  const keys = useMemo(
    () => (posters.works?.length ? posters.works.map((work) => `work:${work.id}`) : DEFAULT_STRIP_KEYS),
    [posters.works],
  );
  const works = useMemo(() => new Map((posters.works ?? []).map((work) => [work.id, work])), [posters.works]);
  return { keys, works, loading: posters.loading };
}

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
 * A fresh angle and height for a poster about to rise: turned 2.5–6.5° to one side or the
 * other at random, so no two lifts look alike.
 */
const stripItemOf = (target: EventTarget | null) =>
  target instanceof HTMLElement ? target.closest('.work-strip-item') as HTMLElement | null : null;

function pickLift(item: HTMLElement) {
  const side = Math.random() < 0.5 ? -1 : 1;
  item.style.setProperty('--lift-rot', `${(side * (2.5 + Math.random() * 4)).toFixed(2)}deg`);
  item.style.setProperty('--lift-y', `${(-(18 + Math.random() * 8)).toFixed(1)}px`);
}

/**
 * A slow, grey, endlessly drifting row of posters, tilted slightly on a diagonal. It settles to
 * a stop under the pointer (or keyboard focus), where the poster you point at springs out of
 * the slope in its real colours, turned a little to a random side (pickLift), leans in 3D after
 * the pointer, a streak of light sweeps across it, its neighbours lean away and a glow of its
 * own colours rises behind it (site.css). It eases back when the pointer leaves,
 * pauses while off screen, and stays still for reduced-motion users. `lead(copy)` renders
 * first (the editable hero artwork); the set is drawn twice for a seamless loop. By default it
 * shows the posters category as it is in the admin (new uploads appear on their own); a fixed
 * selection can be made in the admin's visual editor instead. Posters keep their own shape.
 */
export default function WorkStrip({ lead }: { lead?: (copy: boolean) => ReactNode }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const holdRef = useRef(false);
  const liftedRef = useRef<HTMLElement | null>(null);
  // Each poster keeps its own shape (width ÷ height, read once it loads); all are the same height.
  const [ratios, setRatios] = useState<ReadonlyMap<string, number>>(() => new Map());
  const [works, setWorks] = useState<Map<string, StripWork>>(() => new Map());
  // Inside the admin's visual editor the strip stands still, so nothing moves under the cursor.
  const { enabled: editing } = useWebsiteEditorRuntime();
  const elements = useSiteElements();
  const fallback = useDefaultStripKeys();
  const keys = elements.strip ?? fallback.keys;
  const waiting = !elements.strip && fallback.loading;

  const workIds = useMemo(
    () => keys.filter((key) => key.startsWith('work:') && !fallback.works.has(key.slice(5))).map((key) => key.slice(5)),
    [keys, fallback.works],
  );
  useEffect(() => {
    if (!workIds.length) return;
    let active = true;
    void loadStripWorks(workIds).then((loaded) => { if (active) setWorks(loaded); }).catch(() => undefined);
    return () => { active = false; };
  }, [workIds]);

  // `slot` is the position in the list, which the editor uses to move/replace/remove.
  const items = useMemo(() => keys.flatMap((key, slot): (StripItem & { slot: number })[] => {
    if (key.startsWith('static:')) {
      const poster = STATIC_STRIP_POSTERS.find((item) => item.key === key);
      return poster ? [{ key, slot, src: poster.src, href: postersHref, label: poster.label }] : [];
    }
    const id = key.slice(5);
    const poster = fallback.works.get(id);
    const work = poster ?? works.get(id);
    // A poster opens its category; a work picked from elsewhere opens the full catalogue.
    return work ? [{ key, slot, src: work.url, href: poster ? postersHref : '/portfolio', label: work.title }] : [];
  }), [keys, works, fallback.works]);

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

  // Pictures load only as they come near the visible part of the strip (the browser's own lazy
  // loading doesn't hold back inside a moving, clipped row, and posters can be large files).
  const [near, setNear] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setNear(new Set(items.map((item) => item.key)));
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      const keys = entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => (entry.target as HTMLElement).dataset.stripKey)
        .filter((key): key is string => Boolean(key));
      if (!keys.length) return;
      setNear((current) => {
        if (keys.every((key) => current.has(key))) return current;
        const next = new Set(current);
        keys.forEach((key) => next.add(key));
        return next;
      });
    }, { root: viewport, rootMargin: '0px 480px' });
    viewport.querySelectorAll<HTMLElement>('[data-strip-key]').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [items]);

  const noteRatio = (key: string, image: HTMLImageElement) => {
    if (!image.naturalWidth || !image.naturalHeight) return;
    // Within 2% of square counts as square; anything else between portrait 1:2 and landscape 2:1.
    const raw = image.naturalWidth / image.naturalHeight;
    const ratio = Math.abs(raw - 1) < 0.02 ? 1 : Math.max(0.5, Math.min(2, raw));
    setRatios((current) => (current.get(key) === ratio ? current : new Map(current).set(key, ratio)));
  };

  const renderSet = (copy: boolean) => (
    <div className="work-strip-set" aria-hidden={copy || undefined}>
      {lead?.(copy)}
      {waiting && Array.from({ length: PLACEHOLDERS }, (_, index) => (
        <span key={`wait-${index}`} className="work-strip-item is-placeholder" aria-hidden="true" />
      ))}
      {items.map((item) => {
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
            data-strip-key={item.key}
            className="work-strip-item"
            style={{ ...(near.has(item.key) ? posterStyle(item.src) : {}), '--ratio': ratios.get(item.key) ?? 1 } as CSSProperties}
            aria-hidden={copy || undefined}
            tabIndex={copy ? -1 : undefined}
            aria-label={copy ? undefined : item.label}
          >
            {near.has(item.key) && (
              <img
                src={item.src}
                alt=""
                decoding="async"
                fetchPriority="low"
                onLoad={(event) => noteRatio(item.key, event.currentTarget)}
              />
            )}
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
      onPointerLeave={() => { holdRef.current = false; liftedRef.current = null; }}
      onPointerOver={(event) => {
        // Entering a new poster: give it its own random turn before it rises.
        const item = stripItemOf(event.target);
        if (item && item !== liftedRef.current) { liftedRef.current = item; pickLift(item); }
        followPointer(event);
      }}
      onFocus={(event) => {
        const item = stripItemOf(event.target);
        if (item) pickLift(item);
        holdRef.current = true;
      }}
      onPointerMove={followPointer}
      onBlur={() => { holdRef.current = false; }}
    >
      <div ref={trackRef} className="work-strip-track">
        {renderSet(false)}
        {renderSet(true)}
      </div>
    </div>
  );
}
