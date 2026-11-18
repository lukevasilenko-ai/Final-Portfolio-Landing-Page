/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import {
  getPortfolioCategoryBySlug
} from '../data/portfolioItems';
import {
  getPortfolioProject,
  PORTFOLIO_FILTERS_WITH_COUNTS,
  PORTFOLIO_ITEMS,
  PORTFOLIO_PROJECTS
} from '../data/catalogImages';
import type { SupabaseCatalog } from '../data/supabaseCatalog';
import type {
  PortfolioCategory,
  PortfolioCategoryId,
  PortfolioItem,
  PortfolioItemCategory
} from '../types';
import { navigateWithinSite } from '../navigation';
import PortfolioCard from './PortfolioCard';
import PortfolioModal from './PortfolioModal';

interface PortfolioRoute {
  categorySlug?: string;
  projectSlug?: string;
}

const getPortfolioRoute = (): PortfolioRoute => {
  const [, page, categorySlug, projectSlug] = window.location.pathname.split('/');

  return page === 'portfolio' ? { categorySlug, projectSlug } : {};
};

const getCategoryFromSlug = (slug: string | undefined, categories: PortfolioCategory[]) =>
  categories.find((category) => category.slug === slug) || getPortfolioCategoryBySlug(slug);

const getCategoryCount = (category: PortfolioCategory, items: PortfolioItem[]) =>
  category.id === 'all'
    ? items.length
    : items.filter((item) => item.category === category.id).length;

const navigateToCategory = (categoryId: PortfolioCategoryId, slug: string) => {
  navigateWithinSite(categoryId === 'all' ? '/portfolio' : `/portfolio/${slug}`);
};

const navigateToProject = (categoryId: PortfolioItemCategory, projectSlug: string) => {
  navigateWithinSite(`/portfolio/${categoryId}/${projectSlug}`);
};

const ease = [0.16, 1, 0.3, 1] as const;

/** Editorial page header shared by the catalog and project pages: back link in the side column, title and facts in the main one. */
function CatalogHeader({ back, kicker, title, description, meta = [] }: {
  back: { label: string; onClick: () => void };
  kicker: string;
  title: string;
  description?: string;
  meta?: { label: string; value: string }[];
}) {
  const reduceMotion = useReducedMotion();
  const reveal = (delay: number) => (reduceMotion ? {} : {
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, ease, delay },
  });

  return (
    <section className="catalog-header px-[var(--section-space-x)]">
      <div className="container-xl ed-grid gap-y-10">
        <div className="ed-aside">
          <button type="button" onClick={back.onClick} className="ed-link">
            <ArrowLeft className="h-3.5 w-3.5" />
            {back.label}
          </button>
        </div>
        <div className="ed-main flex flex-col gap-7">
          <motion.span {...reveal(0)} className="ed-kicker">{kicker}</motion.span>
          <motion.h1 {...reveal(0.05)} className="section-title">{title}</motion.h1>
          {description && <motion.p {...reveal(0.12)} className="section-subtitle">{description}</motion.p>}
          {meta.length > 0 && (
            <motion.dl {...reveal(0.18)} className="catalog-meta">
              {meta.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </motion.dl>
          )}
        </div>
      </div>
    </section>
  );
}

export default function PortfolioCatalogPage() {
  const useSupabaseSource = import.meta.env.VITE_PUBLIC_CATALOG_SOURCE === 'supabase';
  const [remoteCatalog, setRemoteCatalog] = useState<SupabaseCatalog | null>(null);
  const [isLoading, setIsLoading] = useState(useSupabaseSource);
  const [errorMessage, setErrorMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const categories = useSupabaseSource ? remoteCatalog?.categories ?? [] : PORTFOLIO_FILTERS_WITH_COUNTS;
  const items = useSupabaseSource ? remoteCatalog?.items ?? [] : PORTFOLIO_ITEMS;
  const projectDetails = useSupabaseSource ? remoteCatalog?.projects ?? [] : PORTFOLIO_PROJECTS;
  const [route, setRoute] = useState<PortfolioRoute>(getPortfolioRoute);
  const [selectedImage, setSelectedImage] = useState<PortfolioItem | null>(null);
  const [failedImagePaths, setFailedImagePaths] = useState<Set<string>>(() => new Set());
  const imageRefreshAttempts = useRef(new Map<string, number>());

  useEffect(() => {
    if (!useSupabaseSource) return;
    let active = true;
    setIsLoading(true);
    setErrorMessage('');
    void import('../data/supabaseCatalog')
      .then(({ loadSupabaseCatalog }) => loadSupabaseCatalog())
      .then((catalog) => { if (active) setRemoteCatalog(catalog); })
      .catch((error: unknown) => {
        if (!active) return;
        setRemoteCatalog(null);
        setErrorMessage(error instanceof Error ? error.message : 'კატალოგის ჩატვირთვა ვერ მოხერხდა.');
      })
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [reloadKey, useSupabaseSource]);

  useEffect(() => {
    const updateRoute = () => {
      setRoute(getPortfolioRoute());
      setSelectedImage(null);
    };

    window.addEventListener('popstate', updateRoute);
    window.addEventListener('app:navigate', updateRoute);

    return () => {
      window.removeEventListener('popstate', updateRoute);
      window.removeEventListener('app:navigate', updateRoute);
    };
  }, []);

  const activeCategory = useMemo(
    () => getCategoryFromSlug(route.categorySlug, categories),
    [categories, route.categorySlug]
  );
  const selectedCategory = activeCategory.id;
  const activeProject = route.projectSlug && selectedCategory !== 'all'
    ? useSupabaseSource
      ? projectDetails.find((project) => project.category === selectedCategory && project.slug === route.projectSlug)
      : getPortfolioProject(selectedCategory, route.projectSlug)
    : undefined;

  const visibleItems = useMemo(
    () =>
      selectedCategory === 'all'
        ? items
        : items.filter((item) => item.category === selectedCategory),
    [items, selectedCategory]
  );

  const modalItems = useMemo(
    () => visibleItems.filter((item) => item.kind !== 'project'),
    [visibleItems]
  );
  const reload = useCallback(() => setReloadKey((value) => value + 1), []);
  const refreshImage = useCallback(async (path: string) => {
    const { refreshSupabaseImageUrl } = await import('../data/supabaseCatalog');
    const signedUrl = await refreshSupabaseImageUrl(path);
    setRemoteCatalog((current) => current ? {
      ...current,
      // A refreshed image drops its light copy, so the fresh link to the original is what shows.
      items: current.items.map((item) => item.imagePath === path ? { ...item, image: signedUrl, thumbnail: undefined } : item),
      projects: current.projects.map((project) => ({
        ...project,
        cover: project.coverPath === path ? signedUrl : project.cover,
        images: project.images.map((item) => item.imagePath === path ? { ...item, image: signedUrl, thumbnail: undefined } : item),
      })),
    } : current);
    return signedUrl;
  }, []);

  const handleOpenItem = (item: PortfolioItem) => {
    if (item.kind === 'project' && item.projectSlug) {
      navigateToProject(item.category, item.projectSlug);
      return;
    }

    setSelectedImage(item);
  };

  const handleImageError = useCallback(async (item: PortfolioItem, retry = false) => {
    const path = item.imagePath;
    if (!useSupabaseSource || !path) return;
    const lastAttempt = imageRefreshAttempts.current.get(path) ?? 0;
    if (!retry && Date.now() - lastAttempt < 60_000) {
      setFailedImagePaths((current) => new Set(current).add(path));
      return;
    }
    imageRefreshAttempts.current.set(path, Date.now());
    try {
      const signedUrl = await refreshImage(path);
      setFailedImagePaths((current) => {
        const next = new Set(current);
        next.delete(path);
        return next;
      });
      setSelectedImage((current) => current?.imagePath === path ? { ...current, image: signedUrl } : current);
    } catch {
      setFailedImagePaths((current) => new Set(current).add(path));
    }
  }, [refreshImage, useSupabaseSource]);

  if (useSupabaseSource && isLoading) {
    return (
      <main id="main-content" tabIndex={-1} className="content-layer outline-none">
        <section className="section-wrap pb-10">
          <div className="container-xl">
            <div className="flex min-h-[270px] items-end border-b border-[var(--brand-line)] pb-10 pt-20" role="status" aria-live="polite">
              <div className="flex items-center gap-3 text-sm font-semibold text-[var(--brand-muted)]">
                <span className="button-spinner h-4 w-4 animate-spin rounded-full border-2" />
                კატალოგის მონაცემები და სურათები იტვირთება...
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (useSupabaseSource && errorMessage) {
    return (
      <main id="main-content" tabIndex={-1} className="content-layer outline-none">
        <section className="section-wrap pb-10">
          <div className="container-xl">
            <div className="flex min-h-[270px] flex-col items-start justify-end gap-4 border-b border-[var(--brand-line)] pb-10 pt-20">
              <span className="ed-kicker">კატალოგი</span>
              <h1 className="section-title">კატალოგის ჩატვირთვა ვერ მოხერხდა</h1>
              <p className="section-subtitle max-w-3xl">{errorMessage}</p>
              <button type="button" onClick={reload} className="button-secondary">ხელახლა ცდა</button>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (activeProject) {
    return (
      <main id="main-content" tabIndex={-1} className="content-layer outline-none">
        <CatalogHeader
          back={{ label: activeCategory.label, onClick: () => navigateToCategory(activeCategory.id, activeCategory.slug) }}
          kicker="პროექტი"
          title={activeProject.title}
          description={activeProject.description || undefined}
          meta={[
            ...(activeProject.year ? [{ label: 'წელი', value: String(activeProject.year) }] : []),
            ...(activeProject.tools.length ? [{ label: 'ინსტრუმენტები', value: activeProject.tools.join(', ') }] : []),
            ...(activeProject.tags.length ? [{ label: 'მიმართულება', value: activeProject.tags.join(', ') }] : []),
            { label: 'ფოტო', value: String(activeProject.images.length) },
          ]}
        />

        <section className="px-[var(--section-space-x)] pb-24">
          {activeProject.images.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto w-full max-w-[1180px] overflow-hidden rounded-[var(--radius-card)] bg-white"
              aria-label={`${activeProject.title} — პროექტის ნამუშევრები`}
            >
              {activeProject.images.map((item, index) => (
                failedImagePaths.has(item.imagePath ?? '') ? (
                  <div key={item.id} className="block w-full border-b border-[var(--brand-line)] px-6 py-16 text-center text-sm text-[var(--brand-muted)]" role="img" aria-label="სურათის ჩატვირთვა ვერ მოხერხდა">
                    სურათის ჩატვირთვა ვერ მოხერხდა
                    <button type="button" className="button-secondary ml-3" onClick={() => { imageRefreshAttempts.current.delete(item.imagePath ?? ''); void handleImageError(item, true); }}>ხელახლა ცდა</button>
                  </div>
                ) : (
                  <img
                    key={item.id}
                    src={item.image}
                    alt={`${activeProject.title} — ნამუშევარი ${index + 1}`}
                    className="block h-auto w-full"
                    loading={index === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    fetchPriority={index === 0 ? 'high' : 'auto'}
                    onError={(event) => {
                      if (useSupabaseSource) void handleImageError(item);
                      else event.currentTarget.hidden = true;
                    }}
                  />
                )
              ))}
            </motion.div>
          ) : (
            <div className="container-xl">
              <p className="border-t border-[var(--brand-line)] py-16 text-[var(--brand-muted)]">ამ პროექტში ფოტოები ჯერ არ არის.</p>
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className="content-layer outline-none">
      <CatalogHeader
        back={{ label: 'მთავარი გვერდი', onClick: () => navigateWithinSite('/#projects') }}
        kicker="ნამუშევრების კატალოგი"
        title={selectedCategory === 'all' ? 'ყველა ნამუშევარი' : activeCategory.label}
        description={activeCategory.description}
      />

      <section className="px-[var(--section-space-x)] pb-24">
        <div className="container-xl">
          <nav className="catalog-filter" aria-label="კატეგორიები">
            <div className="catalog-filter-track">
              {categories.map((category) => {
                const isActive = selectedCategory === category.id;

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => navigateToCategory(category.id, category.slug)}
                    aria-pressed={isActive}
                    className="catalog-filter-item"
                  >
                    {category.label}
                    <sup>{getCategoryCount(category, items)}</sup>
                  </button>
                );
              })}
            </div>
          </nav>

          {visibleItems.length > 0 && (
            <motion.div layout className="catalog-grid grid grid-cols-2 items-start gap-[clamp(12px,1.6vw,24px)] sm:grid-cols-3 lg:grid-cols-4">
              <AnimatePresence mode="popLayout">
                {visibleItems.map((item, index) => (
                  <PortfolioCard
                    key={item.id}
                    item={item}
                    onOpen={handleOpenItem}
                    onImageError={useSupabaseSource ? handleImageError : undefined}
                    imageOnly
                    index={index}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          {visibleItems.length === 0 && (
            <p className="border-t border-[var(--brand-line)] py-16 text-[var(--brand-muted)]">
              ამ კატეგორიაში ნამუშევარი ჯერ არ არის.
            </p>
          )}
        </div>
      </section>

      <PortfolioModal
        item={selectedImage}
        items={modalItems}
        onClose={() => setSelectedImage(null)}
        onSelect={setSelectedImage}
        onImageError={useSupabaseSource ? handleImageError : undefined}
        imageOnly
      />
    </main>
  );
}
