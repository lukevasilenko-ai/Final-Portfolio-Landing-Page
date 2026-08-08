/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
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
import { PortfolioItem } from '../types';

interface PortfolioModalProps {
  item: PortfolioItem | null;
  items?: PortfolioItem[];
  onClose: () => void;
  onSelect?: (item: PortfolioItem) => void;
  imageOnly?: boolean;
}

export default function PortfolioModal({
  item,
  items = [],
  onClose,
  onSelect,
  imageOnly = false
}: PortfolioModalProps) {
  const category = item ? getPortfolioCategoryById(item.category) : null;
  const tags = item?.tags ?? [];
  const selectedIndex = item ? items.findIndex((candidate) => candidate.id === item.id) : -1;
  const previousItem = selectedIndex > 0 ? items[selectedIndex - 1] : null;
  const nextItem = selectedIndex >= 0 && selectedIndex < items.length - 1
    ? items[selectedIndex + 1]
    : null;
  const isOpen = Boolean(item);

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
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Portfolio image preview"
        >
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="absolute inset-0 h-full w-full cursor-zoom-out border-0 bg-[rgba(10,14,12,0.92)] p-0 backdrop-blur-sm"
            onClick={onClose}
            aria-label="Close portfolio image"
          />

          {imageOnly ? (
            <>
              <AnimatePresence>
                {previousItem && onSelect && (
                  <motion.button
                    key="previous-image"
                    type="button"
                    initial={{ opacity: 0, x: 8, y: '-50%', scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, y: '-50%', scale: 1 }}
                    exit={{ opacity: 0, x: 8, y: '-50%', scale: 0.9 }}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.94 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    onClick={() => onSelect(previousItem)}
                    className="absolute left-3 top-1/2 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/60 bg-white text-[var(--brand-accent)] shadow-[0_16px_44px_rgba(0,0,0,0.28)] sm:left-6 sm:h-12 sm:w-12"
                    aria-label="Previous portfolio image"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </motion.button>
                )}

                {nextItem && onSelect && (
                  <motion.button
                    key="next-image"
                    type="button"
                    initial={{ opacity: 0, x: -8, y: '-50%', scale: 0.9 }}
                    animate={{ opacity: 1, x: 0, y: '-50%', scale: 1 }}
                    exit={{ opacity: 0, x: -8, y: '-50%', scale: 0.9 }}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.94 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    onClick={() => onSelect(nextItem)}
                    className="absolute right-3 top-1/2 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-white/60 bg-white text-[var(--brand-accent)] shadow-[0_16px_44px_rgba(0,0,0,0.28)] sm:right-6 sm:h-12 sm:w-12"
                    aria-label="Next portfolio image"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </motion.button>
                )}
              </AnimatePresence>

              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.965 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.98 }}
                transition={{ type: 'spring', damping: 30, stiffness: 260 }}
                className="relative z-10 flex max-h-[94vh] max-w-[calc(100vw-2rem)] items-center justify-center overflow-hidden rounded-lg border border-white/25 bg-white/10 p-3 shadow-[0_36px_100px_rgba(0,0,0,0.42)] backdrop-blur-xl sm:max-w-[calc(100vw-10rem)] sm:p-5"
                onClick={(event) => event.stopPropagation()}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`ambient-${item.id}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.24, ease: 'easeOut' }}
                    className="absolute inset-0 overflow-hidden"
                    aria-hidden="true"
                  >
                    <img
                      src={item.image}
                      alt=""
                      className="absolute -inset-[15%] h-[130%] w-[130%] scale-110 object-cover opacity-90 blur-3xl saturate-[1.3]"
                    />
                    <div className="absolute inset-0 bg-[rgba(255,255,255,0.14)] backdrop-blur-xl" />
                    <div className="absolute inset-0 ring-1 ring-inset ring-white/25" />
                  </motion.div>
                </AnimatePresence>

                <AnimatePresence mode="wait" initial={false}>
                  <motion.img
                    key={item.id}
                    src={item.image}
                    alt={item.title}
                    initial={{ opacity: 0, scale: 0.985 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.99 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="relative z-10 block max-h-[calc(94vh-1.5rem)] max-w-[calc(100vw-3.5rem)] rounded-[4px] object-contain shadow-[0_18px_50px_rgba(0,0,0,0.24)] sm:max-h-[calc(94vh-2.5rem)] sm:max-w-[calc(100vw-12.5rem)]"
                  />
                </AnimatePresence>
              </motion.div>
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
                <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[rgba(24,26,24,0.34)] via-transparent to-transparent" />
                <span className="tag-chip absolute left-5 top-5 px-3 py-1.5">
                  {category.label}
                </span>
              </div>

            <div className="flex max-h-[92vh] flex-col overflow-y-auto">
              <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[var(--brand-line)] bg-[rgba(255,255,252,0.9)] p-5 backdrop-blur-xl">
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

                <a href="/#contact" className="button-primary w-full">
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
