/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Images } from 'lucide-react';
import { PORTFOLIO_ITEMS, getPortfolioCategoryCount } from '../data/catalogImages';
import { PORTFOLIO_CATEGORIES } from '../data/portfolioItems';
import { navigateWithinSite } from '../navigation';
import type { PortfolioCategory, PortfolioItem } from '../types';

interface FeaturedEntry {
  category: PortfolioCategory;
  item: PortfolioItem;
  count: number;
  tone: 'accent' | 'copper' | 'plum';
}

const categoryTones: Record<string, FeaturedEntry['tone']> = {
  'product-posters': 'accent',
  branding: 'plum',
  'billboards-print': 'copper'
};

const featuredEntries = PORTFOLIO_CATEGORIES.reduce<FeaturedEntry[]>((entries, category) => {
  const categoryItems = PORTFOLIO_ITEMS.filter((item) => item.category === category.id);
  const item = categoryItems.find((candidate) => candidate.kind === 'project') ?? categoryItems[0];

  if (!item) return entries;

  entries.push({
    category,
    item,
    count: getPortfolioCategoryCount(category.id),
    tone: categoryTones[category.id] ?? 'accent'
  });
  return entries;
}, []);

const getCountLabel = (entry: FeaturedEntry) =>
  entry.category.id === 'branding'
    ? `${entry.count} პროექტი`
    : `${entry.count} ფოტო`;

export default function FeaturedWorkShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const activeEntry = featuredEntries[activeIndex];

  if (!activeEntry) return null;

  const showEntry = (index: number) => {
    const normalizedIndex = (index + featuredEntries.length) % featuredEntries.length;
    setActiveIndex(normalizedIndex);
  };

  const openActiveWork = () => {
    const { category, item } = activeEntry;
    const projectPath = item.kind === 'project' && item.projectSlug
      ? `/portfolio/${category.slug}/${item.projectSlug}`
      : `/portfolio/${category.slug}`;

    navigateWithinSite(projectPath);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (shouldReduceMotion || event.pointerType === 'touch') return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const y = Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));

    event.currentTarget.style.setProperty('--work-x', `${x * 100}%`);
    event.currentTarget.style.setProperty('--work-y', `${y * 100}%`);
    event.currentTarget.style.setProperty('--work-rotate-x', `${(0.5 - y) * 2.6}deg`);
    event.currentTarget.style.setProperty('--work-rotate-y', `${(x - 0.5) * 2.6}deg`);
  };

  const resetPointerPosition = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty('--work-x', '50%');
    event.currentTarget.style.setProperty('--work-y', '50%');
    event.currentTarget.style.setProperty('--work-rotate-x', '0deg');
    event.currentTarget.style.setProperty('--work-rotate-y', '0deg');
  };

  const stageStyle = {
    '--work-tone-rgb': `var(--brand-${activeEntry.tone}-rgb)`
  } as CSSProperties;

  return (
    <div className="surface-card-strong mb-6 overflow-hidden">
      <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-[minmax(280px,0.34fr)_minmax(0,1fr)]">
        <div className="flex flex-col justify-between gap-8 border-b border-[var(--brand-line)] p-6 sm:p-8 lg:border-b-0 lg:border-r">
          <div className="flex flex-col gap-7">
            <div className="flex items-center justify-between gap-4">
              <span className="eyebrow">
                <span className="eyebrow-dot" />
                Selected work
              </span>
              <Images className="h-4 w-4 text-[var(--brand-accent)]" />
            </div>

            <div>
              <h3 className="text-2xl font-bold leading-tight text-[var(--brand-ink)] sm:text-3xl">
                ნამუშევრების ინტერაქტიული არჩევანი
              </h3>
              <p className="mt-3 text-sm leading-7 text-[var(--brand-muted)]">
                თითოეული მიმართულებიდან ერთი გამორჩეული ნამუშევარი.
              </p>
            </div>

            <div
              role="tablist"
              aria-label="არჩეული ნამუშევრების მიმართულებები"
              className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1"
            >
              {featuredEntries.map((entry, index) => {
                const isActive = index === activeIndex;

                return (
                  <button
                    key={entry.category.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-controls="featured-work-panel"
                    onClick={() => showEntry(index)}
                    className={`group flex min-h-[64px] items-center gap-4 rounded-lg border px-4 py-3 text-left transition-all duration-300 ${
                      isActive
                        ? 'border-[var(--brand-accent)] bg-[var(--brand-accent-soft)] text-[var(--brand-ink)] shadow-[var(--brand-accent-shadow-xs)]'
                        : 'border-[var(--brand-line)] bg-white/40 text-[var(--brand-muted)] hover:border-[var(--brand-line-strong)] hover:bg-white/70 hover:text-[var(--brand-ink)]'
                    }`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold ${
                      isActive
                        ? 'bg-[var(--brand-accent)] text-[var(--brand-on-accent)]'
                        : 'bg-[var(--brand-accent-soft)] text-[var(--brand-accent)]'
                    }`}>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{entry.category.label}</span>
                      <span className="mt-1 block font-mono text-[10px] text-[var(--brand-soft)]">
                        {getCountLabel(entry)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-[var(--brand-line)] pt-5">
            <span className="font-mono text-[11px] font-bold text-[var(--brand-muted)]">
              {String(activeIndex + 1).padStart(2, '0')} / {String(featuredEntries.length).padStart(2, '0')}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => showEntry(activeIndex - 1)}
                className="icon-button h-10 w-10"
                aria-label="წინა ნამუშევარი"
                title="წინა ნამუშევარი"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => showEntry(activeIndex + 1)}
                className="icon-button h-10 w-10"
                aria-label="შემდეგი ნამუშევარი"
                title="შემდეგი ნამუშევარი"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div
          id="featured-work-panel"
          role="tabpanel"
          aria-live="polite"
          className="featured-work-stage relative min-h-[430px] overflow-hidden sm:min-h-[560px] lg:min-h-[620px]"
          style={stageStyle}
          onPointerMove={handlePointerMove}
          onPointerLeave={resetPointerPosition}
        >
          <div className="absolute inset-x-5 top-5 z-20 flex items-center justify-between gap-4 sm:inset-x-7 sm:top-7">
            <span className="featured-work-index rounded-full px-3 py-1.5 font-mono text-[10px] font-bold uppercase">
              რჩეული // {String(activeIndex + 1).padStart(2, '0')}
            </span>
            <span className="font-mono text-[10px] font-bold uppercase text-[var(--brand-soft)]">
              {activeEntry.item.year ?? 'Portfolio'}
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeEntry.item.id}
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 18 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.02, y: -12 }}
              transition={{ duration: shouldReduceMotion ? 0.12 : 0.48, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 z-10 flex items-center justify-center px-6 pb-28 pt-20 sm:px-12 sm:pb-32 sm:pt-24"
            >
              <div className="featured-work-artwork flex h-full w-full items-center justify-center">
                <img
                  src={activeEntry.item.image}
                  alt={activeEntry.item.title}
                  className="max-h-full max-w-full object-contain"
                  loading="lazy"
                  decoding="async"
                  onError={(event) => {
                    event.currentTarget.hidden = true;
                  }}
                />
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="absolute inset-x-5 bottom-5 z-20 flex flex-col items-start justify-between gap-4 border-t border-[var(--brand-line)] pt-4 sm:inset-x-7 sm:bottom-7 sm:flex-row sm:items-end">
            <div className="min-w-0 max-w-xl">
              <p className="font-mono text-[10px] font-bold uppercase text-[var(--brand-soft)]">
                {activeEntry.category.label}
              </p>
              <h4 className="mt-1 truncate text-xl font-extrabold text-[var(--brand-ink)] sm:text-2xl">
                {activeEntry.item.kind === 'project' ? activeEntry.item.title : activeEntry.category.label}
              </h4>
              <p className="mt-1 line-clamp-1 text-xs text-[var(--brand-muted)] sm:text-sm">
                {activeEntry.item.description || activeEntry.category.description}
              </p>
            </div>
            <button
              type="button"
              onClick={openActiveWork}
              className="button-secondary w-full shrink-0 gap-2 text-xs sm:w-auto"
            >
              {activeEntry.item.kind === 'project' ? 'პროექტის ნახვა' : 'კატეგორიის ნახვა'}
              <ArrowUpRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
