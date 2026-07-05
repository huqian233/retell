import type { Env } from '../env';
import { AppError } from '../errors';

interface SupadataSegment {
  text?: string;
  offset?: number;
  duration?: number;
  lang?: string;
}
interface SupadataResponse {
  lang?: string;
  content?: SupadataSegment[] | string;
}

// 把 Supadata 的分段响应拼成纯文本(与 timedtext 同一套空白归一化)。
export function parseSupadata(json: unknown): string {
  const c = (json as SupadataResponse).content;
  if (typeof c === 'string') return c.replace(/\s+/g, ' ').trim();
  if (!Array.isArray(c)) return '';
  return c
    .map((s) => s.text ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 经 Supadata 实时抓取字幕:一个普通 GET,鉴权头 x-api-key,有字幕的视频同步返回。
// 它在后台处理住宅代理与 PO Token —— 这正是 Worker 内裸 socket 做不到、而任务需要的部分。
export async function fetchViaSupadata(videoUrl: string, env: Env): Promise<string> {
  const endpoint = `https://api.supadata.ai/v1/transcript?url=${encodeURIComponent(videoUrl)}`;
  let res: Response;
  try {
    res = await fetch(endpoint, { headers: { 'x-api-key': env.SUPADATA_API_KEY } });
  } catch {
    throw new AppError('GENERATION_FAILED');
  }
  if (res.status === 402 || res.status === 429) throw new AppError('UPSTREAM_RATE_LIMIT');
  if (res.status === 404) throw new AppError('VIDEO_NOT_FOUND');
  if (res.status !== 200) throw new AppError('NO_CAPTIONS');

  const transcript = parseSupadata(await res.json());
  if (!transcript) throw new AppError('NO_CAPTIONS');
  return transcript;
}
