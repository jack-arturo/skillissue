import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';
import { d1, r2 } from '@emdash-cms/cloudflare';
import { defineConfig } from 'astro/config';
import emdash from 'emdash/astro';
import { fileURLToPath } from 'node:url';

const figuresPlugin = fileURLToPath(
  new URL('./src/lib/emdash-figures/plugin.ts', import.meta.url)
);
const figuresComponents = fileURLToPath(
  new URL('./src/lib/emdash-figures/block-components.ts', import.meta.url)
);

// Hybrid: this Worker owns /essays/* and /_emdash/* on skillissue.sh.
// The skills catalog stays on Cloudflare Pages (repo root build → site/).
export default defineConfig({
  site: 'https://skillissue.sh',
  output: 'server',
  adapter: cloudflare(),
  integrations: [
    react(),
    emdash({
      siteUrl: 'https://skillissue.sh',
      toolbar: 'client',
      database: d1({ binding: 'DB', session: 'auto' }),
      storage: r2({ binding: 'MEDIA' }),
      plugins: [
        {
          id: 'emdash-plugin-figures',
          version: '0.1.0',
          entrypoint: figuresPlugin,
          componentsEntry: figuresComponents,
        },
      ],
      admin: {
        siteName: 'skillissue essays',
        logo: '/favicon.svg',
        favicon: '/favicon.svg',
      },
    }),
  ],
  devToolbar: { enabled: false },
});
