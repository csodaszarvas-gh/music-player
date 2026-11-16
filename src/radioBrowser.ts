// Radio Browser API client (https://www.radio-browser.info/).
// No vscode import so it can be smoke-tested directly in the container.

export interface Station {
  stationuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  homepage: string;
  favicon: string;
  tags: string;
  country: string;
  countrycode: string;
  language: string;
  votes: number;
  clickcount: number;
  codec: string;
  bitrate: number;
  hls: number;
}

export interface TagInfo {
  name: string;
  stationcount: number;
}

export interface SearchOptions {
  name?: string;
  tag?: string;
  country?: string;
  countrycode?: string;
  language?: string;
  codec?: string;
  limit?: number;
  offset?: number;
}

const MIRRORS = [
  'https://de1.api.radio-browser.info',
  'https://nl1.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
  'https://fi1.api.radio-browser.info'
];

let preferred: string | undefined;

async function getJson(url: string, timeoutMs = 10000): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'MusicPlayerExtension/0.2' }
    });
    if (!res.ok) {
      throw new Error('HTTP ' + res.status + ' for ' + url);
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function candidates(): string[] {
  return preferred ? [preferred, ...MIRRORS.filter(m => m !== preferred)] : [...MIRRORS];
}

async function api(path: string): Promise<unknown> {
  let lastErr: unknown;
  for (const base of candidates()) {
    try {
      const data = await getJson(base + path);
      preferred = base;
      return data;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Radio Browser API unreachable');
}

export async function searchStations(opts: SearchOptions): Promise<Station[]> {
  const params = new URLSearchParams();
  if (opts.name) { params.set('name', opts.name); }
  if (opts.tag) { params.set('tag', opts.tag); }
  if (opts.country) { params.set('country', opts.country); }
  if (opts.countrycode) { params.set('countrycode', opts.countrycode); }
  if (opts.language) { params.set('language', opts.language); }
  if (opts.codec) { params.set('codec', opts.codec); }
  params.set('limit', String(opts.limit ?? 100));
  if (opts.offset) { params.set('offset', String(opts.offset)); }
  params.set('order', 'clickcount');
  params.set('reverse', 'true');
  params.set('hidebroken', 'true');
  const rows = await api('/json/stations/search?' + params.toString());
  return Array.isArray(rows) ? (rows as Station[]) : [];
}

export async function topTags(limit = 100): Promise<TagInfo[]> {
  const rows = await api('/json/tags?order=stationcount&reverse=true&limit=' + limit);
  return Array.isArray(rows) ? (rows as TagInfo[]) : [];
}

// Countries, languages and codecs all return the same {name, stationcount} shape.
async function topBy(kind: 'countries' | 'languages' | 'codecs', limit: number): Promise<TagInfo[]> {
  const rows = await api('/json/' + kind + '?order=stationcount&reverse=true&limit=' + limit);
  return Array.isArray(rows) ? (rows as TagInfo[]) : [];
}

export function topCountries(limit = 250): Promise<TagInfo[]> {
  return topBy('countries', limit);
}

export function topLanguages(limit = 150): Promise<TagInfo[]> {
  return topBy('languages', limit);
}

export function topCodecs(limit = 50): Promise<TagInfo[]> {
  return topBy('codecs', limit);
}

// Best-effort community click counter; never blocks or fails playback.
export function trackClick(stationuuid: string): void {
  api('/json/url/' + encodeURIComponent(stationuuid)).catch(() => undefined);
}

export function streamUrl(s: Station): string {
  return s.url_resolved || s.url;
}

export function isHls(s: Station): boolean {
  return s.hls === 1 || /\.m3u8(\?|$)/i.test(streamUrl(s));
}