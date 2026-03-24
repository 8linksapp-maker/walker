import type { APIRoute } from 'astro';
import { validateSession } from '../../../lib/auth';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TEMPLATE_REPO } from '../../../lib/templateConfig';

export const prerender = false;

const DATA_DIR = resolve(process.cwd(), 'src/data');

function readJson(file: string) {
    try { return JSON.parse(readFileSync(resolve(DATA_DIR, file), 'utf-8')); } catch { return {}; }
}

function writeJson(file: string, data: any) {
    writeFileSync(resolve(DATA_DIR, file), JSON.stringify(data, null, 4));
}

/** Busca arquivo de um repo público do GitHub via raw URL */
async function fetchTemplateFile(repo: string, ref: string, path: string): Promise<string | null> {
    const url = `https://raw.githubusercontent.com/${repo}/${ref}/${path}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.text();
}

/** Escreve arquivo no repo do usuário via GitHub API */
async function writeToUserRepo(
    token: string, owner: string, repoName: string,
    path: string, content: string
): Promise<void> {
    const apiUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${path}`;
    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
    };

    // Tenta obter SHA atual do arquivo (pode não existir)
    let sha: string | undefined;
    const existing = await fetch(apiUrl, { headers });
    if (existing.ok) {
        const data = await existing.json();
        sha = data.sha;
    }

    const body: any = {
        message: `Update via CMS: ${path}`,
        content: Buffer.from(content).toString('base64'),
    };
    if (sha) body.sha = sha;

    const res = await fetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify(body) });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(`Erro ao salvar ${path}: ${err.message}`);
    }
}

// GET — verifica se há atualização disponível
export const GET: APIRoute = async ({ request }) => {
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = Object.fromEntries(
        cookieHeader.split(';').map(c => { const [k, ...v] = c.trim().split('='); return [k, decodeURIComponent(v.join('='))]; })
    );
    if (!await validateSession(cookies['admin_session'])) {
        return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 });
    }

    const versionData = readJson('version.json');

    try {
        const res = await fetch(`https://api.github.com/repos/${TEMPLATE_REPO}/releases/latest`, {
            headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'walker-cms' },
        });

        if (!res.ok) {
            return new Response(JSON.stringify({ error: 'Não foi possível verificar atualizações.' }), { status: 502 });
        }

        const release = await res.json();
        const latestVersion = release.tag_name?.replace(/^v/, '') || '0.0.0';
        const current = versionData.version || '1.0.0';
        const hasUpdate = latestVersion !== current;

        // Atualiza lastChecked
        writeJson('version.json', { ...versionData, lastChecked: new Date().toISOString() });

        return new Response(JSON.stringify({
            configured: true,
            templateRepo: TEMPLATE_REPO,
            current,
            latest: latestVersion,
            hasUpdate,
            releaseTag: release.tag_name,
            releaseName: release.name,
            releaseNotes: release.body || '',
            releaseUrl: release.html_url,
            publishedAt: release.published_at,
        }), { status: 200 });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};

// POST — aplica atualização
export const POST: APIRoute = async ({ request }) => {
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = Object.fromEntries(
        cookieHeader.split(';').map(c => { const [k, ...v] = c.trim().split('='); return [k, decodeURIComponent(v.join('='))]; })
    );
    if (!await validateSession(cookies['admin_session'])) {
        return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 });
    }

    const GITHUB_TOKEN = import.meta.env.GITHUB_TOKEN;
    const GITHUB_OWNER = import.meta.env.GITHUB_OWNER;
    const GITHUB_REPO = import.meta.env.GITHUB_REPO;

    // Modo dev: apenas simula
    const isDevMode = !GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO;

    const { releaseTag } = await request.json();
    if (!releaseTag) return new Response(JSON.stringify({ error: 'releaseTag é obrigatório' }), { status: 400 });

    const versionData = readJson('version.json');

    try {
        // Baixa o manifesto da atualização
        const manifestContent = await fetchTemplateFile(TEMPLATE_REPO, releaseTag, 'update-manifest.json');
        if (!manifestContent) {
            return new Response(JSON.stringify({ error: `update-manifest.json não encontrado na release ${releaseTag}` }), { status: 404 });
        }

        const manifest = JSON.parse(manifestContent);
        const files: string[] = manifest.files || [];

        if (files.length === 0) {
            return new Response(JSON.stringify({ error: 'Manifesto vazio — nenhum arquivo para atualizar' }), { status: 400 });
        }

        // Filtra arquivos protegidos (dados do usuário)
        const PROTECTED = ['src/data/', 'src/content/'];
        // pluginsConfig.json é sempre protegido (configurações dos plugins)
        const safeFiles = files.filter(f => !PROTECTED.some(p => f.startsWith(p)));
        const skipped = files.filter(f => PROTECTED.some(p => f.startsWith(p)));

        const results: { file: string; status: 'ok' | 'error'; error?: string }[] = [];

        for (const filePath of safeFiles) {
            try {
                const content = await fetchTemplateFile(TEMPLATE_REPO, releaseTag, filePath);
                if (!content) {
                    results.push({ file: filePath, status: 'error', error: 'Arquivo não encontrado na release' });
                    continue;
                }

                if (isDevMode) {
                    // Dev: escreve no filesystem local
                    const absPath = resolve(process.cwd(), filePath);
                    const { mkdirSync, writeFileSync: wf } = await import('node:fs');
                    const { dirname } = await import('node:path');
                    mkdirSync(dirname(absPath), { recursive: true });
                    wf(absPath, content);
                } else {
                    await writeToUserRepo(GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO, filePath, content);
                }

                results.push({ file: filePath, status: 'ok' });
            } catch (err: any) {
                results.push({ file: filePath, status: 'error', error: err.message });
            }
        }

        // Atualiza version.json
        const newVersion = releaseTag.replace(/^v/, '');
        writeJson('version.json', {
            ...versionData,
            version: newVersion,
            lastUpdated: new Date().toISOString(),
        });

        const errors = results.filter(r => r.status === 'error');
        return new Response(JSON.stringify({
            success: errors.length === 0,
            version: newVersion,
            updated: results.filter(r => r.status === 'ok').length,
            errors: errors.length,
            skipped: skipped.length,
            results,
            devMode: isDevMode,
        }), { status: 200 });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};
