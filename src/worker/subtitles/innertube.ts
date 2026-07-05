// ⚠️ 首个方案:在 Worker 内用 webshare 代理 + 裸 TCP socket 直连 YouTube InnerTube。
// 2026 年实测撞上 PO Token / BotGuard 墙(详见 docs/youtube-subtitle-investigation.md),
// 已由 subtitles/supadata.ts 取代。此模块保留、单测仍绿,作为"实现→诊断→取舍"的工程佐证。
import { proxyFetch, type ProxyConfig } from '../../proxy/client';
import { AppError } from '../errors';
import { INNERTUBE_CLIENT, PLAYER_PATH, INNERTUBE_UA } from './innertube-config';

export interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  name?: unknown;
}

export interface PlayerResult {
  title: string;
  author: string;
  tracks: CaptionTrack[];
}

interface PlayerJson {
  playabilityStatus?: { status?: string };
  videoDetails?: { title?: string; author?: string };
  captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } };
}

export function parsePlayerResponse(json: unknown): PlayerResult {
  const p = json as PlayerJson;
  const status = p.playabilityStatus?.status;
  if (status && status !== 'OK') throw new AppError('VIDEO_NOT_FOUND');
  const tracks = p.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  if (!tracks.length) throw new AppError('NO_CAPTIONS');
  return {
    title: p.videoDetails?.title ?? '未知标题',
    author: p.videoDetails?.author ?? '未知作者',
    tracks,
  };
}

export function chooseTrack(tracks: CaptionTrack[]): CaptionTrack {
  if (!tracks.length) throw new AppError('NO_CAPTIONS');
  const manual = tracks.filter((t) => t.kind !== 'asr');
  return (manual.length ? manual : tracks)[0]!;
}

export async function fetchPlayer(videoId: string, proxy: ProxyConfig): Promise<PlayerResult> {
  let res;
  try {
    res = await proxyFetch(
      `https://www.youtube.com${PLAYER_PATH}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'user-agent': INNERTUBE_UA },
        body: JSON.stringify({ context: { client: INNERTUBE_CLIENT }, videoId }),
      },
      proxy,
    );
  } catch {
    throw new AppError('YOUTUBE_BLOCKED');
  }
  if (res.status === 403 || res.status === 429) throw new AppError('YOUTUBE_BLOCKED');
  if (res.status !== 200) throw new AppError('VIDEO_NOT_FOUND');
  return parsePlayerResponse(JSON.parse(new TextDecoder().decode(res.body)));
}

export async function fetchTimedTextJson(baseUrl: string, proxy: ProxyConfig): Promise<unknown> {
  const url = /[?&]fmt=/.test(baseUrl) ? baseUrl : `${baseUrl}&fmt=json3`;
  let res;
  try {
    res = await proxyFetch(url, { method: 'GET', headers: { 'user-agent': INNERTUBE_UA } }, proxy);
  } catch {
    throw new AppError('YOUTUBE_BLOCKED');
  }
  if (res.status !== 200) throw new AppError('YOUTUBE_BLOCKED');
  return JSON.parse(new TextDecoder().decode(res.body));
}
