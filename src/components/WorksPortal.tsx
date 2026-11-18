/**
 * The hero's works button („ტიკერი“) and the transition it opens.
 *
 * Button: a wide, slightly tilted pill whose words run slowly sideways like a news ticker, with a
 * round arrow at the end. It leans toward the pointer (magnetic), straightens on hover, and three
 * posters fan out from behind it.
 *
 * Transition (about 2.6 s): an accent circle opens from where it was pressed, with the dark cover
 * a beat behind it; posters fan out and float, the number of works counts up and the word
 * „ნამუშევრები“ rises letter by letter out of a blur, over a line with a passing shine.
 * Underneath, the site opens the destination (the full catalogue by default) and, once it has
 * loaded, both layers lift away upward with a curved edge. A click on the cover skips ahead. The
 * cover lives outside the page, so it carries on while the page changes. Reduced-motion visitors
 * go straight to the destination.
 */
import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowUpRight } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { DEFAULT_STRIP_KEYS, STATIC_STRIP_POSTERS } from './WorkStrip';
import { useHomeCategories } from '../data/homeCategories';
import { loadedPosterUrls } from '../data/stripWorks';
import { followSiteLink, isExternalLink, navigateWithinSite } from '../navigation';
import './works-portal.css';

const POSTERS = DEFAULT_STRIP_KEYS
  .map((key) => STATIC_STRIP_POSTERS.find((poster) => poster.key === key)?.src)
  .filter((src): src is string => Boolean(src))
  .slice(0, 5);

const WORD = 'ნამუშევრები';
/** The accent circle opens first; the dark one follows a beat behind it. */
const COVER_MS = 800;
const COVER_LAG_MS = 120;
/** Shortest time the covered screen stays, and how long to wait at most for the page beneath. */
const HOLD_MS = 900;
const READY_WAIT_MS = 2500;
/** The dark layer lifts away with a curved edge; the accent one follows just after. */
const REVEAL_MS = 800;
const REVEAL_LAG_MS = 100;

type Phase = 'cover' | 'hold' | 'reveal';

interface PortalOptions {
  x: number;
  y: number;
  /** Opens the destination while the screen is covered. */
  go: () => void;
  /** True once the destination is ready to be shown. */
  ready: () => boolean;
}

/** A number that counts up from 0 (eased), after a short wait. */
function CountUp({ to, delay, duration }: { to: number; delay: number; duration: number }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!to) return undefined;
    let frame = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const progress = Math.max(0, Math.min(1, (now - start) / duration));
      setValue(Math.round(to * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, delay, duration]);
  return <span className="works-portal-count">{value}</span>;
}

function PortalOverlay({ x, y, go, ready, onDone }: PortalOptions & { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('cover');
  const categories = useHomeCategories();
  const total = categories.reduce((sum, category) => sum + category.count, 0);
  // The posters category as on the site (if it has loaded), else the bundled posters.
  const [posters] = useState(() => {
    const live = loadedPosterUrls();
    return (live.length >= 3 ? live : POSTERS).slice(0, 5);
  });
  const ring = useRef<HTMLDivElement>(null);
  const cover = useRef<HTMLDivElement>(null);
  const growth = useRef<Animation[]>([]);
  const timers = useRef<number[]>([]);
  const finished = useRef(false);

  // Both circles grow from the press point to the farthest corner (exact pixels: keyframes with
  // CSS variables don't animate in every browser).
  useLayoutEffect(() => {
    const radius = Math.ceil(Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))) + 2;
    const frames = [{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${radius}px at ${x}px ${y}px)` }];
    const animations: Animation[] = [];
    if (typeof ring.current?.animate === 'function') {
      animations.push(ring.current.animate(frames, { duration: COVER_MS - COVER_LAG_MS, easing: 'cubic-bezier(0.65, 0, 0.3, 1)', fill: 'forwards' }));
    }
    if (typeof cover.current?.animate === 'function') {
      animations.push(cover.current.animate(frames, { duration: COVER_MS - COVER_LAG_MS, delay: COVER_LAG_MS, easing: 'cubic-bezier(0.7, 0, 0.2, 1)', fill: 'both' }));
    }
    growth.current = animations;
    return () => animations.forEach((animation) => animation.cancel());
  }, [x, y]);
  // Once covered, the stylesheet holds the layers (and later lifts them); the circles' finished
  // animations are dropped only after that is on screen, so nothing flickers in between.
  useLayoutEffect(() => {
    if (phase !== 'cover') growth.current.forEach((animation) => animation.cancel());
  }, [phase]);

  const finish = (after: number) => {
    timers.current.push(window.setTimeout(() => {
      if (!finished.current) { finished.current = true; onDone(); }
    }, after));
  };

  useEffect(() => {
    const list = timers.current;
    const at = (ms: number, run: () => void) => { list.push(window.setTimeout(run, ms)); };
    const reveal = () => { setPhase('reveal'); finish(REVEAL_MS + REVEAL_LAG_MS); };
    // Covered: open the destination underneath, give it a moment, then wait until it's ready.
    at(COVER_MS, () => {
      setPhase('hold');
      go();
      const shownAt = Date.now();
      const check = () => {
        const waited = Date.now() - shownAt;
        if ((waited >= HOLD_MS && ready()) || waited >= HOLD_MS + READY_WAIT_MS) reveal();
        else at(100, check);
      };
      at(HOLD_MS, check);
    });
    return () => { list.forEach((timer) => window.clearTimeout(timer)); list.length = 0; };
  }, []); // one timeline per opening (go/ready are fixed for it)

  const skip = () => {
    if (phase !== 'hold') return;
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current.length = 0;
    setPhase('reveal');
    finish(REVEAL_MS + REVEAL_LAG_MS);
  };

  // Closed until the circles open them (only while opening; then the stylesheet takes over).
  const closed = phase === 'cover' ? { clipPath: `circle(0px at ${x}px ${y}px)` } : undefined;
  return (
    <>
      <div ref={ring} className={`works-portal-ring is-${phase}`} style={closed} aria-hidden="true" />
      <div ref={cover} className={`works-portal is-${phase}`} style={closed} onClick={skip} aria-hidden="true">
        <div className="works-portal-inner">
          <div className="works-portal-fan">
            {posters.map((src, index) => (
              <span key={src} style={{ '--i': index - (posters.length - 1) / 2, '--n': index } as CSSProperties}>
                <img src={src} alt="" />
              </span>
            ))}
          </div>
          <p className="works-portal-kicker">
            {total > 0
              ? <><CountUp to={total} delay={450} duration={900} /> ნამუშევარი · {categories.length} კატეგორია</>
              : 'პორტფოლიო'}
          </p>
          <p className="works-portal-word">
            {[...WORD].map((letter, index) => (
              <span key={index} style={{ '--d': index } as CSSProperties}>{letter}</span>
            ))}
          </p>
          <span className="works-portal-line" />
        </div>
      </div>
    </>
  );
}

/** Plays the transition in its own layer on top of the site (it survives page changes). */
function openWorksPortal(options: PortalOptions) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  root.render(<PortalOverlay {...options} onDone={() => { root.unmount(); host.remove(); }} />);
}

const portalOpen = () => Boolean(document.querySelector('.works-portal'));

export default function ExploreWorksButton({ href, attrs, editing, plainLabel, children }: {
  href: string;
  /** Visual-editor attributes for the button (data-el, data-edit-*). */
  attrs: Record<string, string>;
  editing: boolean;
  /** The label as plain text, for the running words and the screen-reader name. */
  plainLabel: string;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion() ?? false;
  const external = isExternalLink(href);

  const lean = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    if (event.pointerType !== 'mouse' || reduceMotion) return;
    const box = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty('--mx', String(Math.round((event.clientX - box.left - box.width / 2) * 0.18)));
    event.currentTarget.style.setProperty('--my', String(Math.round((event.clientY - box.top - box.height / 2) * 0.22)));
  };
  const settle = (event: ReactPointerEvent<HTMLAnchorElement>) => {
    event.currentTarget.style.setProperty('--mx', '0');
    event.currentTarget.style.setProperty('--my', '0');
  };

  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    if (editing) return;
    if (external) return; // a link elsewhere opens normally (new tab)
    const inPage = href.startsWith('#') ? document.getElementById(decodeURIComponent(href.slice(1))) : null;
    const inSite = href.startsWith('/') && !href.startsWith('//');
    if (reduceMotion || (!inPage && !inSite) || portalOpen()) {
      if (followSiteLink(href)) event.preventDefault();
      return;
    }
    event.preventDefault();
    const box = event.currentTarget.getBoundingClientRect();
    // From where it was pressed (or the button's middle, for keyboard).
    const x = event.detail > 0 ? event.clientX : box.left + box.width / 2;
    const y = event.detail > 0 ? event.clientY : box.top + box.height / 2;
    openWorksPortal(inPage ? {
      x, y,
      go: () => inPage.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'start' }),
      ready: () => true,
    } : {
      x, y,
      go: () => navigateWithinSite(href, 'instant' as ScrollBehavior),
      ready: () => Boolean(document.querySelector('.catalog-tile, .catalog-filter')) || !href.startsWith('/portfolio'),
    });
  };

  return (
    <a
      {...attrs}
      href={href}
      onClick={open}
      onPointerMove={lean}
      onPointerLeave={settle}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className="works-btn"
      aria-label={plainLabel}
    >
      {/* Three posters wait behind the button and fan out above it on hover. */}
      <span className="works-cta-peek" aria-hidden="true">
        {POSTERS.slice(0, 3).map((src) => <img key={src} src={src} alt="" loading="lazy" decoding="async" />)}
      </span>
      {/* The words run sideways through the pill (two copies, so the loop has no seam). */}
      <span className="works-ticker-window" aria-hidden="true">
        <span className="works-ticker-track">
          {[0, 1].map((copy) => (
            <span key={copy} className="works-ticker-run">
              {plainLabel}<i>✦</i>ყველა ნამუშევარი<i>✦</i>
            </span>
          ))}
        </span>
      </span>
      <span className="works-ticker-go" aria-hidden="true"><ArrowUpRight /></span>
      {/* The label itself: read aloud on the site; shown (and editable) in the visual editor. */}
      <span className={editing ? 'works-badge-label' : 'sr-only'}>{children}</span>
    </a>
  );
}
