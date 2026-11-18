/**
 * The home page's category list. On the live site it follows the admin: active categories in
 * their order, each with its count of published works (categories with no works yet are left
 * out). Until that loads, or where the catalog isn't read from Supabase (local preview), the
 * bundled categories are shown.
 */
import { useEffect, useState } from 'react';
import { PORTFOLIO_CATEGORIES } from './portfolioItems';
import { getPortfolioCategoryCount } from './catalogImages';
import { categoryCountLabel } from './categorySummary';

export interface HomeCategory {
  id: string;
  slug: string;
  label: string;
  count: number;
  countLabel: string;
}

const BUNDLED: HomeCategory[] = PORTFOLIO_CATEGORIES.map((category) => ({
  id: category.id,
  slug: category.slug,
  label: category.label,
  count: getPortfolioCategoryCount(category.id),
  countLabel: categoryCountLabel(getPortfolioCategoryCount(category.id), category.id === 'branding' ? 'project' : 'photo'),
}));

const liveEnabled = import.meta.env.VITE_PUBLIC_CATALOG_SOURCE === 'supabase';
let cached: HomeCategory[] | null = null;
let request: Promise<HomeCategory[]> | null = null;

function loadLive() {
  request ??= import('./supabaseCatalog')
    .then(({ loadCategorySummaries }) => loadCategorySummaries())
    .then((list) => {
      cached = list
        .filter((category) => category.count > 0)
        .map((category) => ({ id: category.id, slug: category.slug, label: category.label, count: category.count, countLabel: categoryCountLabel(category.count, category.unit) }));
      return cached;
    })
    .catch((error: unknown) => {
      request = null;
      throw error;
    });
  return request;
}

export function useHomeCategories(): HomeCategory[] {
  const [live, setLive] = useState<HomeCategory[] | null>(cached);
  useEffect(() => {
    if (!liveEnabled) return;
    let active = true;
    loadLive().then((list) => { if (active) setLive(list); }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  return live ?? BUNDLED;
}
