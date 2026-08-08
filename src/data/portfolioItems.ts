/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PortfolioCategory, PortfolioCategoryId } from '../types';

export const ALL_PORTFOLIO_CATEGORY: PortfolioCategory = {
  id: 'all',
  slug: 'all',
  label: 'All',
  description: 'ყველა category folder-ის ფოტო ერთ კატალოგში.'
};

export const PORTFOLIO_CATEGORIES: PortfolioCategory[] = [
  {
    id: 'product-posters',
    slug: 'product-posters',
    label: 'Product Posters',
    folderName: 'Product Posters',
    description: 'პროდუქტის პოსტერების ფოტო-კატალოგი.'
  },
  {
    id: 'branding',
    slug: 'branding',
    label: 'Branding & Identity',
    folderName: 'Branding & Identity',
    description: 'ლოგოების, ბრენდინგისა და identity დიზაინების ფოტო-კატალოგი.'
  },
  {
    id: 'billboards-print',
    slug: 'billboards-print',
    label: 'Billboards & Print',
    folderName: 'Billboards & Print',
    description: 'ბილბორდებისა და print მასალების ფოტო-კატალოგი.'
  }
];

export const PORTFOLIO_FILTERS: PortfolioCategory[] = [
  ALL_PORTFOLIO_CATEGORY,
  ...PORTFOLIO_CATEGORIES
];

export const getPortfolioCategoryById = (id: PortfolioCategoryId) =>
  PORTFOLIO_FILTERS.find((category) => category.id === id) || ALL_PORTFOLIO_CATEGORY;

export const getPortfolioCategoryBySlug = (slug?: string) =>
  PORTFOLIO_FILTERS.find((category) => category.slug === slug) || ALL_PORTFOLIO_CATEGORY;

// To add new portfolio images, drop them into:
// public/portfolio/<matching category folder>/
// The website reads those folders automatically through /api/portfolio-images.
