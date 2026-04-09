/**
 * system-updates.ts — API unificada de atualizações (core + plugins)
 *
 * GET  → retorna status do template e de cada plugin
 * POST → aplica atualizações (update-all, update-plugin, update-core)
 *
 * Auto-healing: ao rodar "update-all", atualiza o próprio updater primeiro.
 * Em produção, lê/escreve tudo via GitHub API (sem depender do filesystem).
 */

import type { APIRoute } from 'astro';
import { TEMPLATE_REPO, PLUGINS_REPO } from '../../../lib/templateConfig';

export const prerender = false;

// ─── Env helpers ───────────────────────────────────────────────────────────

function getEnv() {
    const token = (import.meta.env.GITHUB_TOKEN ?? '').trim();
    const owner = (import.meta.env.GITHUB_OWNER ?? '').trim();
    const repo  = (import.meta.env.GITHUB_REPO ?? '').trim();
    const isProd = !!(token && owner && repo);
    return { token, owner, repo, isProd };
}

// ─── GitHub helpers ────────────────────────────────────────────────────────

/** Lê arquivo do repo do ALUNO via GitHub API */
async function readUserFile(path: string, token: string, owner: string, repo: string) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return { content: null, sha: null };
    const data = await res.json() as { content: string; sha: string };
    return { content: Buffer.from(data.content, 'base64').toString('utf-8'), sha: data.sha };
}

/** Escreve arquivo no repo do ALUNO via GitHub API */
async function writeUserFile(
    path: string, content: string, sha: string | null,
    token: string, owner: string, repo: string, message: string,
) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const body: Record<string, any> = {
        message,
        content: Buffer.from(content).toString('base64'),
    };
    if (sha) body.sha = sha;
    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const e = await res.json() as { message: string };
        throw new Error(`Erro ao escrever ${path}: ${e.message}`);
    }
}

/** Lê arquivo do cms-plugins (público, sem auth) */
async function fetchPluginsRepo(path: string): Promise<string> {
    const url = `https://api.github.com/repos/${PLUGINS_REPO}/contents/${path}`;
    const res = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(`Erro ao buscar ${path}: ${res.status}`);
    const data = await res.json() as { content: string };
    return Buffer.from(data.content, 'base64').toString('utf-8');
}

/** Lê arquivo do template repo (público, raw) */
async function fetchTemplateFile(ref: string, path: string): Promise<string | null> {
    const url = `https://raw.githubusercontent.com/${TEMPLATE_REPO}/${ref}/${path}`;
    const res = await fetch(url);
    return res.ok ? res.text() : null;
}

// ─── Local filesystem helpers (dev mode) ───────────────────────────────────

async function readLocalFile(relPath: string): Promise<string> {
    const fs = await import('node:fs/promises');
    const nodePath = await import('node:path');
    return fs.readFile(nodePath.resolve(process.cwd(), relPath), 'utf-8');
}

async function writeLocalFile(relPath: string, content: string) {
    const fs = await import('node:fs/promises');
    const nodePath = await import('node:path');
    const abs = nodePath.resolve(process.cwd(), relPath);
    await fs.mkdir(nodePath.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf-8');
}

// ─── Data readers (prod = GitHub API, dev = filesystem) ────────────────────

async function readDataJson<T>(path: string, fallback: T, env: ReturnType<typeof getEnv>): Promise<T> {
    if (env.isProd) {
        try {
            const { content } = await readUserFile(path, env.token, env.owner, env.repo);
            if (content) return JSON.parse(content);
        } catch { /* fallback */ }
    } else {
        try { return JSON.parse(await readLocalFile(path)); } catch { /* fallback */ }
    }
    return fallback;
}

async function writeDataJson(path: string, data: any, message: string, env: ReturnType<typeof getEnv>) {
    const content = JSON.stringify(data, null, 2);
    if (env.isProd) {
        const { sha } = await readUserFile(path, env.token, env.owner, env.repo);
        await writeUserFile(path, content, sha, env.token, env.owner, env.repo, message);
    } else {
        await writeLocalFile(path, content);
    }
}

// ─── Slot aggregator helper ────────────────────────────────────────────────

const SLOT_FILES: Record<string, string> = {
    'head':        'src/plugins/_slots/HeadPlugins.astro',
    'body-end':    'src/plugins/_slots/BodyEndPlugins.astro',
    'post-bottom': 'src/plugins/_slots/PostBottomPlugins.astro',
    'post-after':  'src/plugins/_slots/PostAfterPlugins.astro',
    'post-schema': 'src/plugins/_slots/PostSchemaPlugins.astro',
};

function appendToSlotAggregator(fileContent: string, importLine: string, componentLine: string): string {
    if (fileContent.includes(importLine)) return fileContent;
    const firstClose = fileContent.indexOf('---');
    const secondClose = fileContent.indexOf('---', firstClose + 3);
    if (secondClose === -1) return fileContent;
    const before = fileContent.slice(0, secondClose);
    const after = fileContent.slice(secondClose);
    return (before + importLine + '\n' + after).trimEnd() + '\n' + componentLine + '\n';
}

// ─── Auto-detect: lista pastas em src/plugins/ para saber o que existe ─────

async function listInstalledPluginFolders(env: ReturnType<typeof getEnv>): Promise<Set<string>> {
    const folders = new Set<string>();
    if (env.isProd) {
        try {
            const url = `https://api.github.com/repos/${env.owner}/${env.repo}/contents/src/plugins`;
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${env.token}`, Accept: 'application/vnd.github+json' },
            });
            if (res.ok) {
                const items = await res.json() as { name: string; type: string }[];
                for (const item of items) {
                    if (item.type === 'dir' && !item.name.startsWith('_')) {
                        folders.add(item.name);
                    }
                }
            }
        } catch { /* fallback to empty */ }
    } else {
        try {
            const fs = await import('node:fs/promises');
            const nodePath = await import('node:path');
            const dir = nodePath.resolve(process.cwd(), 'src/plugins');
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const e of entries) {
                if (e.isDirectory() && !e.name.startsWith('_')) folders.add(e.name);
            }
        } catch { /* fallback */ }
    }
    return folders;
}

// ─── GET ────────────────────────────────────────────────────────────────────

export const GET: APIRoute = async () => {
    try {
        const env = getEnv();

        // 1. Plugin versions (local vs remote)
        const localVersions = await readDataJson<Record<string, string>>(
            'src/data/pluginVersions.json', {}, env
        );

        let remoteRegistry: Record<string, { version: string; description: string }> = {};
        try {
            remoteRegistry = JSON.parse(await fetchPluginsRepo('registry.json'));
        } catch { /* treat all as up-to-date */ }

        // 2. Auto-detect: verificar quais plugins realmente existem no repo
        const existingFolders = await listInstalledPluginFolders(env);

        // 3. Auto-heal: se um plugin existe no repo mas não está no pluginVersions, registra
        let needsHeal = false;
        for (const [name, info] of Object.entries(remoteRegistry)) {
            if (!localVersions[name] && existingFolders.has(name)) {
                localVersions[name] = info.version;
                needsHeal = true;
            }
        }

        // Auto-heal: escreve pluginVersions corrigido + pluginRegistry se necessário
        if (needsHeal) {
            try {
                await writeDataJson('src/data/pluginVersions.json', localVersions,
                    'CMS: auto-heal pluginVersions (detectou plugins existentes)', env);

                // Também reconstruir pluginRegistry.json
                const registry: any[] = [];
                for (const [name, info] of Object.entries(remoteRegistry)) {
                    if (localVersions[name]) {
                        try {
                            const pj = JSON.parse(await fetchPluginsRepo(`plugins/${name}/plugin.json`));
                            registry.push({ name, ...pj.hub });
                        } catch {
                            registry.push({ name, label: name, description: info.description,
                                icon: 'Package', color: 'text-slate-600', bg: 'bg-slate-50', href: '/admin/plugins' });
                        }
                    }
                }
                await writeDataJson('src/data/pluginRegistry.json', registry,
                    'CMS: auto-heal pluginRegistry', env);
            } catch { /* best-effort heal */ }
        }

        const plugins = Object.entries(remoteRegistry).map(([name, info]) => {
            const installed = localVersions[name] ?? null;
            return {
                name,
                installedVersion: installed,
                latestVersion: info.version,
                hasUpdate: !!installed && installed !== info.version,
                isInstalled: !!installed,
                description: info.description,
            };
        });

        // 4. Core/template version
        let core = { current: '1.0.0', latest: '1.0.0', hasUpdate: false, releaseTag: '', releaseName: '', releaseNotes: '', releaseUrl: '', publishedAt: '' };
        const versionData = await readDataJson<any>('src/data/version.json', {}, env);
        core.current = versionData.version || '1.0.0';

        if (TEMPLATE_REPO) {
            try {
                const res = await fetch(`https://api.github.com/repos/${TEMPLATE_REPO}/releases/latest`, {
                    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'walker-cms' },
                });
                if (res.ok) {
                    const release = await res.json() as any;
                    core.latest = release.tag_name?.replace(/^v/, '') || core.current;
                    core.hasUpdate = core.latest !== core.current;
                    core.releaseTag = release.tag_name || '';
                    core.releaseName = release.name || '';
                    core.releaseNotes = release.body || '';
                    core.releaseUrl = release.html_url || '';
                    core.publishedAt = release.published_at || '';
                }
            } catch { /* can't check */ }
        }

        // 5. Summary
        const pluginUpdates = plugins.filter(p => p.hasUpdate).length;
        const totalUpdates = pluginUpdates + (core.hasUpdate ? 1 : 0);

        return new Response(JSON.stringify({ core, plugins, totalUpdates, healed: needsHeal }), {
            status: 200, headers: { 'Content-Type': 'application/json' },
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};

// ─── POST ───────────────────────────────────────────────────────────────────

export const POST: APIRoute = async ({ request }) => {
    try {
        const env = getEnv();
        const body = await request.json() as {
            action: 'update-all' | 'update-plugin' | 'update-core' | 'restore-all';
            plugin?: string;
            releaseTag?: string;
        };

        const results: { item: string; status: 'ok' | 'skipped' | 'error'; detail?: string }[] = [];

        // ── Helper: instalar/atualizar um plugin ────────────────────────
        async function updatePlugin(pluginName: string, isInstall: boolean) {
            // Fetch plugin.json + paths.json from cms-plugins
            const pluginJson = JSON.parse(await fetchPluginsRepo(`plugins/${pluginName}/plugin.json`));
            let walkerPaths: Record<string, any> = {};
            try { walkerPaths = JSON.parse(await fetchPluginsRepo('templates/${TEMPLATE_REPO.split('/').pop() || 'walker'}/paths.json')); } catch {}

            const mapping = walkerPaths[pluginName] ?? {};
            const fileEntries: { src: string; dest: string }[] = mapping.files ?? [];
            const adminEntries: { src: string; dest: string }[] = mapping.adminPages ?? [];
            const slotEntries: { slot: string; import: string; component: string }[] = mapping.slots ?? [];

            // Copy files
            for (const file of [...fileEntries, ...adminEntries]) {
                const overridePath = `templates/${TEMPLATE_REPO.split('/').pop() || 'walker'}/${pluginName}/${file.src}`;
                let content: string;
                try {
                    content = await fetchPluginsRepo(overridePath);
                } catch {
                    content = await fetchPluginsRepo(`plugins/${pluginName}/${file.src}`);
                }

                if (env.isProd) {
                    const { sha } = await readUserFile(file.dest, env.token, env.owner, env.repo);
                    await writeUserFile(file.dest, content, sha, env.token, env.owner, env.repo,
                        `CMS: ${isInstall ? 'install' : 'update'} ${pluginName} — ${file.src}`);
                } else {
                    await writeLocalFile(file.dest, content);
                }
            }

            // Update pluginVersions.json
            const versions = await readDataJson<Record<string, string>>('src/data/pluginVersions.json', {}, env);
            versions[pluginName] = pluginJson.version;
            await writeDataJson('src/data/pluginVersions.json', versions, `CMS: ${pluginName} → ${pluginJson.version}`, env);

            // Install-only extras
            if (isInstall) {
                // configDefaults
                if (pluginJson.configDefaults && Object.keys(pluginJson.configDefaults).length > 0) {
                    const config = await readDataJson<Record<string, any>>('src/data/pluginsConfig.json', {}, env);
                    for (const [key, val] of Object.entries(pluginJson.configDefaults as Record<string, any>)) {
                        if (!(key in config)) config[key] = val;
                    }
                    await writeDataJson('src/data/pluginsConfig.json', config, `CMS: config defaults for ${pluginName}`, env);
                }

                // pluginRegistry
                const reg = await readDataJson<any[]>('src/data/pluginRegistry.json', [], env);
                if (!reg.find((r: any) => r.name === pluginName)) {
                    reg.push({ name: pluginName, ...pluginJson.hub });
                    await writeDataJson('src/data/pluginRegistry.json', reg, `CMS: register ${pluginName}`, env);
                }

                // slots
                for (const slot of slotEntries) {
                    const slotFile = SLOT_FILES[slot.slot];
                    if (!slotFile) continue;
                    let current: string | null = null;
                    let sha: string | null = null;
                    if (env.isProd) {
                        const r = await readUserFile(slotFile, env.token, env.owner, env.repo);
                        current = r.content; sha = r.sha;
                    } else {
                        try { current = await readLocalFile(slotFile); } catch {}
                    }
                    if (!current) continue;
                    const updated = appendToSlotAggregator(current, slot.import, slot.component);
                    if (updated !== current) {
                        if (env.isProd) {
                            await writeUserFile(slotFile, updated, sha, env.token, env.owner, env.repo, `CMS: add ${pluginName} to ${slot.slot}`);
                        } else {
                            await writeLocalFile(slotFile, updated);
                        }
                    }
                }
            }

            return pluginJson.version;
        }

        // ── Helper: atualizar o core (template) ─────────────────────────
        async function updateCore(releaseTag: string) {
            const manifestContent = await fetchTemplateFile(releaseTag, 'update-manifest.json');
            if (!manifestContent) throw new Error(`update-manifest.json não encontrado na release ${releaseTag}`);

            const manifest = JSON.parse(manifestContent);
            const files: string[] = manifest.files || [];
            const PROTECTED = ['src/data/', 'src/content/'];
            const safeFiles = files.filter((f: string) => !PROTECTED.some(p => f.startsWith(p)));

            for (const filePath of safeFiles) {
                const content = await fetchTemplateFile(releaseTag, filePath);
                if (!content) {
                    results.push({ item: `core/${filePath}`, status: 'error', detail: 'Arquivo não encontrado' });
                    continue;
                }
                if (env.isProd) {
                    const { sha } = await readUserFile(filePath, env.token, env.owner, env.repo);
                    await writeUserFile(filePath, content, sha, env.token, env.owner, env.repo, `CMS: core update ${filePath}`);
                } else {
                    await writeLocalFile(filePath, content);
                }
                results.push({ item: `core/${filePath}`, status: 'ok' });
            }

            // Update version.json
            const newVersion = releaseTag.replace(/^v/, '');
            const versionData = await readDataJson<any>('src/data/version.json', {}, env);
            await writeDataJson('src/data/version.json', {
                ...versionData,
                version: newVersion,
                lastUpdated: new Date().toISOString(),
            }, `CMS: core → v${newVersion}`, env);

            return newVersion;
        }

        // ── Action: restore-all — restaura registros sem reinstalar arquivos
        if (body.action === 'restore-all') {
            let remoteRegistry: Record<string, { version: string; description: string }> = {};
            try { remoteRegistry = JSON.parse(await fetchPluginsRepo('registry.json')); } catch {}

            // 1. Rebuild pluginVersions.json com todos os plugins
            const versions: Record<string, string> = {};
            const registry: any[] = [];

            for (const [name, info] of Object.entries(remoteRegistry)) {
                versions[name] = info.version;

                // Fetch hub info do plugin.json para o pluginRegistry
                try {
                    const pj = JSON.parse(await fetchPluginsRepo(`plugins/${name}/plugin.json`));
                    registry.push({ name, ...pj.hub });
                } catch {
                    registry.push({ name, label: name, description: info.description, icon: 'Package', color: 'text-slate-600', bg: 'bg-slate-50', href: '/admin/plugins' });
                }
            }

            // 2. Escreve os 2 arquivos de dados (1 deploy só)
            try {
                await writeDataJson('src/data/pluginVersions.json', versions, 'CMS: restore all plugin versions', env);
                await writeDataJson('src/data/pluginRegistry.json', registry, 'CMS: restore plugin registry', env);
                results.push({ item: 'pluginVersions.json', status: 'ok', detail: `${Object.keys(versions).length} plugins` });
                results.push({ item: 'pluginRegistry.json', status: 'ok', detail: `${registry.length} entradas` });
            } catch (err: any) {
                results.push({ item: 'restore', status: 'error', detail: err.message });
            }
        }

        // ── Action: update-all ──────────────────────────────────────────
        else if (body.action === 'update-all') {
            // Step 1: Self-update — atualiza o próprio updater PRIMEIRO
            try {
                await updatePlugin('updater', false);
                results.push({ item: 'updater (self-update)', status: 'ok' });
            } catch (err: any) {
                results.push({ item: 'updater (self-update)', status: 'error', detail: err.message });
            }

            // Step 2: Atualiza todos os plugins com update disponível
            const localVersions = await readDataJson<Record<string, string>>('src/data/pluginVersions.json', {}, env);
            let remoteRegistry: Record<string, { version: string }> = {};
            try { remoteRegistry = JSON.parse(await fetchPluginsRepo('registry.json')); } catch {}

            for (const [name, info] of Object.entries(remoteRegistry)) {
                if (name === 'updater') continue; // já atualizado
                const installed = localVersions[name];
                if (!installed) continue; // não instalado, pular
                if (installed === info.version) {
                    results.push({ item: name, status: 'skipped', detail: 'Já atualizado' });
                    continue;
                }
                try {
                    const v = await updatePlugin(name, false);
                    results.push({ item: name, status: 'ok', detail: `→ v${v}` });
                } catch (err: any) {
                    results.push({ item: name, status: 'error', detail: err.message });
                }
            }

            // Step 3: Atualiza o core se houver release tag
            if (body.releaseTag) {
                try {
                    const v = await updateCore(body.releaseTag);
                    results.push({ item: `core → v${v}`, status: 'ok' });
                } catch (err: any) {
                    results.push({ item: 'core', status: 'error', detail: err.message });
                }
            }
        }

        // ── Action: update-plugin ───────────────────────────────────────
        else if (body.action === 'update-plugin' && body.plugin) {
            const localVersions = await readDataJson<Record<string, string>>('src/data/pluginVersions.json', {}, env);
            const isInstall = !localVersions[body.plugin];
            try {
                const v = await updatePlugin(body.plugin, isInstall);
                results.push({ item: body.plugin, status: 'ok', detail: `→ v${v}` });
            } catch (err: any) {
                results.push({ item: body.plugin, status: 'error', detail: err.message });
            }
        }

        // ── Action: update-core ─────────────────────────────────────────
        else if (body.action === 'update-core' && body.releaseTag) {
            try {
                const v = await updateCore(body.releaseTag);
                results.push({ item: `core → v${v}`, status: 'ok' });
            } catch (err: any) {
                results.push({ item: 'core', status: 'error', detail: err.message });
            }
        }

        const ok = results.filter(r => r.status === 'ok').length;
        const errors = results.filter(r => r.status === 'error').length;

        return new Response(JSON.stringify({
            success: errors === 0,
            updated: ok,
            errors,
            skipped: results.filter(r => r.status === 'skipped').length,
            results,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};
