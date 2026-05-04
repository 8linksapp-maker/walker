/**
 * Helper para gerar URL dos posts respeitando siteConfig.postUrlPrefix.
 * - postUrlPrefix === 'blog' → /blog/slug
 * - postUrlPrefix === '' (default) ou ausente → /slug (URL limpa)
 */
import { readData } from './readData';

const siteConfig = readData<any>('siteConfig.json');
const rawPrefix = siteConfig?.postUrlPrefix;
const prefix = rawPrefix === 'blog' ? 'blog' : '';

export const POST_URL_PREFIX: string = prefix;
export const BLOG_BASE: string = prefix ? `/${prefix}` : '';

export function postUrl(slug: string): string {
    return `${BLOG_BASE}/${slug}`;
}
