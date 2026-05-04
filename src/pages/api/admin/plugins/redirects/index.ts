/**
 * API Route: /api/admin/plugins/redirects
 *
 * GET  — lê src/data/redirects.json
 * PUT  — escreve src/data/redirects.json + sincroniza vercel.json
 */
import type { APIRoute } from 'astro';
import { readDataFile, writeFileToRepo, readFileFromRepo } from '../../../../../plugins/_server';

export const prerender = false;

const REDIRECTS_PATH = 'src/data/redirects.json';
const VERCEL_JSON_PATH = 'vercel.json';

/** Extrai apenas o pathname caso o aluno cole URL completa (https://site.com/x → /x) */
function toPath(input: string): string {
    if (!input) return input;
    const v = String(input).trim();
    if (/^https?:\/\//i.test(v)) {
        try {
            const u = new URL(v);
            return (u.pathname + u.search + u.hash).replace(/\/+$/, '') || '/';
        } catch {
            return v;
        }
    }
    return v.startsWith('/') ? v : '/' + v;
}

function sanitizeRedirects(list: any[]): any[] {
    return (list || []).map(r => ({
        ...r,
        from: r?.from ? toPath(r.from) : r?.from,
        to: r?.to ? toPath(r.to) : r?.to,
    }));
}

/** Sincroniza redirects ativos pro vercel.json (funciona em static mode) */
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
                source: toPath(r.from),
                destination: toPath(r.to),
                permanent: r.type === 301,
            }));

        vercelConfig.redirects = vercelRedirects;

        await writeFileToRepo(VERCEL_JSON_PATH, JSON.stringify(vercelConfig, null, 2), {
            message: 'CMS: Sync redirects to vercel.json',
        });
    } catch {}
}

export const GET: APIRoute = async () => {
    try {
        const redirects = readDataFile<any[]>(REDIRECTS_PATH.split('/').pop()!, []);
        return new Response(JSON.stringify(redirects), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};

export const PUT: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const sanitized = sanitizeRedirects(Array.isArray(body) ? body : []);
        const ok = await writeFileToRepo(REDIRECTS_PATH, JSON.stringify(sanitized, null, 2), {
            message: 'CMS: Update redirects',
        });
        if (!ok) return new Response(JSON.stringify({ error: 'Falha ao salvar' }), { status: 500 });

        // Sync to vercel.json for static mode compatibility
        await syncVercelJson(sanitized);

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 400 });
    }
};
