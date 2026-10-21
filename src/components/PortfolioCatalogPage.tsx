/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ImageIcon } from 'lucide-react';
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
      items: current.items.map((item) => item.imagePath === path ? { ...item, image: signedUrl } : item),
      projects: current.projects.map((project) => ({
        ...project,
        cover: project.coverPath === path ? signedUrl : project.cover,
        images: project.images.map((item) => item.imagePath === path ? { ...item, image: signedUrl } : item),
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
              <span className="eyebrow"><span className="eyebrow-dot" />კატალოგი</span>
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
        <section className="section-wrap pb-10">
          <div className="container-xl">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="flex min-h-[300px] flex-col justify-end gap-7 border-b border-[var(--brand-line)] pb-10 pt-20"
            >
              <button
                type="button"
                onClick={() => navigateToCategory(activeCategory.id, activeCategory.slug)}
                className="button-secondary w-fit gap-2 text-xs"
              >
                <ArrowLeft className="h-4 w-4" />
                {activeCategory.label}
              </button>

              <div className="flex max-w-4xl flex-col gap-5">
                <span className="eyebrow">
                  <span className="eyebrow-dot" />
                  ბრენდინგის პროექტი
                </span>
                <h1 className="section-title">{activeProject.title}</h1>
                <p className="section-subtitle max-w-3xl">
                  {activeProject.description || `${activeProject.images.length} ნამუშევარი ერთ პროექტში`}
                </p>

                <div className="flex flex-wrap gap-2">
                  {activeProject.year && (
                    <span className="tag-chip px-3 py-1.5">{activeProject.year}</span>
                  )}
                  {activeProject.tools.map((tool) => (
                    <span key={tool} className="tag-chip px-3 py-1.5">{tool}</span>
                  ))}
                  {activeProject.tags.map((tag) => (
                    <span key={tag} className="tag-chip px-3 py-1.5">{tag}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="px-4 pb-24 sm:px-8">
          {activeProject.images.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="mx-auto w-full max-w-[1180px] overflow-hidden bg-white shadow-[var(--brand-shadow)]"
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
            <div className="container-xl px-5 sm:px-8">
              <div className="surface-card flex flex-col items-center gap-4 p-10 text-center text-[var(--brand-muted)]">
                <ImageIcon className="h-5 w-5 text-[var(--brand-accent)]" />
                <p>ამ პროექტში ფოტოები ჯერ არ არის.</p>
              </div>
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className="content-layer outline-none">
      <section className="section-wrap pb-10">
        <div className="container-xl">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="flex min-h-[270px] flex-col justify-end gap-7 border-b border-[var(--brand-line)] pb-10 pt-20"
          >
            <button
              type="button"
              onClick={() => navigateWithinSite('/#projects')}
              className="button-secondary w-fit gap-2 text-xs"
            >
              <ArrowLeft className="h-4 w-4" />
              უკან დაბრუნება
            </button>

            <div className="flex max-w-4xl flex-col gap-5">
              <span className="eyebrow">
                <span className="eyebrow-dot" />
                ნამუშევრების კატალოგი
              </span>
              <h1 className="section-title">
                {selectedCategory === 'all' ? 'ფოტოების კატალოგი' : activeCategory.label}
              </h1>
              <p className="section-subtitle max-w-3xl">
                {activeCategory.description}
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-5 pb-24 sm:px-8">
        <div className="container-xl">
          <div className="sticky top-[76px] z-30 -mx-5 mb-8 border-y border-[var(--brand-line)] bg-[var(--brand-header-surface)] px-5 py-4 backdrop-blur-xl sm:-mx-8 sm:px-8">
            <div className="container-xl flex gap-2 overflow-x-auto pb-1">
              {categories.map((category) => {
                const isActive = selectedCategory === category.id;

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => navigateToCategory(category.id, category.slug)}
                    aria-pressed={isActive}
                    className={`shrink-0 rounded-full px-4 py-2 font-mono text-xs font-bold transition-all duration-200 ${
                      isActive
                        ? 'bg-[var(--brand-accent)] text-[var(--brand-on-accent)] shadow-[var(--brand-accent-shadow-sm)]'
                        : 'border border-[var(--brand-line)] bg-white/58 text-[var(--brand-muted)] hover:bg-white hover:text-[var(--brand-ink)]'
                    }`}
                  >
                    {category.label}
                    <span className="ml-2 opacity-70">{getCategoryCount(category, items)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {visibleItems.length > 0 && (
            <motion.div layout className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <AnimatePresence mode="popLayout">
                {visibleItems.map((item) => (
                  <PortfolioCard
                    key={item.id}
                    item={item}
                    onOpen={handleOpenItem}
                    onImageError={useSupabaseSource ? handleImageError : undefined}
                    imageOnly
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          {visibleItems.length === 0 && (
            <div className="surface-card mt-4 flex flex-col items-center gap-4 p-10 text-center text-[var(--brand-muted)]">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--brand-accent-soft)] text-[var(--brand-accent)]">
                <ImageIcon className="h-5 w-5" />
              </span>
              <p>ამ კატეგორიაში ნამუშევარი ჯერ არ არის.</p>
            </div>
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
