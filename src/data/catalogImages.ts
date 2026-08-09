/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PORTFOLIO_CATEGORIES } from './portfolioItems';
import { PortfolioCategory, PortfolioItem, PortfolioItemCategory } from '../types';

const catalogImageModules = import.meta.glob(
  '../assets/catalog/**/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP,AVIF}',
  {
    eager: true,
    import: 'default',
    query: '?url'
  }
) as Record<string, string>;

const numericCollator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base'
});

const categoryByFolder = new Map(
  PORTFOLIO_CATEGORIES.map((category) => [category.slug, category])
);

interface CatalogFile {
  category: PortfolioItemCategory;
  filename: string;
  url: string;
}

const getLeadingNumber = (filename: string) => {
  const match = filename.match(/^\s*(\d+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
};

const compareCatalogFiles = (first: CatalogFile, second: CatalogFile) => {
  const firstNumber = getLeadingNumber(first.filename);
  const secondNumber = getLeadingNumber(second.filename);

  if (firstNumber !== secondNumber) {
    return firstNumber - secondNumber;
  }

  return numericCollator.compare(first.filename, second.filename);
};

const toImageTitle = (filename: string) =>
  filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim() || filename;

const toImageId = (categoryId: string, filename: string) => {
  const label = filename
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'image';
  const hash = Array.from(`${categoryId}/${filename}`).reduce(
    (value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0,
    0
  ).toString(36);

  return `${categoryId}-${label}-${hash}`;
};

const catalogFiles = Object.entries(catalogImageModules)
  .map(([path, url]) => {
    const match = path.match(/^\.\.\/assets\/catalog\/([^/]+)\/([^/]+)$/);

    if (!match || typeof url !== 'string') {
      return null;
    }

    const [, folder, filename] = match;
    const category = categoryByFolder.get(folder);

    if (!category) {
      return null;
    }

    return {
      category: category.id as PortfolioItemCategory,
      filename,
      url
    };
  })
  .filter((file): file is CatalogFile => Boolean(file))
  .sort((first, second) => {
    if (first.category !== second.category) {
      const firstIndex = PORTFOLIO_CATEGORIES.findIndex((category) => category.id === first.category);
      const secondIndex = PORTFOLIO_CATEGORIES.findIndex((category) => category.id === second.category);

      return firstIndex - secondIndex;
    }

    return compareCatalogFiles(first, second);
  });

export const PORTFOLIO_ITEMS: PortfolioItem[] = catalogFiles.map((file) => {
  const category = PORTFOLIO_CATEGORIES.find((candidate) => candidate.id === file.category)!;

  return {
    id: toImageId(file.category, file.filename),
    title: toImageTitle(file.filename),
    category: file.category,
    serviceType: category.label,
    industry: category.label,
    image: file.url,
    description: '',
    tags: [],
    featured: false,
    filename: file.filename,
    folderName: `src/assets/catalog/${category.slug}`
  };
});

export const PORTFOLIO_FILTERS_WITH_COUNTS: PortfolioCategory[] = [
  {
    id: 'all',
    slug: 'all',
    label: 'All',
    description: 'All portfolio images.',
    count: PORTFOLIO_ITEMS.length
  },
  ...PORTFOLIO_CATEGORIES.map((category) => ({
    ...category,
    count: PORTFOLIO_ITEMS.filter((item) => item.category === category.id).length
  }))
];

export const getPortfolioCategoryCount = (categoryId: string) =>
  PORTFOLIO_FILTERS_WITH_COUNTS.find((category) => category.id === categoryId)?.count ?? 0;
