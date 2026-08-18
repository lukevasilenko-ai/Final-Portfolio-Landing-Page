/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { PORTFOLIO_CATEGORIES } from './portfolioItems';
import {
  PortfolioCategory,
  PortfolioItem,
  PortfolioItemCategory,
  PortfolioProject
} from '../types';

const catalogImageModules = import.meta.glob(
  '../assets/catalog/**/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP,AVIF}',
  {
    eager: true,
    import: 'default',
    query: '?url'
  }
) as Record<string, string>;

const catalogProjectManifestModules = import.meta.glob(
  '../assets/catalog/branding-identity/*/project.json',
  {
    eager: true,
    import: 'default'
  }
) as Record<string, unknown>;

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

interface ProjectAssetFile {
  filename: string;
  url: string;
}

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const readStringArray = (value: unknown) =>
  Array.isArray(value)
    ? value.map(readString).filter((item): item is string => Boolean(item))
    : [];

const getLeadingNumber = (filename: string) => {
  const match = filename.match(/^\s*(\d+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
};

const compareFilenames = (first: string, second: string) => {
  const firstNumber = getLeadingNumber(first);
  const secondNumber = getLeadingNumber(second);

  if (firstNumber !== secondNumber) {
    return firstNumber - secondNumber;
  }

  return numericCollator.compare(first, second);
};

const compareCatalogFiles = (first: CatalogFile, second: CatalogFile) =>
  compareFilenames(first.filename, second.filename);

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

const directCatalogFiles = Object.entries(catalogImageModules)
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

const directPortfolioItems: PortfolioItem[] = directCatalogFiles.map((file) => {
  const category = PORTFOLIO_CATEGORIES.find((candidate) => candidate.id === file.category)!;

  return {
    id: toImageId(file.category, file.filename),
    title: toImageTitle(file.filename),
    category: file.category,
    kind: 'image',
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

const projectAssetsByFolder = new Map<string, ProjectAssetFile[]>();

for (const [path, url] of Object.entries(catalogImageModules)) {
  const match = path.match(/^\.\.\/assets\/catalog\/branding-identity\/([^/]+)\/([^/]+)$/);

  if (!match || typeof url !== 'string') {
    continue;
  }

  const [, folder, filename] = match;
  const files = projectAssetsByFolder.get(folder) ?? [];
  files.push({ filename, url });
  projectAssetsByFolder.set(folder, files);
}

export const PORTFOLIO_PROJECTS: PortfolioProject[] = Object.entries(catalogProjectManifestModules)
  .map(([path, manifestValue]): PortfolioProject | null => {
    const match = path.match(/^\.\.\/assets\/catalog\/branding-identity\/([^/]+)\/project\.json$/);

    if (!match || !isRecord(manifestValue)) {
      return null;
    }

    const folder = match[1];
    const files = projectAssetsByFolder.get(folder) ?? [];
    const cover = files.find((file) => /^cover\.[^.]+$/i.test(file.filename));

    if (!cover) {
      return null;
    }

    const category: PortfolioItemCategory = 'branding';
    const slug = readString(manifestValue.slug) ?? folder;
    const title = readString(manifestValue.title) ?? toImageTitle(folder);
    const description = readString(manifestValue.description) ?? '';
    const tags = readStringArray(manifestValue.tags);
    const tools = readStringArray(manifestValue.tools);
    const publishedDate = readString(manifestValue.publishedDate)
      ?? readString(manifestValue.publishedAt);
    const authorRecord = isRecord(manifestValue.author) ? manifestValue.author : null;
    const projectId = readString(manifestValue.id) ?? toImageId(category, folder);
    const folderName = `src/assets/catalog/branding-identity/${folder}`;
    const imageFiles = files
      .filter((file) => !/^cover\.[^.]+$/i.test(file.filename))
      .sort((first, second) => compareFilenames(first.filename, second.filename));
    const images: PortfolioItem[] = imageFiles.map((file) => ({
      id: toImageId(category, `${folder}/${file.filename}`),
      title: `${title} · ${toImageTitle(file.filename)}`,
      category,
      kind: 'image',
      serviceType: 'Branding & Identity',
      industry: 'Brand Identity',
      image: file.url,
      description: title,
      tags,
      year: publishedDate?.slice(0, 4),
      filename: file.filename,
      folderName
    }));

    return {
      id: projectId,
      slug,
      title,
      description,
      category,
      cover: cover.url,
      tags,
      tools,
      year: publishedDate?.slice(0, 4),
      publishedDate,
      author: authorRecord ? readString(authorRecord.name) : undefined,
      location: authorRecord ? readString(authorRecord.location) : undefined,
      folderName,
      images
    };
  })
  .filter((project): project is PortfolioProject => Boolean(project))
  .sort((first, second) => numericCollator.compare(first.slug, second.slug));

const projectPortfolioItems: PortfolioItem[] = PORTFOLIO_PROJECTS.map((project) => ({
  id: `${project.id}-cover`,
  title: project.title,
  category: project.category,
  kind: 'project',
  serviceType: 'Branding & Identity',
  industry: 'Brand Identity',
  image: project.cover,
  description: project.description,
  tags: project.tags,
  year: project.year,
  filename: 'cover.webp',
  folderName: project.folderName,
  projectSlug: project.slug,
  imageCount: project.images.length
}));

export const PORTFOLIO_ITEMS: PortfolioItem[] = [
  ...directPortfolioItems,
  ...projectPortfolioItems
].sort((first, second) => {
  if (first.category !== second.category) {
    const firstIndex = PORTFOLIO_CATEGORIES.findIndex((category) => category.id === first.category);
    const secondIndex = PORTFOLIO_CATEGORIES.findIndex((category) => category.id === second.category);

    return firstIndex - secondIndex;
  }

  return compareFilenames(first.filename ?? first.title, second.filename ?? second.title);
});

export const PORTFOLIO_FILTERS_WITH_COUNTS: PortfolioCategory[] = [
  {
    id: 'all',
    slug: 'all',
    label: 'All',
    description: 'All portfolio images and projects.',
    count: PORTFOLIO_ITEMS.length
  },
  ...PORTFOLIO_CATEGORIES.map((category) => ({
    ...category,
    count: PORTFOLIO_ITEMS.filter((item) => item.category === category.id).length
  }))
];

export const getPortfolioCategoryCount = (categoryId: string) =>
  PORTFOLIO_FILTERS_WITH_COUNTS.find((category) => category.id === categoryId)?.count ?? 0;

export const getPortfolioProject = (categoryId: PortfolioItemCategory, slug?: string) =>
  PORTFOLIO_PROJECTS.find((project) => project.category === categoryId && project.slug === slug);
