/**
 * API Route: /api/admin/categories/rename
 *
 * POST { oldName, newName, createRedirect?: boolean }
 *
 * - Atualiza categories.json (substitui oldName por newName)
 * - Lista posts em src/content/blog e atualiza `category: "{old}"` → `category: "{new}"`
 * - Opcionalmente cria redirect 301 /categoria/old-slug → /categoria/new-slug
 *
 * Implementação MVP: múltiplos commits (1 por arquivo). Para refatorar pra
 * batch via Git tree API quando virar gargalo (categorias com 50+ posts).
 */
import type { APIRoute } from 'astro';
import { readFileFromRepo, writeFileToRepo } from '../../../../plugins/_server';

export const prerender = false;

const CATEGORIES_PATH = 'src/data/categories.json';
const REDIRECTS_PATH = 'src/data/redirects.json';
const VERCEL_JSON_PATH = 'vercel.json';
const BLOG_DIR = 'src/content/blog';

function slugify(s: string): string {
    return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

function toPath(input: string): string {
    if (!input) return input;
    const v = String(input).trim();
    return v.startsWith('/') ? v : '/' + v;
}

function sanitizeVercelSource(input: string): string {
    let v = toPath(input);
    v = v.replace(/\/\?+$/, '');
    v = v.replace(/\(\.\*\)/g, ':rest*');
    v = v.replace(/\(\\d\+\)/g, ':num');
    v = v.replace(/\(\[\^\/\]\+\)/g, ':segment');
    v = v.replace(/^\^/, '').replace(/\$$/, '');
    return v;
}

async function syncVercelJson(redirects: any[]) {
    try {
        let vercelConfig: any = {};
        const existing = await readFileFromRepo(VERCEL_JSON_PATH);
        if (existing) {
            try { vercelConfig = JSON.parse(existing); } catch {}
        }
        const vercelRedirects = redirects
            .filter((r: any) => r.enabled && r.from && r.to)
            .map((r: any) => ({
                source: sanitizeVercelSource(r.from),
                destination: toPath(r.to),
                permanent: r.type === 301,
            }));
        vercelConfig.redirects = vercelRedirects;
        await writeFileToRepo(VERCEL_JSON_PATH, JSON.stringify(vercelConfig, null, 2), {
            message: 'CMS: Sync vercel.json (rename categoria)',
        });
    } catch {}
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const oldName = String(body.oldName || '').trim();
        const newName = String(body.newName || '').trim();
        const createRedirect = body.createRedirect !== false;

        if (!oldName || !newName) {
            return new Response(JSON.stringify({ error: 'oldName e newName são obrigatórios' }), { status: 400 });
        }
        if (oldName === newName) {
            return new Response(JSON.stringify({ error: 'oldName e newName são iguais' }), { status: 400 });
        }

        // 1) Atualiza categories.json
        const catRaw = await readFileFromRepo(CATEGORIES_PATH);
        let categories: string[] = [];
        try { categories = JSON.parse(catRaw || '[]'); } catch {}
        if (!Array.isArray(categories)) categories = [];

        const idx = categories.indexOf(oldName);
        if (idx === -1) {
            return new Response(JSON.stringify({ error: `Categoria "${oldName}" não existe` }), { status: 404 });
        }
        if (categories.includes(newName)) {
            return new Response(JSON.stringify({ error: `Categoria "${newName}" já existe` }), { status: 409 });
        }
        categories[idx] = newName;
        await writeFileToRepo(CATEGORIES_PATH, JSON.stringify(categories, null, 2), {
            message: `CMS: Renomeando categoria "${oldName}" → "${newName}"`,
        });

        // 2) Lista posts e atualiza os afetados
        const token = process.env.GITHUB_TOKEN || '';
        const owner = process.env.GITHUB_OWNER || '';
        const repo = process.env.GITHUB_REPO || '';
        const listUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${BLOG_DIR}`;
        const listRes = await fetch(listUrl, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } });
        const listed = listRes.ok ? await listRes.json() : [];

        let postsUpdated = 0;
        const escapedOld = oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const oldQuoted = new RegExp(`^(\\s*category:\\s*)["']?${escapedOld}["']?(\\s*)$`, 'm');

        for (const f of Array.isArray(listed) ? listed : []) {
            if (!f.name.endsWith('.md')) continue;
            const content = await readFileFromRepo(f.path);
            if (!content) continue;
            if (!oldQuoted.test(content)) continue;
            const updated = content.replace(oldQuoted, (_m, p1, p2) => `${p1}"${newName}"${p2}`);
            if (updated === content) continue;
            await writeFileToRepo(f.path, updated, {
                message: `CMS: Atualizando categoria de ${f.name} (${oldName} → ${newName})`,
            });
            postsUpdated++;
        }

        // 3) Redirect 301 /categoria/old-slug → /categoria/new-slug
        let redirectsCreated = 0;
        if (createRedirect) {
            const oldSlug = slugify(oldName);
            const newSlug = slugify(newName);
            if (oldSlug && newSlug && oldSlug !== newSlug) {
                const redRaw = await readFileFromRepo(REDIRECTS_PATH);
                let redirects: any[] = [];
                try { redirects = JSON.parse(redRaw || '[]'); } catch {}
                if (!Array.isArray(redirects)) redirects = [];

                const from = `/categoria/${oldSlug}`;
                const to = `/categoria/${newSlug}`;
                if (!redirects.some(r => r.from === from)) {
                    redirects.push({
                        id: `cat-rename-${Date.now()}`,
                        from,
                        to,
                        type: 301,
                        enabled: true,
                        createdBy: 'category-rename',
                    });
                    await writeFileToRepo(REDIRECTS_PATH, JSON.stringify(redirects, null, 2), {
                        message: `CMS: Redirect 301 ${from} → ${to}`,
                    });
                    await syncVercelJson(redirects);
                    redirectsCreated = 1;
                }
            }
        }

        return new Response(JSON.stringify({
            success: true,
            postsUpdated,
            redirectsCreated,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err?.message || 'erro' }), { status: 500 });
    }
};
