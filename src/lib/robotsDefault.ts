/**
 * Gerador de robots.txt baseado em siteConfig.url + siteConfig.robots.
 *
 * Schema esperado em siteConfig.robots:
 * {
 *   "noindex": boolean,        // se true, bloqueia tudo (modo dev/staging)
 *   "extraDisallow": string[]  // paths adicionais a bloquear (alem do default /admin /api)
 * }
 *
 * Default sempre inclui:
 * - User-agent: *
 * - Allow: /
 * - Disallow: /admin, /admin/, /api/
 * - Sitemap: <url>/sitemap-index.xml (se siteConfig.url estiver setada)
 */

export interface RobotsConfig {
    noindex?: boolean;
    extraDisallow?: string[];
}

export function generateRobotsTxt(siteUrl: string, robots: RobotsConfig = {}): string {
    // Modo dev/staging — bloqueia tudo
    if (robots.noindex === true) {
        return 'User-agent: *\nDisallow: /\n';
    }

    const lines = [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /admin/',
        'Disallow: /api/',
    ];

    if (Array.isArray(robots.extraDisallow)) {
        for (const path of robots.extraDisallow) {
            const p = (path || '').toString().trim();
            if (!p) continue;
            const normalized = p.startsWith('/') ? p : `/${p}`;
            lines.push(`Disallow: ${normalized}`);
        }
    }

    if (siteUrl) {
        const url = siteUrl.replace(/\/+$/, '');
        if (/^https?:\/\//i.test(url)) {
            lines.push('');
            lines.push(`Sitemap: ${url}/sitemap-index.xml`);
        }
    }

    return lines.join('\n') + '\n';
}
