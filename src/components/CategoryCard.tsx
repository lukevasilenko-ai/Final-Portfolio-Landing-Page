/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useId } from 'react';
import { ArrowUpRight } from 'lucide-react';

/** The three original categories have their own artwork; any category added later uses "other". */
export type CategoryCardKind = 'posters' | 'branding' | 'billboards' | 'other';

const CREAM = '#f2efe9';
const MINT = '#9fcbb8';

export const CATEGORY_CARD_LABELS: Record<Exclude<CategoryCardKind, 'other'>, string> = {
  posters: 'პოსტერები',
  branding: 'ბრენდინგი',
  billboards: 'ბილბორდები',
};

export const categoryCardKind = (categoryId: string): CategoryCardKind =>
  categoryId === 'product-posters' ? 'posters'
    : categoryId === 'branding' ? 'branding'
      : categoryId === 'billboards-print' ? 'billboards'
        : 'other';

/** Lettering size and tilt per word, tuned so each sits inside its hand-drawn marks. */
const WORD_STYLE: Record<CategoryCardKind, { size: string; rotate: string; top: string }> = {
  posters: { size: '16.5cqw', rotate: '-4deg', top: '49%' },
  branding: { size: '13.5cqw', rotate: '-2.5deg', top: '50%' },
  billboards: { size: '10.5cqw', rotate: '-1.5deg', top: '48%' },
  other: { size: '14cqw', rotate: '-3deg', top: '49%' },
};

/** A category's own name, sized to fit the card whatever its length. */
const otherWordSize = (word: string) => `${Math.max(7, Math.min(16, 130 / Math.max(1, word.length)))}cqw`;

const line = {
  fill: 'none',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  pathLength: 1,
};

/** Hand-drawn marks (viewBox 0 0 200 200); each path draws itself in, staggered by --d. */
function Marks({ kind }: { kind: CategoryCardKind }) {
  if (kind === 'posters' || kind === 'other') {
    return (
      <g className="cc-draw">
        <path {...line} style={{ ['--d' as string]: '0.45s' }} stroke={CREAM} strokeWidth={2.2} d="M50 129 C 64 122, 78 135, 94 128 S 124 120, 139 127 S 151 131, 155 127" />
        <path {...line} style={{ ['--d' as string]: '0.6s' }} stroke={MINT} strokeWidth={1.5} d="M64 138 C 84 134, 108 141, 134 136" />
        <path {...line} style={{ ['--d' as string]: '0.7s' }} stroke={CREAM} strokeWidth={1.7} d="M154 52 L156.6 60.4 L165 63 L156.6 65.4 L154 74 L151.4 65.4 L143 63 L151.4 60.4 Z" />
        <path {...line} style={{ ['--d' as string]: '0.8s' }} stroke={MINT} strokeWidth={1.4} d="M46 70 L47.7 75.3 L53 77 L47.7 78.7 L46 84 L44.3 78.7 L39 77 L44.3 75.3 Z" />
      </g>
    );
  }

  if (kind === 'branding') {
    return (
      <g className="cc-draw">
        <path {...line} style={{ ['--d' as string]: '0.4s' }} stroke={CREAM} strokeWidth={2} d="M32 106 C 28 78, 72 63, 107 63 C 153 64, 177 82, 173 106 C 169 131, 124 141, 92 139 C 54 137, 26 124, 31 98 C 34 86, 43 78, 55 72" />
        <path {...line} style={{ ['--d' as string]: '0.75s' }} stroke={MINT} strokeWidth={1.7} d="M166 164 C 161 156, 156 150, 149 143 M149 143 l0.6 8.4 M149 143 l8 2.6" />
        <path {...line} style={{ ['--d' as string]: '0.85s' }} stroke={CREAM} strokeWidth={1.5} d="M156 42 v11 M150.5 47.5 h11 M152 43.5 l8 8 M160 43.5 l-8 8" />
      </g>
    );
  }

  return (
    <g className="cc-draw">
      <path {...line} style={{ ['--d' as string]: '0.35s' }} stroke={CREAM} strokeWidth={2} d="M34 70 L166 66 L168 128 L35 132 Z" />
      <path {...line} style={{ ['--d' as string]: '0.6s' }} stroke={CREAM} strokeWidth={2} d="M68 132 L66.5 162 M134 129.5 L135.5 162" />
      <path {...line} style={{ ['--d' as string]: '0.75s' }} stroke={MINT} strokeWidth={1.5} d="M44 164 C 80 161, 122 166, 158 162" />
      <path {...line} style={{ ['--d' as string]: '0.85s' }} stroke={MINT} strokeWidth={1.5} d="M92 63 l-2.5 -9 M107 62 l1.5 -9 M122 61 l5 -7.5" />
    </g>
  );
}

/**
 * Square brand-green category card on a designer's artboard grid: hand-lettered word that
 * "writes" itself in, hand-drawn marks that draw on, trim marks around the lettering, and
 * small typographic details (index, count, arrow). Sizes use container query units so the
 * card works from thumbnail to large preview.
 */
export default function CategoryCard({
  kind,
  index,
  countLabel,
  label = '',
  drawn = true,
  radius = 22,
  className = '',
}: {
  kind: CategoryCardKind;
  index: number;
  countLabel: string;
  /** The category's name, lettered on cards of kind "other". */
  label?: string;
  drawn?: boolean;
  radius?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const text = kind === 'other' ? label : CATEGORY_CARD_LABELS[kind];
  const word = kind === 'other' ? { ...WORD_STYLE.other, size: otherWordSize(text) } : WORD_STYLE[kind];

  return (
    <span
      className={`cc-card${drawn ? ' is-drawn' : ''} ${className}`}
      style={{ borderRadius: radius }}
      aria-hidden="true"
    >
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 200">
        <defs>
          <pattern id={`grid-${uid}`} width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M10 0H0V10" fill="none" stroke={CREAM} strokeWidth="0.35" opacity="0.08" />
          </pattern>
          <filter id={`grain-${uid}`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
        </defs>
        <rect width="200" height="200" fill={`url(#grid-${uid})`} />
        <path d="M50 0V200M100 0V200M150 0V200M0 50H200M0 100H200M0 150H200" stroke={CREAM} strokeWidth="0.4" opacity="0.1" />
        <path d="M24 52V40H36M164 40H176V52M24 148V160H36M164 160H176V148" fill="none" stroke={MINT} strokeWidth="0.9" opacity="0.65" />
        <Marks kind={kind} />
        <rect width="200" height="200" filter={`url(#grain-${uid})`} opacity="0.07" />
      </svg>

      <span className="cc-meta cc-meta-top">
        <span className="tabular-nums">{String(index + 1).padStart(2, '0')}</span>
        <span>კატეგორია</span>
      </span>

      <span
        className="cc-word"
        style={{ top: word.top, fontSize: word.size, ['--r' as string]: word.rotate }}
      >
        {text}
      </span>

      <span className="cc-meta cc-meta-bottom">
        <span>{countLabel}</span>
        <span className="cc-arrow"><ArrowUpRight /></span>
      </span>
    </span>
  );
}
