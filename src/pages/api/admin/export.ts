import type { APIRoute } from 'astro';
import JSZip from 'jszip';
import { repoListDir, repoReadText, repoReadBinary } from '../../../lib/repoIo';

export const prerender = false;

/** Extrai paths de imagens locais referenciadas no markdown (frontmatter + body) */
function extractImagePaths(markdown: string): string[] {
  const found = new Set<string>();
  // 1) Frontmatter — qualquer valor após : que case com /uploads/... ou .{jpg|png|webp|gif|svg|jpeg|avif}
  // 2) Body — ![](caminho) e <img src="caminho">
  const patterns: RegExp[] = [
    // Aspas + path (frontmatter): cover: "/uploads/foo.jpg" ou image: '/uploads/x.png'
    /["'](\/uploads\/[^"'\s)]+\.(?:jpg|jpeg|png|webp|gif|svg|avif))["']/gi,
    // Sem aspas (frontmatter): cover: /uploads/foo.jpg
    /:\s*(\/uploads\/[^\s)"']+\.(?:jpg|jpeg|png|webp|gif|svg|avif))/gi,
    // Markdown image: ![alt](path)
    /!\[[^\]]*\]\((\/uploads\/[^)\s]+\.(?:jpg|jpeg|png|webp|gif|svg|avif))(?:\s+"[^"]*")?\)/gi,
    // HTML img tag
    /<img[^>]+src=["'](\/uploads\/[^"']+\.(?:jpg|jpeg|png|webp|gif|svg|avif))["']/gi,
  ];
  for (const re of patterns) {
    for (const match of markdown.matchAll(re)) {
      if (match[1]) found.add(match[1]);
    }
  }
  return [...found];
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const siteName = url.searchParams.get('site') || 'site';
    const POSTS_DIR = 'src/content/blog';

    // 1. Lista todos os posts .md
    const entries = await repoListDir(POSTS_DIR);
    const postFiles = entries.filter((e) => e.type === 'file' && e.name.endsWith('.md'));

    if (postFiles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Nenhum post encontrado em ' + POSTS_DIR }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const zip = new JSZip();
    const postsFolder = zip.folder('posts')!;
    const uploadsFolder = zip.folder('uploads')!;

    // 2. Lê posts em paralelo e coleta imagens
    const allImagePaths = new Set<string>();
    let postsAdded = 0;

    await Promise.all(
      postFiles.map(async (entry) => {
        const content = await repoReadText(entry.path);
        if (!content) return;
        postsFolder.file(entry.name, content);
        postsAdded++;
        extractImagePaths(content).forEach((p) => allImagePaths.add(p));
      })
    );

    // 3. Baixa cada imagem em paralelo (limitado a chunks pra não rate-limit)
    const imagePathsArr = [...allImagePaths];
    const imagesIncluded: string[] = [];
    const imagesMissing: string[] = [];
    const CHUNK = 8;
    for (let i = 0; i < imagePathsArr.length; i += CHUNK) {
      const chunk = imagePathsArr.slice(i, i + CHUNK);
      await Promise.all(
        chunk.map(async (imgPath) => {
          // imgPath começa com /uploads/...
          // No repo, fica em public/uploads/...
          const repoPath = `public${imgPath}`;
          const bin = await repoReadBinary(repoPath);
          if (!bin) {
            imagesMissing.push(imgPath);
            return;
          }
          const filename = imgPath.replace(/^\/uploads\//, '');
          uploadsFolder.file(filename, bin);
          imagesIncluded.push(imgPath);
        })
      );
    }

    // 4. Manifest
    const manifest = {
      msia_export_version: '1.0',
      exported_at: new Date().toISOString(),
      source_site: siteName,
      counts: {
        posts: postsAdded,
        images_included: imagesIncluded.length,
        images_missing: imagesMissing.length,
      },
      images_missing: imagesMissing,
    };
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));

    // 5. Gera o zip
    const buffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const fname = `msia-${siteName}-posts-${new Date().toISOString().slice(0, 10)}.zip`;
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${fname}"`,
        'Content-Length': String(buffer.length),
        'X-Posts-Count': String(postsAdded),
        'X-Images-Count': String(imagesIncluded.length),
      },
    });
  } catch (err: any) {
    console.error('[export] erro:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Erro ao exportar' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
