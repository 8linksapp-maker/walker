import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let sitemap;
try { sitemap = require('@astrojs/sitemap').default; } catch {}

let siteUrl = 'https://example.com';
try {
    const cfg = JSON.parse(readFileSync('src/data/siteConfig.json', 'utf-8'));
    if (cfg.url) {
        let raw = String(cfg.url).trim().replace(/\/$/, '');
        if (raw && !/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
        if (raw) siteUrl = raw;
    }
} catch {}

export default defineConfig({
    site: siteUrl,
    output: 'static',
    adapter: vercel(),
    integrations: [
        react(),
        tailwind({ applyBaseStyles: false }),
        ...(sitemap ? [sitemap()] : []),
    ],
    vite: {
        optimizeDeps: {
            include: ['marked'],
        },
    },
});
