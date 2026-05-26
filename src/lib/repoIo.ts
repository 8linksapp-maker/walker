/**
 * Helper server-side pra ler/escrever arquivos do repo do site.
 * - Dev (sem GITHUB_TOKEN/OWNER/REPO): usa fs local relativo ao project root
 * - Prod: usa REST API do GitHub (mesmo padrão de /api/admin/github.ts)
 *
 * Uso restrito a endpoints /api/admin/* (já protegidos por middleware).
 */
import fs from 'node:fs/promises';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_ROOT = nodePath.resolve(fileURLToPath(import.meta.url), '../../../');

function ghEnv() {
  const token = import.meta.env.GITHUB_TOKEN;
  const owner = import.meta.env.GITHUB_OWNER;
  const repo = import.meta.env.GITHUB_REPO;
  if (!token || !owner || !repo) return null;
  return {
    token,
    owner,
    repo,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  };
}

export interface RepoEntry {
  name: string;
  path: string;
  type: 'file' | 'dir';
  sha?: string;
  size?: number;
}

export async function repoListDir(path: string): Promise<RepoEntry[]> {
  const env = ghEnv();
  if (!env) {
    const absPath = nodePath.join(PROJECT_ROOT, path);
    try {
      const entries = await fs.readdir(absPath, { withFileTypes: true });
      return entries.map((d) => ({
        name: d.name,
        path: `${path.replace(/\/+$/, '')}/${d.name}`,
        type: d.isDirectory() ? 'dir' : 'file',
      }));
    } catch {
      return [];
    }
  }
  const url = `https://api.github.com/repos/${env.owner}/${env.repo}/contents/${path}`;
  const res = await fetch(url, { headers: env.headers });
  if (!res.ok) return [];
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((d: any) => ({
    name: d.name,
    path: d.path,
    type: d.type === 'dir' ? 'dir' : 'file',
    sha: d.sha,
    size: d.size,
  }));
}

/** Lê um arquivo de texto (utf-8). Retorna null se não existe. */
export async function repoReadText(path: string): Promise<string | null> {
  const env = ghEnv();
  if (!env) {
    try {
      return await fs.readFile(nodePath.join(PROJECT_ROOT, path), 'utf-8');
    } catch {
      return null;
    }
  }
  const url = `https://api.github.com/repos/${env.owner}/${env.repo}/contents/${path}`;
  const res = await fetch(url, { headers: env.headers });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.content) return null;
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

/** Lê um arquivo binário e retorna como Buffer. Retorna null se não existe. */
export async function repoReadBinary(path: string): Promise<Buffer | null> {
  const env = ghEnv();
  if (!env) {
    try {
      return await fs.readFile(nodePath.join(PROJECT_ROOT, path));
    } catch {
      return null;
    }
  }
  const url = `https://api.github.com/repos/${env.owner}/${env.repo}/contents/${path}`;
  const res = await fetch(url, { headers: env.headers });
  if (!res.ok) return null;
  const data = await res.json();
  if (!data?.content) return null;
  return Buffer.from(data.content, 'base64');
}

/** Verifica se arquivo existe no repo. */
export async function repoFileExists(path: string): Promise<boolean> {
  const env = ghEnv();
  if (!env) {
    try {
      await fs.access(nodePath.join(PROJECT_ROOT, path));
      return true;
    } catch {
      return false;
    }
  }
  const url = `https://api.github.com/repos/${env.owner}/${env.repo}/contents/${path}`;
  const res = await fetch(url, { headers: env.headers, method: 'HEAD' });
  return res.ok;
}

/**
 * Escreve um arquivo. Pode ser texto (utf-8) ou binário (Buffer).
 * Em prod, cria/atualiza via API do GitHub (com commit message).
 * Se sha for omitido em prod e arquivo existir, faz lookup pra pegar o sha.
 */
export async function repoWriteFile(
  path: string,
  data: string | Buffer,
  opts?: { message?: string }
): Promise<void> {
  const message = opts?.message || `CMS: write ${path}`;
  const env = ghEnv();
  if (!env) {
    const absPath = nodePath.join(PROJECT_ROOT, path);
    await fs.mkdir(nodePath.dirname(absPath), { recursive: true });
    await fs.writeFile(absPath, data as any);
    return;
  }
  const url = `https://api.github.com/repos/${env.owner}/${env.repo}/contents/${path}`;
  // Lookup sha se já existe
  let sha: string | undefined;
  try {
    const head = await fetch(url, { headers: env.headers });
    if (head.ok) {
      const d = await head.json();
      sha = d.sha;
    }
  } catch {}
  const content = Buffer.isBuffer(data) ? data.toString('base64') : Buffer.from(data, 'utf-8').toString('base64');
  const body: any = { message, content };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...env.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Falha ao escrever ${path}: ${err.message || res.status}`);
  }
}
