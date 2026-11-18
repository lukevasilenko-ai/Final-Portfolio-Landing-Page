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

const isStaging = process.argv.includes('--staging');
const isProduction = process.env.NODE_ENV === 'production';
if (isStaging && isProduction) {
  throw new Error('Staging mode cannot run with NODE_ENV=production.');
}

const port = isStaging ? 4175 : Number(process.env.PORT || 3000);
const host = isStaging ? '127.0.0.1' : process.env.HOST || '0.0.0.0';

if (isProduction && !isStaging) {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
} else {
  const { createServer, loadEnv } = await import('vite');
  const mode = isStaging ? 'staging' : 'development';

  if (isStaging) {
    for (const key of [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_PUBLISHABLE_KEY',
      'VITE_PUBLIC_CATALOG_SOURCE',
    ]) {
      delete process.env[key];
    }

    const stagingEnv = loadEnv(mode, __dirname, 'VITE_');
    if (stagingEnv.VITE_SUPABASE_URL !== 'https://xkdmtkckxwcsrxnokcah.supabase.co') {
      throw new Error('Staging server refused to start: the configured Supabase URL is not the approved staging project.');
    }
    if (!stagingEnv.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) {
      throw new Error('Staging server refused to start: add the staging publishable key to .env.staging.local.');
    }
    if (stagingEnv.VITE_PUBLIC_CATALOG_SOURCE !== 'supabase') {
      throw new Error('Staging server refused to start: VITE_PUBLIC_CATALOG_SOURCE must be supabase.');
    }
  }

  const vite = await createServer({
    mode,
    appType: 'spa',
    server: {
      middlewareMode: true,
      host,
      port,
      // Staging is manually refreshed so competing local dev servers cannot trigger HMR reloads.
      hmr: isStaging ? false : undefined,
    }
  });

  app.use(vite.middlewares);
}

app.listen(port, host, () => {
  const displayHost = host === '0.0.0.0' ? '127.0.0.1' : host;
  console.log(`Server running at http://${displayHost}:${port}`);
});
