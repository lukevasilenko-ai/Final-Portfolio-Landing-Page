/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { ArrowRight, ArrowUpRight, FolderKanban } from 'lucide-react';
import { PORTFOLIO_CATEGORIES } from '../data/portfolioItems';
import { getPortfolioCategoryCount } from '../data/catalogImages';
import { navigateWithinSite } from '../navigation';
import FeaturedWorkShowcase from './FeaturedWorkShowcase';

const getCategoryCountLabel = (categoryId: string) => {
  const count = getPortfolioCategoryCount(categoryId);

  if (categoryId === 'branding') {
    return `${count} პროექტი`;
  }

  return `${count} ფოტო`;
};

export default function Projects() {
  return (
    <section id="projects" className="section-wrap">
      <div className="container-xl">
        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="flex max-w-3xl flex-col gap-5">
            <span className="eyebrow">
              <span className="eyebrow-dot" />
              02 // portfolio
            </span>
            <h2 className="section-title">ნამუშევრები მიმართულებების მიხედვით.</h2>
            <p className="section-subtitle max-w-2xl">
              დაათვალიერეთ პოსტერები, ბრენდინგის პროექტები და საბეჭდი ნამუშევრები ერთ სივრცეში.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigateWithinSite('/portfolio')}
            className="button-secondary w-fit gap-2 text-xs"
          >
            სრული კატალოგი
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <FeaturedWorkShowcase />

        <div className="mb-4 mt-10 flex items-center justify-between gap-4">
          <span className="font-mono text-[10px] font-bold uppercase text-[var(--brand-soft)]">
            ყველა კატეგორია
          </span>
          <span className="h-px flex-1 bg-[var(--brand-line)]" aria-hidden="true" />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PORTFOLIO_CATEGORIES.map((category, index) => (
            <motion.button
              key={category.id}
              type="button"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.28, delay: index * 0.035 }}
              onClick={() => navigateWithinSite(`/portfolio/${category.slug}`)}
              className="surface-card group flex min-h-[150px] flex-col justify-between p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-[var(--brand-line-strong)] hover:bg-white/90 hover:shadow-[var(--brand-shadow)]"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand-accent-soft)] text-[var(--brand-accent)]">
                  <FolderKanban className="h-5 w-5" />
                </span>
                <ArrowUpRight className="h-5 w-5 text-[var(--brand-soft)] transition-colors group-hover:text-[var(--brand-accent)]" />
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-lg font-extrabold leading-snug text-[var(--brand-ink)]">
                  {category.label}
                </h3>
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--brand-soft)]">
                  {getCategoryCountLabel(category.id)}
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
}
