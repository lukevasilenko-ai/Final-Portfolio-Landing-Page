/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Tag,
  X
} from 'lucide-react';
import { getPortfolioCategoryById } from '../data/portfolioItems';
import { navigateWithinSite } from '../navigation';
import { isPlaceholderTitle } from '../admin/attention';
import { PortfolioItem } from '../types';

interface PortfolioModalProps {
  item: PortfolioItem | null;
  items?: PortfolioItem[];
  onClose: () => void;
  onSelect?: (item: PortfolioItem) => void;
  onImageError?: (item: PortfolioItem, retry?: boolean) => void;
  imageOnly?: boolean;
}

const pad = (value: number) => String(value).padStart(2, '0');

/**
 * Picture viewer. The image-only form (catalog) is a dark room lit by the picture's own colours,
 * with a thumbnail strip of the whole category along the bottom; arrows, keys and swipes move
 * between pictures.
 */
export default function PortfolioModal({
  item,
  items = [],
  onClose,
  onSelect,
  onImageError,
  imageOnly = false
}: PortfolioModalProps) {
  const baseCategory = item ? getPortfolioCategoryById(item.category) : null;
  const category = item && baseCategory
    ? { ...baseCategory, label: item.categoryLabel ?? baseCategory.label }
    : null;
  const tags = item?.tags ?? [];
  const [hasImageError, setHasImageError] = useState(false);
  const selectedIndex = item ? items.findIndex((candidate) => candidate.id === item.id) : -1;
  const previousItem = selectedIndex > 0 ? items[selectedIndex - 1] : null;
  const nextItem = selectedIndex >= 0 && selectedIndex < items.length - 1
    ? items[selectedIndex + 1]
    : null;
  const isOpen = Boolean(item);
  const reduceMotion = useReducedMotion() ?? false;
  const filmstripRef = useRef<HTMLDivElement>(null);
  // Imported files are titled "1 result" until renamed in the admin; show the category instead.
  const displayTitle = item && category ? (isPlaceholderTitle(item.title) ? category.label : item.title) : '';

  useEffect(() => setHasImageError(false), [item?.image]);

  // The active thumbnail stays in view.
  useEffect(() => {
    const strip = filmstripRef.current;
    const active = strip?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!strip || !active) return;
    strip.scrollTo({ left: active.offsetLeft - strip.clientWidth / 2 + active.offsetWidth / 2, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [item?.id, reduceMotion]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousBodyPaddingRight = document.body.style.paddingRight;
    const previousBodyPosition = document.body.style.position;
    const previousBodyTop = document.body.style.top;
    const previousBodyLeft = document.body.style.left;
    const previousBodyRight = document.body.style.right;
    const previousBodyWidth = document.body.style.width;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = `-${scrollX}px`;
    document.body.style.right = '0';
    document.body.style.width = '100%';

    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.body.style.paddingRight = previousBodyPaddingRight;
      document.body.style.position = previousBodyPosition;
      document.body.style.top = previousBodyTop;
      document.body.style.left = previousBodyLeft;
      document.body.style.right = previousBodyRight;
      document.body.style.width = previousBodyWidth;
      window.scrollTo(scrollX, scrollY);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!item) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowLeft' && previousItem && onSelect) {
        event.preventDefault();
        onSelect(previousItem);
      } else if (event.key === 'ArrowRight' && nextItem && onSelect) {
        event.preventDefault();
        onSelect(nextItem);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [item, nextItem, onClose, onSelect, previousItem]);

  return createPortal(
    <AnimatePresence>
      {item && category && (
        <div
          className={imageOnly
            ? 'lightbox fixed inset-0 z-[10000] flex items-center justify-center p-4'
            : 'fixed inset-0 z-[10000] flex items-center justify-center p-4'}
          role="dialog"
          aria-modal="true"
          aria-label={item ? item.title : 'სურათის ნახვა'}
        >
          {/* A soft, blurred wash of the picture's own colours fills the room. */}
          {imageOnly && (
            <AnimatePresence initial={false}>
              <motion.img
                key={`ambient-${item.id}`}
                src={item.image}
                alt=""
                aria-hidden="true"
                className="lightbox-ambient"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            </AnimatePresence>
          )}

          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={imageOnly
              ? 'lightbox-backdrop absolute inset-0 h-full w-full cursor-zoom-out border-0 p-0'
              : 'absolute inset-0 h-full w-full cursor-zoom-out border-0 bg-[rgba(14,13,12,0.95)] p-0'}
            onClick={onClose}
            aria-label="დახურვა"
          />

          {imageOnly ? (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-6 px-4 py-4 sm:px-8 sm:py-6"
              >
                <div className="min-w-0 pt-1">
                  <p className="lightbox-title truncate">{displayTitle}</p>
                  {items.length > 1 && selectedIndex >= 0 && (
                    <p className="lightbox-count tabular-nums"><b>{pad(selectedIndex + 1)}</b> / {pad(items.length)}</p>
                  )}
                </div>
                <button type="button" onClick={onClose} className="lightbox-button pointer-events-auto shrink-0" aria-label="დახურვა">
                  <X className="h-4 w-4" />
                </button>
              </motion.div>

              {previousItem && onSelect && (
                <button
                  type="button"
                  onClick={() => onSelect(previousItem)}
                  className="lightbox-button absolute left-3 top-1/2 z-20 -translate-y-1/2 sm:left-8"
                  aria-label="წინა სურათი"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}

              {nextItem && onSelect && (
                <button
                  type="button"
                  onClick={() => onSelect(nextItem)}
                  className="lightbox-button absolute right-3 top-1/2 z-20 -translate-y-1/2 sm:right-8"
                  aria-label="შემდეგი სურათი"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="relative z-10 flex items-center justify-center"
                onClick={(event) => event.stopPropagation()}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {hasImageError && onImageError ? (
                    <div className="lightbox-error flex min-h-48 min-w-48 flex-col items-center justify-center gap-3 p-8 text-center text-sm">
                      <span>სურათის ჩატვირთვა ვერ მოხერხდა</span>
                      <button type="button" className="lightbox-button w-auto px-5 text-sm" onClick={() => { setHasImageError(false); onImageError(item, true); }}>ხელახლა ცდა</button>
                    </div>
                  ) : (
                    /* Swipe left or right to move between pictures (phones and trackpads). */
                    <motion.div
                      key={item.id}
                      className="lightbox-frame"
                      initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.985 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      drag={items.length > 1 && onSelect && !reduceMotion ? 'x' : false}
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.5}
                      onDragEnd={(_, info) => {
                        if (info.offset.x < -70 && nextItem) onSelect?.(nextItem);
                        else if (info.offset.x > 70 && previousItem) onSelect?.(previousItem);
                      }}
                    >
                      <img
                        src={item.image}
                        alt={item.title}
                        draggable={false}
                        className="lightbox-image block object-contain"
                        onError={() => { setHasImageError(true); onImageError?.(item); }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Every picture of the category in a strip along the bottom. */}
              {items.length > 1 && onSelect && (
                <motion.div
                  ref={filmstripRef}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 12 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="lightbox-filmstrip"
                  onClick={(event) => event.stopPropagation()}
                >
                  {items.map((candidate, position) => (
                    <button
                      key={candidate.id}
                      type="button"
                      aria-current={candidate.id === item.id ? 'true' : undefined}
                      aria-label={`სურათი ${position + 1}`}
                      onClick={() => onSelect(candidate)}
                    >
                      <img src={candidate.thumbnail ?? candidate.image} alt="" loading="lazy" decoding="async" />
                    </button>
                  ))}
                </motion.div>
              )}
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 18, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 18, scale: 0.96 }}
              transition={{ type: 'spring', damping: 28, stiffness: 230 }}
              className="surface-card-strong relative z-10 grid max-h-[92vh] w-full max-w-5xl grid-cols-1 overflow-hidden lg:grid-cols-[1.15fr_0.85fr]"
            >
              <div className="relative min-h-[300px] overflow-hidden bg-[var(--brand-page-soft)] lg:min-h-[640px]">
                {hasImageError && onImageError ? (
                  <div className="flex min-h-[300px] items-center justify-center p-8 text-center text-sm text-[var(--brand-muted)]">სურათის ჩატვირთვა ვერ მოხერხდა</div>
                ) : (
                  <img src={item.image} alt={item.title} className="h-full w-full object-cover" onError={() => { setHasImageError(true); onImageError?.(item); }} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--brand-image-shade-soft)] via-transparent to-transparent" />
                <span className="tag-chip absolute left-5 top-5 px-3 py-1.5">
                  {category.label}
                </span>
              </div>

            <div className="flex max-h-[92vh] flex-col overflow-y-auto">
              <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[var(--brand-line)] bg-[var(--brand-canvas-90)] p-5 backdrop-blur-xl">
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--brand-muted)]">
                    Portfolio preview
                  </span>
                  <span className="mt-1 text-sm font-bold text-[var(--brand-ink)]">{item.id}</span>
                </div>
                <button type="button" onClick={onClose} className="icon-button h-9 w-9" aria-label="Close portfolio preview">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex flex-col gap-7 p-6 sm:p-8">
                <div className="flex flex-col gap-3">
                  <h2 className="text-3xl font-extrabold leading-tight text-[var(--brand-ink)]">
                    {item.title}
                  </h2>
                  <p className="text-sm leading-8 text-[var(--brand-muted)]">
                    {item.description || item.title}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center gap-3 rounded-lg border border-[var(--brand-line)] bg-white/55 p-4">
                    <BriefcaseBusiness className="h-4 w-4 text-[var(--brand-accent)]" />
                    <div className="flex flex-col">
                      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--brand-soft)]">Service</span>
                      <strong className="text-sm text-[var(--brand-ink)]">{item.serviceType || category.label}</strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-lg border border-[var(--brand-line)] bg-white/55 p-4">
                    <Building2 className="h-4 w-4 text-[var(--brand-copper)]" />
                    <div className="flex flex-col">
                      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--brand-soft)]">Industry</span>
                      <strong className="text-sm text-[var(--brand-ink)]">{item.industry || category.label}</strong>
                    </div>
                  </div>
                  {item.year && (
                    <div className="flex items-center gap-3 rounded-lg border border-[var(--brand-line)] bg-white/55 p-4">
                      <CalendarDays className="h-4 w-4 text-[var(--brand-plum)]" />
                      <div className="flex flex-col">
                        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--brand-soft)]">Year</span>
                        <strong className="text-sm text-[var(--brand-ink)]">{item.year}</strong>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-3 border-t border-[var(--brand-line)] pt-5">
                  <span className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--brand-ink)]">
                    <Tag className="h-4 w-4 text-[var(--brand-accent)]" />
                    Tags
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span key={tag} className="tag-chip px-3 py-1.5">
                        #{tag.toLowerCase().replace(/\s+/g, '')}
                      </span>
                    ))}
                  </div>
                </div>

                <a
                  href="/#contact"
                  onClick={(event) => {
                    event.preventDefault();
                    onClose();
                    navigateWithinSite('/#contact');
                  }}
                  className="button-primary w-full"
                >
                  მსგავს პროექტზე საუბარი
                </a>
              </div>
            </div>
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
