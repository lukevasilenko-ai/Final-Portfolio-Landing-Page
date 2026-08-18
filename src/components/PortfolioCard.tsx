/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, Star } from 'lucide-react';
import { getPortfolioCategoryById } from '../data/portfolioItems';
import { PortfolioItem } from '../types';

interface PortfolioCardProps {
  item: PortfolioItem;
  onOpen: (item: PortfolioItem) => void;
  compact?: boolean;
  imageOnly?: boolean;
  key?: string;
}

export default function PortfolioCard({ item, onOpen, compact = false, imageOnly = false }: PortfolioCardProps) {
  const category = getPortfolioCategoryById(item.category);
  const tags = item.tags ?? [];
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const [hasImageError, setHasImageError] = useState(false);
  const isProject = item.kind === 'project';
  const isWideImage = imageAspectRatio !== null && imageAspectRatio >= 1.6;

  if (hasImageError) {
    return null;
  }

  if (imageOnly) {
    return (
      <motion.article
        layout
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.97 }}
        whileHover={{
          y: -8,
          scale: 1.015,
          rotate: 0.45,
          transition: { type: 'spring', stiffness: 320, damping: 22 }
        }}
        whileTap={{ scale: 0.99 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className={`group relative self-start overflow-hidden rounded-lg border border-[var(--brand-line)] bg-white/72 outline outline-2 outline-transparent outline-offset-2 shadow-[var(--brand-shadow-soft)] transition-[border-color,background-color,box-shadow,outline-color] duration-300 will-change-transform hover:border-[var(--brand-accent)] hover:bg-white hover:outline-[var(--brand-accent)] hover:shadow-[var(--brand-shadow)] ${isProject || isWideImage ? 'col-span-2' : ''}`}
      >
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="block w-full border-0 bg-transparent p-0 text-left"
          aria-label={isProject ? `Open project ${item.title}` : `Open ${item.title}`}
        >
          <div
            className="relative w-full overflow-hidden bg-[var(--brand-page-soft)] transition-colors duration-300 group-hover:bg-white"
            style={{ aspectRatio: imageAspectRatio ?? (isProject ? 16 / 9 : 1) }}
          >
            <img
              src={item.image}
              alt={item.title}
              className="absolute left-1/2 top-1/2 h-[95.238%] w-[95.238%] -translate-x-1/2 -translate-y-1/2 object-contain transition-transform duration-500 ease-out group-hover:scale-[1.018]"
              loading="lazy"
              decoding="async"
              onError={() => setHasImageError(true)}
              onLoad={(event) => {
                const image = event.currentTarget;

                if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                  setImageAspectRatio(image.naturalWidth / image.naturalHeight);
                }
              }}
            />
          </div>

          {isProject && (
            <div className="flex min-h-[92px] items-center justify-between gap-4 border-t border-[var(--brand-line)] px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-bold uppercase text-[var(--brand-soft)]">
                  Branding & Identity
                </p>
                <h2 className="mt-1 truncate text-lg font-extrabold text-[var(--brand-ink)]">
                  {item.title}
                </h2>
                <p className="mt-1 text-xs text-[var(--brand-muted)]">
                  {item.imageCount ?? 0} images
                </p>
              </div>
              <ArrowUpRight className="h-5 w-5 shrink-0 text-[var(--brand-soft)] transition-colors group-hover:text-[var(--brand-accent)]" />
            </div>
          )}
        </button>
      </motion.article>
    );
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 14, scale: 0.97 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="surface-card-strong group flex h-full flex-col overflow-hidden"
    >
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="block w-full border-0 bg-transparent p-0 text-left"
      >
        <div className={`relative overflow-hidden border-b border-[var(--brand-line)] ${compact ? 'aspect-[4/3]' : 'aspect-[16/11]'}`}>
          <img
            src={item.image}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.035]"
            onError={() => setHasImageError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--brand-image-shade)] via-transparent to-transparent opacity-80" />

          <span className="tag-chip absolute left-4 top-4 px-3 py-1.5">
            {category.label}
          </span>

          {item.featured && (
            <span className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-[var(--brand-line)] bg-white/80 px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--brand-accent)] backdrop-blur-xl">
              <Star className="h-3.5 w-3.5 fill-[var(--brand-accent)]" />
              Featured
            </span>
          )}
        </div>
      </button>

      <div className="flex flex-1 flex-col justify-between gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-2">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--brand-muted)]">
                {item.serviceType || category.label} // {item.industry || category.label}
              </p>
              <h3 className="text-xl font-extrabold leading-snug text-[var(--brand-ink)]">
                {item.title}
              </h3>
            </div>
            <ArrowUpRight className="mt-1 h-5 w-5 shrink-0 text-[var(--brand-soft)] transition-colors group-hover:text-[var(--brand-accent)]" />
          </div>

          <p className="text-sm leading-7 text-[var(--brand-muted)]">
            {item.description || item.title}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-[var(--brand-line)] pt-4">
          {tags.slice(0, compact ? 3 : 4).map((tag) => (
            <span key={tag} className="tag-chip px-3 py-1.5">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </motion.article>
  );
}
