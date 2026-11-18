/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { motion, useDragControls, useReducedMotion } from 'motion/react';
import { ArrowUpRight, GripVertical, ImageIcon, Maximize2, Pencil, Star } from 'lucide-react';
import { getPortfolioCategoryById } from '../data/portfolioItems';
import { PortfolioItem } from '../types';
import { isPlaceholderTitle } from '../admin/attention';

type DragPoint = { x: number; y: number };
type MotionDragEvent = MouseEvent | PointerEvent | TouchEvent;

function getDragPoint(event: MotionDragEvent): DragPoint {
  if ('clientX' in event) return { x: event.clientX, y: event.clientY };
  const touch = event.changedTouches[0] ?? event.touches[0];
  return { x: touch?.clientX ?? 0, y: touch?.clientY ?? 0 };
}

interface PortfolioCardProps {
  item: PortfolioItem;
  onOpen: (item: PortfolioItem) => void;
  compact?: boolean;
  imageOnly?: boolean;
  onImageError?: (item: PortfolioItem, retry?: boolean) => void;
  /** The tile's place in the catalog list (shown as its number on hover). */
  index?: number;
  organizer?: {
    dragging: boolean;
    dropTarget: boolean;
    onDragStart: (item: PortfolioItem) => void;
    onDrag: (item: PortfolioItem, point: DragPoint) => void;
    onDragEnd: (item: PortfolioItem) => void;
    onEdit: () => void;
  };
  key?: string;
}

export default function PortfolioCard({ item, onOpen, compact = false, imageOnly = false, onImageError, index = 0, organizer }: PortfolioCardProps) {
  const baseCategory = getPortfolioCategoryById(item.category);
  const category = item.categoryLabel ? { ...baseCategory, label: item.categoryLabel } : baseCategory;
  const tags = item.tags ?? [];
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const [hasImageError, setHasImageError] = useState(false);
  const dragEndedAt = useRef(0);
  const dragControls = useDragControls();
  const prefersReducedMotion = useReducedMotion() ?? false;
  const isProject = item.kind === 'project';
  const isWideImage = imageAspectRatio !== null && imageAspectRatio >= 1.6;

  useEffect(() => setHasImageError(false), [item.image]);

  if (hasImageError && !onImageError) {
    return null;
  }

  if (imageOnly) {
    return (
      <motion.article
        layout={organizer ? 'position' : true}
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.97 }}
        whileHover={organizer && !prefersReducedMotion
          ? { y: -3, scale: 1.006, transition: { type: 'spring', stiffness: 420, damping: 34 } }
          : undefined}
        whileTap={prefersReducedMotion ? undefined : { scale: organizer ? 0.995 : 0.992 }}
        whileDrag={organizer ? {
          scale: prefersReducedMotion ? 1 : 1.025,
          zIndex: 20,
          boxShadow: '0 24px 58px rgb(10 18 14 / 0.28)',
        } : undefined}
        transition={organizer
          ? {
            layout: prefersReducedMotion ? { duration: 0.01 } : { type: 'spring', stiffness: 520, damping: 40, mass: 0.72 },
            default: prefersReducedMotion ? { duration: 0.01 } : { duration: 0.2, ease: 'easeOut' },
          }
          : { duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        drag={organizer ? true : undefined}
        dragListener={organizer ? false : undefined}
        dragControls={organizer ? dragControls : undefined}
        dragMomentum={organizer ? false : undefined}
        dragElastic={organizer ? (prefersReducedMotion ? 0 : 0.035) : undefined}
        dragTransition={organizer ? { bounceStiffness: 480, bounceDamping: 38 } : undefined}
        className={organizer
          ? `group relative self-start overflow-hidden rounded-lg border border-[var(--brand-line)] bg-white/72 outline outline-2 outline-transparent outline-offset-2 shadow-[var(--brand-shadow-soft)] transition-[border-color,background-color,box-shadow,outline-color] duration-300 will-change-transform hover:border-[var(--brand-accent)] hover:bg-white hover:outline-[var(--brand-accent)] hover:shadow-[var(--brand-shadow)] ${isProject || isWideImage ? 'col-span-2' : ''} admin-organizer-card`
          : `catalog-tile group relative self-start ${isProject || isWideImage ? 'col-span-2' : ''}`}
        data-organizer-card={organizer ? 'true' : undefined}
        data-organizer-project-id={organizer ? item.databaseProjectId : undefined}
        data-dragging={organizer?.dragging || undefined}
        data-drop-target={organizer?.dropTarget || undefined}
        onPointerDownCapture={(event: ReactPointerEvent<HTMLElement>) => {
          if (!organizer || event.button !== 0 || !event.isPrimary) return;
          const target = event.target;
          if (!(target instanceof Element) || target.closest('.admin-organizer-grip, .admin-organizer-edit')) return;
          if (event.pointerType !== 'touch') dragControls.start(event.nativeEvent);
        }}
        onDragStart={() => organizer?.onDragStart(item)}
        onDrag={(event) => organizer?.onDrag(item, getDragPoint(event))}
        onDragEnd={() => {
          if (!organizer) return;
          dragEndedAt.current = Date.now();
          organizer.onDragEnd(item);
        }}
      >
        <button
          type="button"
          onClick={(event) => {
            if (Date.now() - dragEndedAt.current < 250) {
              event.preventDefault();
              return;
            }
            onOpen(item);
          }}
          className="block w-full border-0 bg-transparent p-0 text-left"
          aria-label={organizer ? `პროექტის რედაქტირება: ${item.title}` : isProject ? `პროექტის გახსნა: ${item.title}` : `სურათის გახსნა: ${item.title}`}
        >
          <div
            className={organizer
              ? 'relative w-full overflow-hidden bg-[var(--brand-page-soft)] transition-colors duration-300 group-hover:bg-white'
              : 'catalog-tile-media relative w-full overflow-hidden'}
            style={{ aspectRatio: imageAspectRatio ?? (isProject ? 16 / 9 : 1) }}
          >
            {hasImageError && onImageError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-4 text-center text-xs text-[var(--brand-muted)]">
                <ImageIcon className="h-5 w-5 text-[var(--brand-accent)]" />
                <span>სურათის ჩატვირთვა ვერ მოხერხდა</span>
              </div>
            ) : (
              <img
                src={item.thumbnail ?? item.image}
                alt={item.title}
                draggable={organizer ? false : undefined}
                className="absolute left-1/2 top-1/2 h-[95.238%] w-[95.238%] -translate-x-1/2 -translate-y-1/2 object-contain transition-transform duration-500 ease-out group-hover:scale-[1.018]"
                loading="lazy"
                decoding="async"
                onError={() => { setHasImageError(true); onImageError?.(item); }}
                onLoad={(event) => {
                  const image = event.currentTarget;

                  if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                    setImageAspectRatio(image.naturalWidth / image.naturalHeight);
                  }
                }}
              />
            )}
            {/* Number, name and an "open" sign appear over the picture on hover. */}
            {!organizer && !isProject && (
              <span className="catalog-tile-overlay" aria-hidden="true">
                <span className="catalog-tile-num">{String(index + 1).padStart(2, '0')}</span>
                <span className="catalog-tile-label">{isPlaceholderTitle(item.title) ? category.label : item.title}</span>
                <span className="catalog-tile-open"><Maximize2 /></span>
              </span>
            )}
          </div>

          {isProject && (organizer ? (
            <div className="flex min-h-[92px] items-center justify-between gap-4 border-t border-[var(--brand-line)] px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-bold uppercase text-[var(--brand-soft)]">
                  {category.label}
                </p>
                <h2 className="mt-1 truncate text-lg font-extrabold text-[var(--brand-ink)]">
                  {item.title}
                </h2>
                <p className="mt-1 text-xs text-[var(--brand-muted)]">
                  {item.imageCount ?? 0} ფოტო
                </p>
              </div>
              <ArrowUpRight className="h-5 w-5 shrink-0 text-[var(--brand-soft)] transition-colors group-hover:text-[var(--brand-accent)]" />
            </div>
          ) : (
            <div className="catalog-tile-caption">
              <span className="min-w-0">
                <span className="catalog-tile-title">{item.title}</span>
                <span className="catalog-tile-sub">{category.label} · {item.imageCount ?? 0} ფოტო</span>
              </span>
              <ArrowUpRight className="catalog-tile-arrow h-4 w-4 shrink-0" />
            </div>
          ))}
        </button>
        {organizer && (
          <>
            <button
              type="button"
              className="admin-organizer-grip"
              aria-label="გადაათრიეთ პროექტის გადასაადგილებლად"
              title="გადაათრიეთ გადასაადგილებლად"
              onPointerDown={(event) => {
                if (event.button !== 0 || !event.isPrimary) return;
                event.stopPropagation();
                dragControls.start(event.nativeEvent);
              }}
              onClick={(event) => event.preventDefault()}
            >
              <GripVertical />
            </button>
            <button
              type="button"
              className="admin-organizer-edit"
              aria-label={`პროექტის რედაქტირება: ${item.title}`}
              title="პროექტის რედაქტირება"
              draggable={false}
              onClick={(event) => {
                event.stopPropagation();
                organizer.onEdit();
              }}
            ><Pencil aria-hidden="true" /></button>
          </>
        )}
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
            src={item.thumbnail ?? item.image}
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
