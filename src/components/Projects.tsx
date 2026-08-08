/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, ArrowUpRight, FolderKanban } from 'lucide-react';
import { PORTFOLIO_CATEGORIES } from '../data/portfolioItems';
import { PortfolioCategory } from '../types';

interface PortfolioApiResponse {
  categories: PortfolioCategory[];
}

const navigateTo = (path: string) => {
  window.history.pushState(null, '', path);
  window.dispatchEvent(new Event('app:navigate'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

export default function Projects() {
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let isMounted = true;

    const loadCategoryCounts = async () => {
      try {
        const response = await fetch('/api/portfolio-images', {
          headers: { Accept: 'application/json' },
          cache: 'no-store'
        });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as PortfolioApiResponse;
        const nextCounts = Object.fromEntries(
          data.categories.map((category) => [category.id, category.count ?? 0])
        );

        if (isMounted) {
          setCategoryCounts(nextCounts);
        }
      } catch {
        // Keep the latest valid counts during a transient refresh failure.
      }
    };

    loadCategoryCounts();
    const refreshInterval = window.setInterval(loadCategoryCounts, 4000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        loadCategoryCounts();
      }
    };

    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      isMounted = false;
      window.clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  return (
    <section id="projects" className="section-wrap">
      <div className="container-xl">
        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="flex max-w-3xl flex-col gap-5">
            <span className="eyebrow">
              <span className="eyebrow-dot" />
              02 // portfolio
            </span>
            <h2 className="section-title">ნამუშევრების კატალოგი category folder-ებით.</h2>
          </div>

          <button
            type="button"
            onClick={() => navigateTo('/portfolio')}
            className="button-secondary w-fit gap-2 text-xs"
          >
            სრული კატალოგი
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PORTFOLIO_CATEGORIES.map((category, index) => (
            <motion.button
              key={category.id}
              type="button"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.28, delay: index * 0.035 }}
              onClick={() => navigateTo(`/portfolio/${category.slug}`)}
              className="surface-card group flex min-h-[150px] flex-col justify-between p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-[var(--brand-line-strong)] hover:bg-white/90 hover:shadow-[var(--brand-shadow)]"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[rgba(36,72,61,0.1)] text-[var(--brand-accent)]">
                  <FolderKanban className="h-5 w-5" />
                </span>
                <ArrowUpRight className="h-5 w-5 text-[var(--brand-soft)] transition-colors group-hover:text-[var(--brand-accent)]" />
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-extrabold leading-snug text-[var(--brand-ink)]">
                  {category.label}
                </h3>
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--brand-soft)]">
                  {categoryCounts[category.id] ?? 0} photos
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}
