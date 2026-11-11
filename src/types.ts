/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Project {
  id: string;
  title: string;
  description: string;
  longDescription: string;
  tags: string[];
  category: 'frontend' | 'fullstack' | 'ai-ml' | 'design';
  image: string;
  coverText?: string;
  demoUrl?: string;
  githubUrl?: string;
  stats: {
    metric1?: { label: string; value: string };
    metric2?: { label: string; value: string };
  };
  features: string[];
}

export type PortfolioCategoryId = string;

export type PortfolioItemCategory = Exclude<PortfolioCategoryId, 'all'>;

export type PortfolioItemKind = 'image' | 'project';

export interface PortfolioCategory {
  id: PortfolioCategoryId;
  slug: string;
  label: string;
  description: string;
  folderName?: string;
  count?: number;
}

/** Resized copies of an image for display at tile size; see scripts/generate-catalog-variants.mjs. */
export interface ResponsiveImage {
  /** A mid-size variant, used where `srcSet` is not supported. */
  src: string;
  /** Every variant with its width descriptor, smallest first. */
  srcSet: string;
  /** Dimensions of the largest variant; they give the image's aspect ratio before it loads. */
  width: number;
  height: number;
}

export interface PortfolioItem {
  id: string;
  title: string;
  category: PortfolioItemCategory;
  kind?: PortfolioItemKind;
  serviceType?: string;
  industry?: string;
  /** The original, full-size image (lightbox and project pages). */
  image: string;
  /** Smaller variants for tiles; absent when none were generated (e.g. Supabase images). */
  thumbnail?: ResponsiveImage;
  imagePath?: string;
  categoryLabel?: string;
  description?: string;
  tags?: string[];
  featured?: boolean;
  year?: string;
  client?: string;
  filename?: string;
  folderName?: string;
  projectSlug?: string;
  imageCount?: number;
}

export interface PortfolioProject {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: PortfolioItemCategory;
  categoryLabel?: string;
  cover: string;
  coverThumbnail?: ResponsiveImage;
  coverPath?: string;
  tags: string[];
  tools: string[];
  year?: string;
  publishedDate?: string;
  author?: string;
  location?: string;
  folderName: string;
  images: PortfolioItem[];
}

export interface Experience {
  id: string;
  role: string;
  company: string;
  period: string;
  description: string;
  highlights: string[];
  tags: string[];
}

export interface SkillCategory {
  id: string;
  name: string;
  skills: { name: string; level: number; iconName?: string }[];
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  timestamp: string;
}
