/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';

const portfolioRoot = path.join(__dirname, 'public', 'portfolio');
const portfolioImageExtensions = new Set([
  '.jpg',
  '.jpeg',
  '.jfif',
  '.png',
  '.webp',
  '.gif',
  '.avif',
  '.bmp',
  '.svg'
]);
const portfolioCategories = [
  {
    id: 'product-posters',
    slug: 'product-posters',
    label: 'Product Posters',
    folderName: 'Product Posters',
    description: 'Product poster portfolio images.'
  },
  {
    id: 'branding',
    slug: 'branding',
    label: 'Branding & Identity',
    folderName: 'Branding & Identity',
    description: 'Branding and identity portfolio images.'
  },
  {
    id: 'billboards-print',
    slug: 'billboards-print',
    label: 'Billboards & Print',
    folderName: 'Billboards & Print',
    description: 'Billboard and print portfolio images.'
  }
];

const toPublicPortfolioPath = (folderName, fileName) =>
  `/portfolio/${encodeURIComponent(folderName)}/${encodeURIComponent(fileName)}`;

const toImageId = (categoryId, fileName) => {
  const normalizedFileName = fileName
    .toLowerCase()
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const uniqueSuffix = Buffer.from(fileName).toString('base64url');

  return `${categoryId}-${normalizedFileName || 'image'}-${uniqueSuffix}`;
};

const toImageTitle = (fileName) =>
  fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim() || fileName;

const readPortfolioImages = async () => {
  const items = [];
  const categories = [];

  for (const category of portfolioCategories) {
    let imageFiles = [];

    try {
      const entries = await fs.readdir(path.join(portfolioRoot, category.folderName), {
        withFileTypes: true
      });

      imageFiles = entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .filter((fileName) => portfolioImageExtensions.has(path.extname(fileName).toLowerCase()))
        .sort((first, second) => first.localeCompare(second, 'en', { numeric: true }));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }

    categories.push({
      ...category,
      count: imageFiles.length
    });

    for (const fileName of imageFiles) {
      items.push({
        id: toImageId(category.id, fileName),
        title: toImageTitle(fileName),
        category: category.id,
        serviceType: category.label,
        industry: category.label,
        image: toPublicPortfolioPath(category.folderName, fileName),
        description: '',
        tags: [],
        featured: false,
        filename: fileName,
        folderName: category.folderName
      });
    }
  }

  return {
    categories: [
      {
        id: 'all',
        slug: 'all',
        label: 'All',
        description: 'All portfolio images.',
        count: items.length
      },
      ...categories
    ],
    items
  };
};

app.use('/portfolio', express.static(portfolioRoot, { maxAge: 0 }));

app.get('/api/portfolio-images', async (_req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.json(await readPortfolioImages());
  } catch (error) {
    console.error('Unable to read portfolio images:', error);
    res.status(500).json({ error: 'Unable to read portfolio images.' });
  }
});

if (isProduction) {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({
    appType: 'spa',
    server: {
      middlewareMode: true,
      host,
      port
    }
  });

  app.use(vite.middlewares);
}

app.listen(port, host, () => {
  const displayHost = host === '0.0.0.0' ? '127.0.0.1' : host;
  console.log(`Server running at http://${displayHost}:${port}`);
});
