/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';
const isProduction = process.env.NODE_ENV === 'production';

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
