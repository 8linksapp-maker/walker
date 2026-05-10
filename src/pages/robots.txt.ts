import type { APIRoute } from 'astro';
import { readData } from '../lib/readData';
import { generateRobotsTxt } from '../lib/robotsDefault';

// Pré-renderiza no build → vira /robots.txt estático servido pelo CDN
// (em static output isso já é default; em server, força a estática)
export const prerender = true;

export const GET: APIRoute = () => {
    const cfg = readData<any>('siteConfig.json') || {};
    const body = generateRobotsTxt(cfg.url || '', cfg.robots || {});
    return new Response(body, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
};
