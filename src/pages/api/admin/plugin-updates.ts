import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';
import { PLUGINS_REPO } from '../../../lib/templateConfig';

export const prerender = false;

const PROJECT_ROOT = nodePath.resolve(fileURLToPath(import.meta.url), '../../../../../../');

// ─── helpers ────────────────────────────────────────────────────────────────

function pluginsRepoUrl(path: string, token?: string): string {
    return `https://api.github.com/repos/${PLUGINS_REPO}/contents/${path}`;
}

async function fetchFromPluginsRepo(path: string, token: string): Promise<string> {
    const res = await fetch(pluginsRepoUrl(path), {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
        },
    });
    if (!res.ok) throw new Error(`Erro ao buscar ${path} do cms-plugins: ${res.status}`);
    const data = await res.json() as { content: string };
    return Buffer.from(data.content, 'base64').toString('utf-8');
}

async function readLocalFile(relPath: string): Promise<string> {
    return fs.readFile(nodePath.join(PROJECT_ROOT, relPath), 'utf-8');
}

async function writeLocalFile(relPath: string, content: string): Promise<void> {
    const abs = nodePath.join(PROJECT_ROOT, relPath);
    await fs.mkdir(nodePath.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf-8');
}

async function readWalkerFileGithub(relPath: string, token: string, owner: string, repo: string) {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${relPath}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) {
        if (res.status === 404) return { content: null, sha: null };
        throw new Error(`Erro ao ler ${relPath}: ${res.status}`);
    }
    const data = await res.json() as { content: string; sha: string };
    return { content: Buffer.from(data.content, 'base64').toString('utf-8'), sha: data.sha };
}

async function writeWalkerFileGithub(
    relPath: string, content: string, sha: string | null,
    token: string, owner: string, repo: string, message: string,
): Promise<string> {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${relPath}`;
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
        throw new Error(`Erro ao escrever ${relPath}: ${e.message}`);
    }
    const result = await res.json() as { content: { sha: string } };
    return result.content.sha;
}

/** Appends an import + component to a slot aggregator file */
function appendToSlotAggregator(fileContent: string, importLine: string, componentLine: string): string {
    if (fileContent.includes(importLine)) return fileContent; // already present
    // Find second --- (closing frontmatter)
    const firstClose = fileContent.indexOf('---');
    const secondClose = fileContent.indexOf('---', firstClose + 3);
    if (secondClose === -1) return fileContent;

    const before = fileContent.slice(0, secondClose);
    const after = fileContent.slice(secondClose); // starts with ---

    // Insert import line just before closing ---
    const newContent = before + importLine + '\n' + after;
    // Append component at end
    return newContent.trimEnd() + '\n' + componentLine + '\n';
}

const SLOT_FILES: Record<string, string> = {
    'head':        'src/plugins/_slots/HeadPlugins.astro',
    'body-end':    'src/plugins/_slots/BodyEndPlugins.astro',
    'post-bottom': 'src/plugins/_slots/PostBottomPlugins.astro',
    'post-after':  'src/plugins/_slots/PostAfterPlugins.astro',
    'post-schema': 'src/plugins/_slots/PostSchemaPlugins.astro',
};

// ─── GET ────────────────────────────────────────────────────────────────────

export const GET: APIRoute = async () => {
    try {
        const localVersionsRaw = await readLocalFile('src/data/pluginVersions.json').catch(() => '{}');
        const localVersions: Record<string, string> = JSON.parse(localVersionsRaw);

        const GITHUB_TOKEN = import.meta.env.GITHUB_TOKEN as string | undefined;
        let remoteRegistry: Record<string, { version: string; description: string }> = {};

        if (GITHUB_TOKEN) {
            try {
                const raw = await fetchFromPluginsRepo('registry.json', GITHUB_TOKEN);
                remoteRegistry = JSON.parse(raw);
            } catch {
                // graceful: treat all as up-to-date
            }
        }

        const plugins = Object.entries(remoteRegistry).length > 0
            ? Object.entries(remoteRegistry).map(([name, info]) => {
                const installed = localVersions[name] ?? null;
                return {
                    name,
                    label: name,
                    installedVersion: installed,
                    latestVersion: info.version,
                    hasUpdate: !!installed && installed !== info.version,
                    isInstalled: !!installed,
                    description: info.description,
                };
            })
            : Object.keys(localVersions).map(name => ({
                name,
                label: name,
                installedVersion: localVersions[name],
                latestVersion: localVersions[name],
                hasUpdate: false,
                isInstalled: true,
                description: '',
            }));

        return new Response(JSON.stringify({ plugins }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};

// ─── POST ────────────────────────────────────────────────────────────────────

export const POST: APIRoute = async ({ request }) => {
    try {
        const { plugin, action } = await request.json() as { plugin: string; action: 'update' | 'install' };
        if (!plugin || !action) {
            return new Response(JSON.stringify({ error: 'Parâmetros inválidos' }), { status: 400 });
        }

        const GITHUB_TOKEN = import.meta.env.GITHUB_TOKEN as string | undefined;
        const GITHUB_OWNER = import.meta.env.GITHUB_OWNER as string | undefined;
        const GITHUB_REPO  = import.meta.env.GITHUB_REPO  as string | undefined;

        const isProd = !!(GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO);

        // 1. Fetch plugin.json + templates/walker/paths.json from cms-plugins
        let pluginJson: any;
        let walkerPaths: Record<string, any> = {};

        if (isProd) {
            const raw = await fetchFromPluginsRepo(`plugins/${plugin}/plugin.json`, GITHUB_TOKEN!);
            pluginJson = JSON.parse(raw);
            try {
                const pathsRaw = await fetchFromPluginsRepo('templates/walker/paths.json', GITHUB_TOKEN!);
                walkerPaths = JSON.parse(pathsRaw);
            } catch { /* no paths.json — skip slots/dest */ }
        } else {
            try {
                const cmsRoot = nodePath.resolve(PROJECT_ROOT, '../../cms-plugins');
                const raw = await fs.readFile(nodePath.join(cmsRoot, 'plugins', plugin, 'plugin.json'), 'utf-8');
                pluginJson = JSON.parse(raw);
                try {
                    const pathsRaw = await fs.readFile(nodePath.join(cmsRoot, 'templates', 'walker', 'paths.json'), 'utf-8');
                    walkerPaths = JSON.parse(pathsRaw);
                } catch { /* no paths.json */ }
            } catch {
                return new Response(JSON.stringify({ error: `plugin.json não encontrado para "${plugin}" no cms-plugins local` }), { status: 404 });
            }
        }

        // Resolve walker-specific paths for this plugin
        const pluginPaths = walkerPaths[plugin] ?? {};
        const fileEntries: Array<{ src: string; dest: string }> = pluginPaths.files ?? [];
        const adminEntries: Array<{ src: string; dest: string }> = pluginPaths.adminPages ?? [];
        const slotEntries: Array<{ slot: string; import: string; component: string }> = pluginPaths.slots ?? [];

        // 2. Copy plugin files
        for (const file of fileEntries) {
            // Check template override first
            const overridePath = `templates/walker/${plugin}/${file.src}`;
            let content: string | null = null;

            if (isProd) {
                try {
                    content = await fetchFromPluginsRepo(overridePath, GITHUB_TOKEN!);
                } catch {
                    content = await fetchFromPluginsRepo(`plugins/${plugin}/${file.src}`, GITHUB_TOKEN!);
                }
                const { sha } = await readWalkerFileGithub(file.dest, GITHUB_TOKEN!, GITHUB_OWNER!, GITHUB_REPO!);
                await writeWalkerFileGithub(
                    file.dest, content, sha, GITHUB_TOKEN!, GITHUB_OWNER!, GITHUB_REPO!,
                    `CMS: ${action} plugin ${plugin} — ${file.src}`,
                );
            } else {
                const cmsRoot = nodePath.resolve(PROJECT_ROOT, '../../cms-plugins');
                const overrideAbs = nodePath.join(cmsRoot, overridePath);
                const srcAbs = nodePath.join(cmsRoot, 'plugins', plugin, file.src);
                try {
                    content = await fs.readFile(overrideAbs, 'utf-8');
                } catch {
                    content = await fs.readFile(srcAbs, 'utf-8');
                }
                await writeLocalFile(file.dest, content);
            }
        }

        // 3. Copy admin pages
        for (const page of adminEntries) {
            let content: string | null = null;
            if (isProd) {
                content = await fetchFromPluginsRepo(`plugins/${plugin}/${page.src}`, GITHUB_TOKEN!);
                const { sha } = await readWalkerFileGithub(page.dest, GITHUB_TOKEN!, GITHUB_OWNER!, GITHUB_REPO!);
                await writeWalkerFileGithub(
                    page.dest, content, sha, GITHUB_TOKEN!, GITHUB_OWNER!, GITHUB_REPO!,
                    `CMS: ${action} plugin ${plugin} — ${page.src}`,
                );
            } else {
                const cmsRoot = nodePath.resolve(PROJECT_ROOT, '../../cms-plugins');
                content = await fs.readFile(nodePath.join(cmsRoot, 'plugins', plugin, page.src), 'utf-8');
                await writeLocalFile(page.dest, content);
            }
        }

        // 4. Update pluginVersions.json
        const versionsPath = 'src/data/pluginVersions.json';
        const versionsRaw = await readLocalFile(versionsPath).catch(() => '{}');
        const versions: Record<string, string> = JSON.parse(versionsRaw);
        versions[plugin] = pluginJson.version;

        if (isProd) {
            const { sha } = await readWalkerFileGithub(versionsPath, GITHUB_TOKEN!, GITHUB_OWNER!, GITHUB_REPO!);
            await writeWalkerFileGithub(
                versionsPath, JSON.stringify(versions, null, 2), sha,
                GITHUB_TOKEN!, GITHUB_OWNER!, GITHUB_REPO!,
                `CMS: update pluginVersions — ${plugin} → ${pluginJson.version}`,
            );
        } else {
            await writeLocalFile(versionsPath, JSON.stringify(versions, null, 2));
        }

        // 5. Install-only: merge configDefaults + registry + slots
        if (action === 'install') {
            // 5a. Merge configDefaults into pluginsConfig.json
            if (pluginJson.configDefaults && Object.keys(pluginJson.configDefaults).length > 0) {
                const configPath = 'src/data/pluginsConfig.json';
                const configRaw = await readLocalFile(configPath).catch(() => '{}');
                const config: Record<string, any> = JSON.parse(configRaw);
                for (const [key, val] of Object.entries(pluginJson.configDefaults as Record<string, any>)) {
                    if (!(key in config)) config[key] = val;
                }
                if (isProd) {
                    const { sha } = await readWalkerFileGithub(configPath, GITHUB_TOKEN!, GITHUB_OWNER!, GITHUB_REPO!);
                    await writeWalkerFileGithub(
                        configPath, JSON.stringify(config, null, 4), sha,
                        GITHUB_TOKEN!, GITHUB_OWNER!, GITHUB_REPO!,
                        `CMS: merge configDefaults for plugin ${plugin}`,
                    );
                } else {
                    await writeLocalFile(configPath, JSON.stringify(config, null, 4));
                }
            }

            // 5b. Add entry to pluginRegistry.json
            const registryPath = 'src/data/pluginRegistry.json';
            const regRaw = await readLocalFile(registryPath).catch(() => '[]');
            const reg: any[] = JSON.parse(regRaw);
            if (!reg.find((r: any) => r.name === plugin)) {
                reg.push({ name: plugin, ...pluginJson.hub });
                if (isProd) {
                    const { sha } = await readWalkerFileGithub(registryPath, GITHUB_TOKEN!, GITHUB_OWNER!, GITHUB_REPO!);
                    await writeWalkerFileGithub(
                        registryPath, JSON.stringify(reg, null, 2), sha,
                        GITHUB_TOKEN!, GITHUB_OWNER!, GITHUB_REPO!,
                        `CMS: register plugin ${plugin}`,
                    );
                } else {
                    await writeLocalFile(registryPath, JSON.stringify(reg, null, 2));
                }
            }

            // 5c. Append to slot aggregators
            for (const slot of slotEntries) {
                const slotFile = SLOT_FILES[slot.slot];
                if (!slotFile) continue;
                if (isProd) {
                    const { content: current, sha } = await readWalkerFileGithub(slotFile, GITHUB_TOKEN!, GITHUB_OWNER!, GITHUB_REPO!);
                    if (!current) continue;
                    const updated = appendToSlotAggregator(current, slot.import, slot.component);
                    if (updated !== current) {
                        await writeWalkerFileGithub(
                            slotFile, updated, sha, GITHUB_TOKEN!, GITHUB_OWNER!, GITHUB_REPO!,
                            `CMS: add ${plugin} to ${slot.slot} slot`,
                        );
                    }
                } else {
                    const current = await readLocalFile(slotFile).catch(() => null);
                    if (!current) continue;
                    const updated = appendToSlotAggregator(current, slot.import, slot.component);
                    if (updated !== current) {
                        await writeLocalFile(slotFile, updated);
                    }
                }
            }
        }

        return new Response(JSON.stringify({ success: true, version: pluginJson.version }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};
