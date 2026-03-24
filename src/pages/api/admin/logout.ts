import type { APIRoute } from 'astro';

export const prerender = false;

const COOKIE_NAME = 'admin_session';

export const POST: APIRoute = async () => {
    return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
        }
    });
};
