import type { Env } from '../env';
import { AppError } from '../errors';
import { fetchViaSupadata } from './supadata';
import { fetchOembed } from './oembed';
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

export async function getTranscript(url: string, env: Env): Promise<TranscriptResult> {
  const videoId = resolveVideoId(url);
  if (!videoId) throw new AppError('INVALID_REQUEST');

  // 演示视频:预热缓存,零外部依赖,永远稳定。
  const bundled = BUNDLED[videoId];
  if (bundled && bundled.transcript.trim()) return { ...bundled, source: 'bundled' };

  // 其他视频:字幕经 Supadata 实时抓取(它在后台处理住宅代理与 PO Token);
  // 标题/作者用无需鉴权的 oEmbed 补齐。两者并发;字幕失败即如实抛错,绝不伪造。
  const [transcript, meta] = await Promise.all([
    fetchViaSupadata(`https://www.youtube.com/watch?v=${videoId}`, env),
    fetchOembed(videoId),
  ]);
  return { videoId, title: meta.title, author: meta.author, transcript, source: 'live' };
}
