/**
 * api/admin/plugins/import/wordpress.ts — Walker
 *
 * POST — Recebe arquivo XML do WordPress e importa posts, categorias e autores.
 */

import type { APIRoute } from 'astro';
import { validateSession } from '../../../../../lib/auth';
import { importWordPressXML } from '../../../../../plugins/wp-importer/wordpress-importer';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        // Auth
        const cookieHeader = request.headers.get('cookie') || '';
        const cookies = Object.fromEntries(
            cookieHeader.split(';').map(c => { const [k, ...v] = c.trim().split('='); return [k, decodeURIComponent(v.join('='))]; })
        );
        if (!await validateSession(cookies['admin_session'])) {
            return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 });
        }

        // Recebe o arquivo XML
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return new Response(JSON.stringify({ error: 'Arquivo não enviado.' }), {
                status: 400, headers: { 'Content-Type': 'application/json' },
            });
        }

        const filename = file.name || '';
        if (!filename.endsWith('.xml') && !file.type.includes('xml')) {
            return new Response(JSON.stringify({ error: 'O arquivo deve ser um XML exportado do WordPress.' }), {
                status: 400, headers: { 'Content-Type': 'application/json' },
            });
        }

        const xmlContent = await file.text();

        if (!xmlContent?.trim()) {
            return new Response(JSON.stringify({ error: 'Arquivo XML vazio.' }), {
                status: 400, headers: { 'Content-Type': 'application/json' },
            });
        }

        console.log(`[WP Import] Iniciando importação de ${filename} (${xmlContent.length} chars)`);

        const result = await importWordPressXML(xmlContent);

        console.log(`[WP Import] Concluído: ${result.posts.imported} posts, ${result.authors.imported} autores, ${result.categories.imported} categorias`);

        return new Response(JSON.stringify(result), {
            status: result.success ? 200 : 422,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        console.error('[WP Import] Erro fatal:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Erro interno ao processar importação',
            posts: { imported: 0, skipped: 0, errors: [], imagesImported: 0 },
            authors: { imported: 0, skipped: 0 },
            categories: { imported: 0, skipped: 0 },
            errors: [error.message || 'Erro desconhecido'],
        }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
        });
    }
};
