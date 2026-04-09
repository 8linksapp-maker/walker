import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';

// Lê a URL do site de siteConfig.json (configurável pelo admin)
let siteUrl = 'https://example.com';
try {
    const cfg = JSON.parse(readFileSync('src/data/siteConfig.json', 'utf-8'));
    if (cfg.url) siteUrl = cfg.url.replace(/\/$/, '');
} catch {}

export default defineConfig({
    site: siteUrl,
    output: 'static',
    adapter: vercel(),
    integrations: [
        react(),
        tailwind({ applyBaseStyles: false }),
        sitemap(),
    ],
    vite: {
        optimizeDeps: {
            include: ['marked'],
        },
    },
});
