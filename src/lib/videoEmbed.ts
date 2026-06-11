/**
 * Helper canônico pra detectar provider de vídeo e gerar URL de embed.
 *
 * Providers suportados:
 *  - YouTube (watch, youtu.be, shorts, embed)
 *  - Vimeo
 *  - Iframe genérico (Loom, Wistia, etc — passa pela URL direto se for de embed)
 *
 * Use SEMPRE este helper. NUNCA monte URL de embed inline.
 */

export type VideoProvider = 'youtube' | 'vimeo' | 'iframe' | 'mp4' | 'unknown';

export interface VideoInfo {
  provider: VideoProvider;
  /** ID do vídeo (vazio se provider for iframe/mp4) */
  id: string;
  /** URL de embed pronta pra iframe src */
  embedUrl: string;
  /** URL da thumbnail (provider-specific, ou vazio) */
  thumbnail: string;
  /** URL original (pra fallback / acessibilidade) */
  originalUrl: string;
}

/** Extrai videoId do YouTube de qualquer formato de URL conhecido */
function parseYouTube(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([\w-]{11})/i,
    /(?:youtu\.be\/)([\w-]{11})/i,
    /(?:youtube\.com\/embed\/)([\w-]{11})/i,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/i,
    /(?:youtube\.com\/v\/)([\w-]{11})/i,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}

/** Extrai videoId do Vimeo */
function parseVimeo(url: string): string | null {
  const patterns = [
    /(?:vimeo\.com\/)(?:video\/)?(\d+)/i,
    /(?:player\.vimeo\.com\/video\/)(\d+)/i,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}

export function parseVideoUrl(input: string): VideoInfo {
  const url = (input || '').trim();
  if (!url) {
    return { provider: 'unknown', id: '', embedUrl: '', thumbnail: '', originalUrl: '' };
  }

  // YouTube
  const ytId = parseYouTube(url);
  if (ytId) {
    return {
      provider: 'youtube',
      id: ytId,
      embedUrl: `https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1`,
      thumbnail: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
      originalUrl: url,
    };
  }

  // Vimeo
  const vimeoId = parseVimeo(url);
  if (vimeoId) {
    return {
      provider: 'vimeo',
      id: vimeoId,
      embedUrl: `https://player.vimeo.com/video/${vimeoId}?title=0&byline=0`,
      thumbnail: '', // Vimeo exige API call pra thumb; deixar vazio (poster genérico)
      originalUrl: url,
    };
  }

  // mp4 direto
  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(url)) {
    return { provider: 'mp4', id: '', embedUrl: url, thumbnail: '', originalUrl: url };
  }

  // Iframe genérico — só permitimos URLs https com host conhecido de embed
  if (/^https:\/\/(?:player\.|embed\.|www\.)?(?:loom|wistia|brightcove|jwplayer|spotify|twitch)\.\w/i.test(url)) {
    return { provider: 'iframe', id: '', embedUrl: url, thumbnail: '', originalUrl: url };
  }

  // Não reconhecido — retorna unknown (UI deve mostrar warning)
  return { provider: 'unknown', id: '', embedUrl: '', thumbnail: '', originalUrl: url };
}

/** Util: detecta se a URL é embedável sem erro (pra validação no admin) */
export function isValidVideoUrl(url: string): boolean {
  return parseVideoUrl(url).provider !== 'unknown';
}
