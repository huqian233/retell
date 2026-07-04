import type { Env } from '../env';
import { AppError } from '../errors';
import { proxiesFromEnv, type ProxyConfig } from '../../proxy/client';
import { fetchPlayer, fetchTimedTextJson, chooseTrack } from './innertube';
import { parseTimedText } from './timedtext';
import { BUNDLED } from './bundled';

export interface TranscriptResult {
  videoId: string;
  title: string;
  author: string;
  transcript: string;
  source: 'bundled' | 'live';
}

const ID = /^[A-Za-z0-9_-]{11}$/;

export function resolveVideoId(input: string): string | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m)\./, '');
  const valid = (id: string) => (ID.test(id) ? id : null);
  if (host === 'youtu.be') return valid(u.pathname.slice(1));
  if (host !== 'youtube.com') return null;
  if (u.pathname === '/watch') return valid(u.searchParams.get('v') ?? '');
  const m = /^\/(shorts|embed|live|v)\/([^/?#]+)/.exec(u.pathname);
  return m ? valid(m[2]!) : null;
}

// 依次换代理重试同一请求(最多 3 次)。业务错误(NO_CAPTIONS/VIDEO_NOT_FOUND)立即抛,
// 只对 YOUTUBE_BLOCKED 换端点再试;用尽仍拦则如实抛 YOUTUBE_BLOCKED。
async function withProxyRetry<T>(proxies: ProxyConfig[], fn: (p: ProxyConfig) => Promise<T>): Promise<T> {
  let last: unknown;
  const attempts = Math.min(proxies.length, 3);
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn(proxies[i]!);
    } catch (e) {
      if (e instanceof AppError && e.code !== 'YOUTUBE_BLOCKED') throw e;
      last = e;
    }
  }
  throw last instanceof AppError ? last : new AppError('YOUTUBE_BLOCKED');
}

export async function getTranscript(url: string, env: Env): Promise<TranscriptResult> {
  const videoId = resolveVideoId(url);
  if (!videoId) throw new AppError('INVALID_REQUEST');

  const bundled = BUNDLED[videoId];
  if (bundled && bundled.transcript.trim()) return { ...bundled, source: 'bundled' };

  const proxies = proxiesFromEnv(env);
  if (!proxies.length) throw new AppError('YOUTUBE_BLOCKED');

  const player = await withProxyRetry(proxies, (p) => fetchPlayer(videoId, p));
  const track = chooseTrack(player.tracks);
  const json = await withProxyRetry(proxies, (p) => fetchTimedTextJson(track.baseUrl, p));
  const transcript = parseTimedText(json);
  if (!transcript.trim()) throw new AppError('NO_CAPTIONS');

  return { videoId, title: player.title, author: player.author, transcript, source: 'live' };
}
