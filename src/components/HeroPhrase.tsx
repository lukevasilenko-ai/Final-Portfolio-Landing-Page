/**
 * The hero's statement: „ვქმნი [poster] დიზაინს, / რომელიც [poster] / ყიდის.“
 *
 * - The lines rise out of a blur one after another when the page opens; the poster chips pop in.
 * - The last word cycles (ყიდის → ჩანს → ახსოვთ → მუშაობს), in the site's accent colour. A
 *   hand-drawn line under it is the clock: it draws itself while the word stays, wipes away,
 *   and the word changes letter by letter (the old one lifts out, the new one rises in, the box
 *   eases to the new width). A small counter (01/04) follows along.
 * - With every word both chips slide to the next poster, one just after the other.
 * - The chips and the word drift a few pixels toward the pointer; pointing at the statement
 *   pauses it, a click on the word moves on.
 * Reduced-motion visitors and the visual editor get it still. The words come from the hero's
 * title fields (see heroPhraseCopy), editable in the editor's side panel, where the block can
 * also be dragged and sized inside the hero.
 */
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { STATIC_STRIP_POSTERS } from './WorkStrip';
import { useEditable } from '../websiteSections/EditableText';
import { useNativeSectionId } from '../websiteSections/NativeElements';
import type { WebsiteCopy } from '../websiteSections/copy';
import { PHRASE_KEYS, phraseLine, phraseWords } from './heroPhraseCopy';
import './hero-phrase.css';

/** The lighter bundled posters (all under 400 KB), so the first screen stays quick. */
const POSTERS = ['15_result', '2_result', '9_result', '14_result', '16_result', '11_result']
  .map((name) => STATIC_STRIP_POSTERS.find((poster) => poster.key === `static:${name}`)?.src)
  .filter((src): src is string => Boolean(src));

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (value: number) => Math.max(-1, Math.min(1, value));
const pad = (value: number) => String(value).padStart(2, '0');

/** Pointer position over the element as --lx / --ly (-1…1 around its middle), eased; back to 0 at rest. */
function usePointerGlide(active: boolean) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!active || !element) return undefined;
    let lx = 0, ly = 0, tx = 0, ty = 0, lastMove = -Infinity, frame = 0, visible = true;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return;
      const box = element.getBoundingClientRect();
      tx = clamp((event.clientX - (box.left + box.width / 2)) / (box.width / 2));
      ty = clamp((event.clientY - (box.top + box.height / 2)) / (box.height / 2));
      lastMove = performance.now();
    };
    const tick = (now: number) => {
      if (now - lastMove > 2500) { tx = 0; ty = 0; }
      const nx = lx + (tx - lx) * 0.07;
      const ny = ly + (ty - ly) * 0.07;
      if (Math.abs(nx - lx) > 0.0005 || Math.abs(ny - ly) > 0.0005) {
        lx = nx; ly = ny;
        element.style.setProperty('--lx', lx.toFixed(3));
        element.style.setProperty('--ly', ly.toFixed(3));
      }
      frame = visible ? requestAnimationFrame(tick) : 0;
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame) frame = requestAnimationFrame(tick);
    });
    observer.observe(element);
    window.addEventListener('pointermove', onMove, { passive: true });
    frame = requestAnimationFrame(tick);
    return () => {
      observer.disconnect();
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(frame);
    };
  }, [active]);
  return ref;
}

/** A pill-shaped poster between the words; on each step it slides to the next poster. */
function Chip({ step, offset, tilt, motion }: { step: number; offset: number; tilt: number; motion: boolean }) {
  const poster = (at: number) => POSTERS[(at * 2 + offset) % POSTERS.length];
  return (
    <span className="hero-chip" style={{ '--tilt': `${tilt}deg`, '--delay': `${offset * 110}ms` } as CSSProperties} aria-hidden="true">
      {motion && step > 0 && <img key={`out-${step}`} className="is-out" src={poster(step - 1)} alt="" decoding="async" />}
      <img key={`in-${step}`} className={motion && step > 0 ? 'is-in' : undefined} src={poster(step)} alt="" decoding="async" />
    </span>
  );
}

/** A word split into letters, for the letter-by-letter change. */
function Letters({ text, state }: { text: string; state: 'in' | 'out' | 'still' }) {
  return (
    <span className={`hero-turn-word is-${state}`} aria-hidden="true">
      {[...text].map((letter, index) => (
        <span key={index} style={{ '--c': index } as CSSProperties}>{letter === ' ' ? ' ' : letter}</span>
      ))}
    </span>
  );
}

/** The changing last word, its timing line and its width easing. */
function Turn({ words, step, motion, onNext }: { words: string[]; step: number; motion: boolean; onNext: () => void }) {
  const index = step % words.length;
  const previous = step > 0 ? (step - 1) % words.length : null;
  const sizer = useRef<HTMLSpanElement>(null);
  const [widths, setWidths] = useState<number[]>([]);
  const signature = words.join('|');
  useLayoutEffect(() => {
    const element = sizer.current;
    if (!element) return undefined;
    const measure = () => setWidths([...element.querySelectorAll<HTMLElement>(':scope > span')].map((child) => child.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [signature]);
  const width = widths[index];
  return (
    <span
      className={`hero-turn${motion ? ' is-live' : ''}`}
      style={width ? { width: `${Math.ceil(width)}px` } : undefined}
      onClick={motion ? onNext : undefined}
    >
      <span ref={sizer} className="hero-turn-sizer" aria-hidden="true">
        {words.map((word, at) => <span key={at}>{word}</span>)}
      </span>
      {/* Keyed by step, so each change starts its animation afresh. */}
      {motion && previous !== null && previous !== index && (
        <Fragment key={`out-${step}`}><Letters text={words[previous]} state="out" /></Fragment>
      )}
      <Fragment key={`in-${step}`}><Letters text={words[index]} state={motion && step > 0 ? 'in' : 'still'} /></Fragment>
      <svg
        key={`line-${step}`}
        className={`hero-turn-line${motion ? ' is-timing' : ''}`}
        viewBox="0 0 200 16"
        preserveAspectRatio="none"
        aria-hidden="true"
        onAnimationEnd={motion ? onNext : undefined}
      >
        <path d="M3 11 C 45 4, 95 3, 140 6 S 188 10, 197 5" pathLength={1} />
      </svg>
    </span>
  );
}

export default function HeroPhrase({ content }: { content?: WebsiteCopy }) {
  const sectionId = useNativeSectionId();
  const editable = useEditable('hero.lettering', 'item', 'მთავარი ფრაზა', [
    'hide', 'move', ...(sectionId ? PHRASE_KEYS.map((key) => `copy:${sectionId}.${key}`) : []),
  ]);
  const [line1, line2, line3] = PHRASE_KEYS.map((key) => phraseLine(key, content?.[key]));
  const words = phraseWords(line3);
  // Decided on the first render already, so the opening animation starts from the first frame.
  const motion = !editable.editing && !reducedMotion();
  const cycling = motion && words.length > 1;
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const glide = usePointerGlide(motion);
  const sentence = `${line1} ${line2} ${words[0]}`;
  if (editable.gone) return <span className="sr-only">{sentence}</span>;

  const [first, ...rest] = line1.split(' ');
  const next = () => setStep((current) => current + 1);
  return (
    <span
      {...editable.attrs}
      {...(editable.editing ? { 'data-edit-movable': 'true', 'data-edit-bounds': 'contain' } : {})}
      className="hero-phrase-block"
    >
      <span
        ref={glide}
        className={`hero-phrase${motion ? ' is-moving' : ''}${paused ? ' is-paused' : ''}`}
        onPointerEnter={(event) => { if (event.pointerType === 'mouse') setPaused(true); }}
        onPointerLeave={() => setPaused(false)}
      >
        <span className="sr-only">{sentence}</span>
        <span className="hero-phrase-line" aria-hidden="true" style={{ '--line': 0 } as CSSProperties}>
          {first} <Chip step={step} offset={0} tilt={-5} motion={cycling} />{rest.length > 0 && ` ${rest.join(' ')}`}
        </span>
        <span className="hero-phrase-line" aria-hidden="true" style={{ '--line': 1 } as CSSProperties}>
          {line2} <Chip step={step} offset={1} tilt={6} motion={cycling} />
        </span>
        <span className="hero-phrase-line is-last" aria-hidden="true" style={{ '--line': 2 } as CSSProperties}>
          <Turn words={words} step={step} motion={cycling} onNext={next} />
          {words.length > 1 && (
            <span className="hero-turn-count" aria-hidden="true">
              <span key={step % words.length} className={cycling && step > 0 ? 'is-in' : undefined}>{pad((step % words.length) + 1)}</span>
              <span>/{pad(words.length)}</span>
            </span>
          )}
        </span>
      </span>
      {editable.editing && <>
        <span className="site-free-handle is-rotate" data-free-handle="rotate" aria-hidden="true" />
        <span className="site-free-handle is-resize" data-free-handle="resize" aria-hidden="true" />
      </>}
    </span>
  );
}
