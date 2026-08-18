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

export type PortfolioCategoryId =
  | 'all'
  | 'product-posters'
  | 'branding'
  | 'billboards-print';

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

export interface PortfolioItem {
  id: string;
  title: string;
  category: PortfolioItemCategory;
  kind?: PortfolioItemKind;
  serviceType?: string;
  industry?: string;
  image: string;
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
  cover: string;
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
