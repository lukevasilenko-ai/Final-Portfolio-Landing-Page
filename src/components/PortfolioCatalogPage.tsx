/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ImageIcon } from 'lucide-react';
import {
  getPortfolioCategoryById,
  getPortfolioCategoryBySlug
} from '../data/portfolioItems';
import {
  getPortfolioProject,
  PORTFOLIO_FILTERS_WITH_COUNTS,
  PORTFOLIO_ITEMS
} from '../data/catalogImages';
import {
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
  const category = getPortfolioCategoryById(categoryId);
  navigateWithinSite(`/portfolio/${category.slug}/${projectSlug}`);
};

export default function PortfolioCatalogPage() {
  const categories = PORTFOLIO_FILTERS_WITH_COUNTS;
  const items = PORTFOLIO_ITEMS;
  const [route, setRoute] = useState<PortfolioRoute>(getPortfolioRoute);
  const [selectedImage, setSelectedImage] = useState<PortfolioItem | null>(null);

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
    ? getPortfolioProject(selectedCategory, route.projectSlug)
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

  const handleOpenItem = (item: PortfolioItem) => {
    if (item.kind === 'project' && item.projectSlug) {
      navigateToProject(item.category, item.projectSlug);
      return;
    }

    setSelectedImage(item);
  };

  if (activeProject) {
    return (
      <main className="content-layer">
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
                Branding & Identity
              </button>

              <div className="flex max-w-4xl flex-col gap-5">
                <span className="eyebrow">
                  <span className="eyebrow-dot" />
                  Branding project
                </span>
                <h1 className="section-title">{activeProject.title}</h1>
                <p className="section-subtitle max-w-3xl">
                  {activeProject.description || `${activeProject.images.length} image project`}
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
              aria-label={`${activeProject.title} project`}
            >
              {activeProject.images.map((item, index) => (
                <img
                  key={item.id}
                  src={item.image}
                  alt={`${activeProject.title} project image ${index + 1}`}
                  className="block h-auto w-full"
                  loading={index < 2 ? 'eager' : 'lazy'}
                  decoding={index < 2 ? 'sync' : 'async'}
                  onError={(event) => {
                    event.currentTarget.hidden = true;
                  }}
                />
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
    <main className="content-layer">
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
                Photo catalog
              </span>
              <h1 className="section-title">
                {selectedCategory === 'all' ? 'ფოტოების კატალოგი' : activeCategory.label}
              </h1>
              <p className="section-subtitle max-w-3xl">
                აირჩიეთ კატეგორია და ნახეთ შესაბამის folder-ში დამატებული ფოტოები და პროექტები.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-5 pb-24 sm:px-8">
        <div className="container-xl">
          <div className="sticky top-[76px] z-30 -mx-5 mb-8 border-y border-[var(--brand-line)] bg-[var(--brand-header-surface)] px-5 py-4 backdrop-blur-xl sm:-mx-8 sm:px-8">
            <div className="container-xl flex gap-2 overflow-x-auto pb-1">
              {categories.filter((category) => category.id !== 'all').map((category) => {
                const isActive = selectedCategory === category.id;

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => navigateToCategory(category.id, category.slug)}
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
              <p>ამ folder-ში ფოტო ან პროექტი ჯერ არ არის.</p>
            </div>
          )}
        </div>
      </section>

      <PortfolioModal
        item={selectedImage}
        items={modalItems}
        onClose={() => setSelectedImage(null)}
        onSelect={setSelectedImage}
        imageOnly
      />
    </main>
  );
}
