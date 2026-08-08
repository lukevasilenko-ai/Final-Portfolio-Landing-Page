/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ImageIcon, LoaderCircle } from 'lucide-react';
import {
  PORTFOLIO_FILTERS,
  getPortfolioCategoryBySlug
} from '../data/portfolioItems';
import { PortfolioCategory, PortfolioCategoryId, PortfolioItem } from '../types';
import PortfolioCard from './PortfolioCard';
import PortfolioModal from './PortfolioModal';

interface PortfolioApiResponse {
  categories: PortfolioCategory[];
  items: PortfolioItem[];
}

const getSlugFromPath = () => {
  const [, page, slug] = window.location.pathname.split('/');
  return page === 'portfolio' ? slug : undefined;
};

const getCategoryFromSlug = (slug: string | undefined, categories: PortfolioCategory[]) =>
  categories.find((category) => category.slug === slug) || getPortfolioCategoryBySlug(slug);

const getCategoryCount = (category: PortfolioCategory, items: PortfolioItem[]) =>
  category.id === 'all'
    ? items.length
    : items.filter((item) => item.category === category.id).length;

const navigateToCategory = (categoryId: PortfolioCategoryId, slug: string) => {
  const path = categoryId === 'all' ? '/portfolio' : `/portfolio/${slug}`;
  window.history.pushState(null, '', path);
  window.dispatchEvent(new Event('app:navigate'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

export default function PortfolioCatalogPage() {
  const [categories, setCategories] = useState<PortfolioCategory[]>(PORTFOLIO_FILTERS);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<PortfolioCategoryId>(() =>
    getPortfolioCategoryBySlug(getSlugFromPath()).id
  );
  const [selectedProject, setSelectedProject] = useState<PortfolioItem | null>(null);

  useEffect(() => {
    let isMounted = true;
    let hasLoadedOnce = false;

    const loadPortfolioImages = async () => {
      try {
        const response = await fetch('/api/portfolio-images', {
          headers: { Accept: 'application/json' },
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error(`Portfolio API failed with ${response.status}`);
        }

        const data = (await response.json()) as PortfolioApiResponse;

        if (!Array.isArray(data.categories) || !Array.isArray(data.items)) {
          throw new Error('Portfolio API returned an invalid payload.');
        }

        if (isMounted) {
          setCategories(data.categories);
          setItems(data.items);
          setLoadError('');
          hasLoadedOnce = true;
        }
      } catch (error) {
        console.error(error);

        if (isMounted && !hasLoadedOnce) {
          setCategories(PORTFOLIO_FILTERS);
          setItems([]);
          setLoadError('ფოტოების ჩატვირთვა ვერ მოხერხდა. გადაამოწმეთ portfolio folder-ები.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadPortfolioImages();
    const refreshInterval = window.setInterval(loadPortfolioImages, 2000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        loadPortfolioImages();
      }
    };

    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      isMounted = false;
      window.clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  useEffect(() => {
    const updateCategoryFromPath = () => {
      setSelectedCategory(getCategoryFromSlug(getSlugFromPath(), categories).id);
    };

    updateCategoryFromPath();
    window.addEventListener('popstate', updateCategoryFromPath);
    window.addEventListener('app:navigate', updateCategoryFromPath);

    return () => {
      window.removeEventListener('popstate', updateCategoryFromPath);
      window.removeEventListener('app:navigate', updateCategoryFromPath);
    };
  }, [categories]);

  const activeCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategory) || categories[0],
    [categories, selectedCategory]
  );

  const visibleItems = useMemo(
    () =>
      selectedCategory === 'all'
        ? items
        : items.filter((item) => item.category === selectedCategory),
    [items, selectedCategory]
  );

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
            <a href="/#projects" className="button-secondary w-fit gap-2 text-xs">
              <ArrowLeft className="h-4 w-4" />
              უკან დაბრუნება
            </a>

            <div className="flex max-w-4xl flex-col gap-5">
              <span className="eyebrow">
                <span className="eyebrow-dot" />
                Photo catalog
              </span>
              <h1 className="section-title">
                {selectedCategory === 'all' ? 'ფოტოების კატალოგი' : activeCategory.label}
              </h1>
              <p className="section-subtitle max-w-3xl">
                აირჩიეთ კატეგორია და ნახეთ შესაბამის folder-ში დამატებული ფოტოები.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="px-5 pb-24 sm:px-8">
        <div className="container-xl">
          <div className="sticky top-[76px] z-30 -mx-5 mb-8 border-y border-[var(--brand-line)] bg-[rgba(244,246,242,0.84)] px-5 py-4 backdrop-blur-xl sm:-mx-8 sm:px-8">
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
                        ? 'bg-[var(--brand-accent)] text-white shadow-[0_10px_24px_rgba(36,72,61,0.16)]'
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

          {isLoading && (
            <div className="surface-card flex items-center justify-center gap-3 p-8 text-[var(--brand-muted)]">
              <LoaderCircle className="h-5 w-5 animate-spin text-[var(--brand-accent)]" />
              ფოტოები იტვირთება
            </div>
          )}

          {!isLoading && loadError && (
            <div className="surface-card p-8 text-center text-[var(--brand-muted)]">
              {loadError}
            </div>
          )}

          {!isLoading && !loadError && visibleItems.length > 0 && (
            <motion.div layout className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <AnimatePresence mode="popLayout">
                {visibleItems.map((item) => (
                  <PortfolioCard
                    key={item.id}
                    item={item}
                    onOpen={setSelectedProject}
                    imageOnly
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          )}

          {!isLoading && !loadError && visibleItems.length === 0 && (
            <div className="surface-card mt-4 flex flex-col items-center gap-4 p-10 text-center text-[var(--brand-muted)]">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[rgba(36,72,61,0.1)] text-[var(--brand-accent)]">
                <ImageIcon className="h-5 w-5" />
              </span>
              <p>ამ folder-ში ფოტო ჯერ არ არის.</p>
            </div>
          )}
        </div>
      </section>

      <PortfolioModal
        item={selectedProject}
        items={visibleItems}
        onClose={() => setSelectedProject(null)}
        onSelect={setSelectedProject}
        imageOnly
      />
    </main>
  );
}
