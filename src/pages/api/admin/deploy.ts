/**
 * deploy.ts — Dispara deploy manual via Vercel Deploy Hook.
 *
 * GET: status (pendingCommits, lastDeployedSha, lastCommitSha, building?)
 * POST: dispara o hook
 */

import type { APIRoute } from 'astro';
import { validateSession } from '../../../lib/auth';

export const prerender = false;

const COOKIE_NAME = 'admin_session';

function getCookie(req: Request, name: string): string | undefined {
    const cookieHeader = req.headers.get('cookie') || '';
    const match = cookieHeader.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : undefined;
}

async function authed(request: Request): Promise<boolean> {
    const cookie = getCookie(request, COOKIE_NAME);
    return await validateSession(cookie);
}

function ghHeaders(token: string) {
    return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' };
}

export const GET: APIRoute = async ({ request }) => {
    if (!await authed(request)) {
        return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 });
    }

    const token = (import.meta.env.GITHUB_TOKEN ?? '').trim();
    const owner = (import.meta.env.GITHUB_OWNER ?? '').trim();
    const repo = (import.meta.env.GITHUB_REPO ?? '').trim();
    const hookConfigured = Boolean((import.meta.env.DEPLOY_HOOK_URL ?? '').trim());

    if (!token || !owner || !repo) {
        return new Response(JSON.stringify({
            hookConfigured,
            pendingCommits: 0,
            building: false,
            error: 'Tokens GitHub não configurados.',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    try {
        const headRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits/main`, { headers: ghHeaders(token) });
        if (!headRes.ok) {
            return new Response(JSON.stringify({ hookConfigured, pendingCommits: 0, building: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        const head = await headRes.json() as any;
        const lastCommitSha = head.sha;
        const lastCommitMessage = (head.commit?.message ?? '').split('\n')[0].slice(0, 120);
        const lastCommitAt = head.commit?.author?.date ?? null;

        let lastDeployedSha = '';
        let lastDeployedAt = '';
        let building = false;

        const depRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/deployments?per_page=10&environment=Production`, { headers: ghHeaders(token) });
        if (depRes.ok) {
            const deployments = await depRes.json() as any[];
            for (const d of deployments) {
                const stRes = await fetch(d.statuses_url, { headers: ghHeaders(token) });
                if (!stRes.ok) continue;
                const statuses = await stRes.json() as any[];
                if (!statuses.length) continue;
                const latest = statuses[0];
                if (latest.state === 'pending' || latest.state === 'in_progress' || latest.state === 'queued') {
                    building = true;
                    if (!lastDeployedSha) lastDeployedSha = d.sha;
                    continue;
                }
                if (latest.state === 'success' && !lastDeployedSha) {
                    lastDeployedSha = d.sha;
                    lastDeployedAt = latest.created_at;
                    break;
                }
            }
        }

        let pendingCommits = 0;
        if (lastDeployedSha && lastDeployedSha !== lastCommitSha) {
            const cmpRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/compare/${lastDeployedSha}...${lastCommitSha}`, { headers: ghHeaders(token) });
            if (cmpRes.ok) {
                const cmp = await cmpRes.json() as any;
                pendingCommits = cmp.ahead_by ?? 1;
            } else {
                pendingCommits = 1;
            }
        } else if (!lastDeployedSha) {
            pendingCommits = 1;
        }

        return new Response(JSON.stringify({
            hookConfigured,
            pendingCommits,
            building,
            lastCommitSha,
            lastCommitMessage,
            lastCommitAt,
            lastDeployedSha,
            lastDeployedAt,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (err: any) {
        return new Response(JSON.stringify({ hookConfigured, pendingCommits: 0, building: false, error: err.message }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
};

export const POST: APIRoute = async ({ request }) => {
    if (!await authed(request)) {
        return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 });
    }

    const hookUrl = (import.meta.env.DEPLOY_HOOK_URL ?? '').trim();
    if (!hookUrl) {
        return new Response(JSON.stringify({ error: 'Deploy Hook não configurado. Contate o suporte.' }), { status: 500 });
    }

    try {
        const r = await fetch(hookUrl, { method: 'POST' });
        if (!r.ok) {
            const errText = await r.text();
            return new Response(JSON.stringify({ error: `Vercel retornou ${r.status}: ${errText.slice(0, 200)}` }), { status: 502 });
        }
        const data = await r.json().catch(() => ({}));
        return new Response(JSON.stringify({ ok: true, job: data?.job ?? null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};
