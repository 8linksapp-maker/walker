/**
 * api/admin/amazon-product.ts
 *
 * POST { asin, accessKey, secretKey, partnerTag }
 * Retorna { title, image, price, originalPrice, rating, amazonUrl, features }
 *
 * Usa Amazon Product Advertising API 5.0 (PAAPI 5.0) — oficial, sem captcha.
 * Aluno precisa de credenciais aprovadas pelo Amazon Associates:
 *   - Access Key + Secret Key (geradas em https://affiliate-program.amazon.com.br > Ferramentas > API)
 *   - Partner Tag (ex: nome-20)
 *
 * Marketplace fixo: www.amazon.com.br (host us-east-1).
 *
 * Se credenciais não vierem, retorna erro claro instruindo a preencher os campos manualmente.
 */
import type { APIRoute } from 'astro';
import { createHash, createHmac } from 'node:crypto';

export const prerender = false;

const HOST = 'webservices.amazon.com.br';
const REGION = 'us-east-1';
const SERVICE = 'ProductAdvertisingAPI';
const URI = '/paapi5/getitems';
const TARGET = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.GetItems';
const MARKETPLACE = 'www.amazon.com.br';

function json(data: any, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function extractAsin(input: string): string | null {
    const s = (input || '').trim();
    if (!s) return null;
    const pure = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (/^[A-Z0-9]{10}$/.test(pure) && !s.includes('/')) return pure;
    const m = s.match(/\/(?:dp|gp\/product|product)\/([A-Z0-9]{10})/i);
    return m ? m[1].toUpperCase() : null;
}

// AWS Signature V4 — assinatura manual sem deps externas.
function sha256(s: string | Buffer): string {
    return createHash('sha256').update(s).digest('hex');
}
function hmac(key: string | Buffer, data: string): Buffer {
    return createHmac('sha256', key).update(data).digest();
}

function signRequest(accessKey: string, secretKey: string, payload: string, ts: string, date: string) {
    const canonicalHeaders =
        `content-encoding:amz-1.0\n` +
        `host:${HOST}\n` +
        `x-amz-date:${ts}\n` +
        `x-amz-target:${TARGET}\n`;
    const signedHeaders = 'content-encoding;host;x-amz-date;x-amz-target';
    const payloadHash = sha256(payload);

    const canonicalRequest = [
        'POST',
        URI,
        '',
        canonicalHeaders,
        signedHeaders,
        payloadHash,
    ].join('\n');

    const scope = `${date}/${REGION}/${SERVICE}/aws4_request`;
    const stringToSign = [
        'AWS4-HMAC-SHA256',
        ts,
        scope,
        sha256(canonicalRequest),
    ].join('\n');

    const kDate = hmac(`AWS4${secretKey}`, date);
    const kRegion = hmac(kDate, REGION);
    const kService = hmac(kRegion, SERVICE);
    const kSigning = hmac(kService, 'aws4_request');
    const signature = createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    return `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json().catch(() => ({}));
        const asin = extractAsin(body.asin || '');
        if (!asin) {
            return json({ error: 'ASIN inválido. Informe o código de 10 caracteres (ex: B0CHX1W1XY) ou a URL completa do produto.' }, 400);
        }

        const accessKey = (body.accessKey || '').trim();
        const secretKey = (body.secretKey || '').trim();
        const partnerTag = (body.partnerTag || '').trim();

        if (!accessKey || !secretKey || !partnerTag) {
            return json({
                error: 'Credenciais da Amazon não configuradas. Vá em Afiliados > Configurações e preencha: Access Key, Secret Key e Partner Tag (Amazon Tag). As credenciais são geradas em https://affiliate-program.amazon.com.br > Ferramentas > API.',
            }, 400);
        }

        const payload = JSON.stringify({
            ItemIds: [asin],
            Resources: [
                'Images.Primary.Large',
                'ItemInfo.Title',
                'ItemInfo.Features',
                'Offers.Listings.Price',
                'Offers.Listings.SavingBasis',
                'CustomerReviews.StarRating',
            ],
            PartnerTag: partnerTag,
            PartnerType: 'Associates',
            Marketplace: MARKETPLACE,
        });

        const now = new Date();
        const ts = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
        const date = ts.slice(0, 8);

        const authorization = signRequest(accessKey, secretKey, payload, ts, date);

        const res = await fetch(`https://${HOST}${URI}`, {
            method: 'POST',
            headers: {
                'Authorization': authorization,
                'Content-Encoding': 'amz-1.0',
                'Content-Type': 'application/json; charset=utf-8',
                'Host': HOST,
                'X-Amz-Date': ts,
                'X-Amz-Target': TARGET,
            },
            body: payload,
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || data?.Errors?.length) {
            const err = data?.Errors?.[0];
            const code = err?.Code || res.status;
            const msg = err?.Message || `Amazon retornou erro ${res.status}.`;
            // Erros comuns traduzidos
            let friendly = msg;
            if (/InvalidSignature|SignatureDoesNotMatch/i.test(code)) {
                friendly = 'Secret Key inválida. Confira em afiliados > Configurações > Secret Key.';
            } else if (/InvalidAccessKeyId|UnrecognizedClient/i.test(code) || /Access Key ID.*invalid|security token.*invalid/i.test(msg)) {
                friendly = 'Access Key inválida ou no formato errado. A PAAPI 5.0 exige credenciais que começam com "AKIA..." (geradas em afiliados.amazon.com.br > Ferramentas > Product Advertising API). Se sua chave começa com "amzn1.application-oa2-client...", é credencial de Login with Amazon — não funciona pra importar produtos.';
            } else if (/InvalidPartnerTag|InvalidAssociate/i.test(code)) {
                friendly = 'Partner Tag inválida. Confira em afiliados > Configurações > Amazon Tag (ex: meusite-20).';
            } else if (/TooManyRequests|RequestThrottled/i.test(code)) {
                friendly = 'Muitas requisições à Amazon. Aguarde 1 minuto e tente de novo. (PAAPI permite 1 req/seg até as 3 primeiras vendas qualificadas; depois aumenta).';
            } else if (/ItemNotAccessible|NoResults/i.test(code)) {
                friendly = `ASIN ${asin} não encontrado no marketplace amazon.com.br. Verifique se o produto existe e está disponível.`;
            }
            return json({ error: friendly, code, raw: msg }, res.status === 200 ? 400 : res.status);
        }

        const item = data?.ItemsResult?.Items?.[0];
        if (!item) {
            return json({ error: `Produto ${asin} não encontrado na Amazon Brasil.` }, 404);
        }

        const title = item.ItemInfo?.Title?.DisplayValue || '';
        const image = item.Images?.Primary?.Large?.URL || '';
        const features: string[] = (item.ItemInfo?.Features?.DisplayValues || []).slice(0, 8);

        const listing = item.Offers?.Listings?.[0];
        const price = listing?.Price?.DisplayAmount || '';
        const originalPrice = listing?.SavingBasis?.DisplayAmount || '';
        const rating = item.CustomerReviews?.StarRating?.Value
            ? Number(item.CustomerReviews.StarRating.Value)
            : undefined;
        const amazonUrl = item.DetailPageURL || `https://www.amazon.com.br/dp/${asin}/?tag=${encodeURIComponent(partnerTag)}`;

        return json({ title, image, price, originalPrice, rating, amazonUrl, features });
    } catch (err: any) {
        return json({ error: err?.message || 'Erro ao consultar a Amazon.' }, 500);
    }
};
