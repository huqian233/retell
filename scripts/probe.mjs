// 直连探针:实测当天哪套方法能拿到 YouTube 字幕轨,并抓取演示视频字幕。
// 运行:node scripts/probe.mjs <videoId>
// 需能直连 YouTube/Google(大陆需 HTTPS_PROXY + NODE_USE_ENV_PROXY=1)。
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const videoId = process.argv[2] ?? 'xRh2sVcNXQ8';
const UA_VR = 'com.google.android.apps.youtube.vr.oculus/1.61.48 (Linux; U; Android 12L; Quest 3) gzip';

// 候选 client 上下文,按当前绕过 LOGIN_REQUIRED 的可能性排序。
const CLIENTS = [
  { clientName: 'ANDROID_VR', clientVersion: '1.61.48', ua: UA_VR, extra: { deviceMake: 'Oculus', deviceModel: 'Quest 3', androidSdkVersion: 32, osName: 'Android', osVersion: '12L' } },
  { clientName: 'ANDROID_VR', clientVersion: '1.62.27', ua: UA_VR, extra: { deviceMake: 'Oculus', deviceModel: 'Quest 3', androidSdkVersion: 32, osName: 'Android', osVersion: '12L' } },
  { clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.0', extra: {} },
  { clientName: 'WEB_EMBEDDED_PLAYER', clientVersion: '1.20250101.00.00', extra: {} },
  { clientName: 'ANDROID_TESTSUITE', clientVersion: '1.9', extra: { androidSdkVersion: 30 } },
  { clientName: 'MWEB', clientVersion: '2.20250101.00.00', extra: {} },
];

async function tryClient(c) {
  const headers = { 'content-type': 'application/json' };
  if (c.ua) headers['user-agent'] = c.ua;
  const res = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      context: { client: { hl: 'en', gl: 'US', clientName: c.clientName, clientVersion: c.clientVersion, ...(c.extra ?? {}) } },
      videoId,
    }),
  });
  const json = await res.json();
  const tracks = json?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  return {
    label: `${c.clientName}@${c.clientVersion}`, http: res.status,
    status: json?.playabilityStatus?.status,
    trackCount: tracks?.length ?? 0,
    title: json?.videoDetails?.title, author: json?.videoDetails?.author, tracks,
  };
}

// 备用方法:抓 watch 页 HTML,从 ytInitialPlayerResponse 提取字幕轨。
async function tryWatchPage() {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=en`, {
    headers: {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
      'accept-language': 'en-US,en;q=0.9',
    },
  });
  const html = await res.text();
  const m = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var|<\/script>)/s);
  if (!m) return { label: 'WATCH_PAGE', http: res.status, status: 'NO_PLAYER_RESPONSE', trackCount: 0 };
  let json;
  try { json = JSON.parse(m[1]); } catch { return { label: 'WATCH_PAGE', http: res.status, status: 'PARSE_FAIL', trackCount: 0 }; }
  const tracks = json?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  return {
    label: 'WATCH_PAGE', http: res.status,
    status: json?.playabilityStatus?.status,
    trackCount: tracks?.length ?? 0,
    title: json?.videoDetails?.title, author: json?.videoDetails?.author, tracks,
  };
}

const results = [];
let winner = null;
for (const c of CLIENTS) {
  try {
    const r = await tryClient(c);
    results.push(r);
    console.log(`${r.label}: http=${r.http} status=${r.status} tracks=${r.trackCount}`);
    if (r.trackCount > 0 && !winner) winner = r;
  } catch (e) {
    console.log(`${c.clientName}: ERROR ${e.message}`);
  }
}
if (!winner) {
  try {
    const r = await tryWatchPage();
    results.push(r);
    console.log(`${r.label}: http=${r.http} status=${r.status} tracks=${r.trackCount}`);
    if (r.trackCount > 0) winner = r;
  } catch (e) {
    console.log(`WATCH_PAGE: ERROR ${e.message}`);
  }
}

if (!winner) {
  console.error('\n所有方法都没拿到字幕轨(YouTube 登录墙)。');
  process.exit(2);
}

const manual = winner.tracks.filter((t) => t.kind !== 'asr');
const chosen = (manual.length ? manual : winner.tracks)[0];
console.log(`\n>>> 胜出:${winner.label}  选中轨 lang=${chosen.languageCode} kind=${chosen.kind ?? 'manual'}`);

const sub = await fetch(`${chosen.baseUrl}&fmt=json3`).then((r) => r.json());
const events = (sub.events ?? []).filter((e) => e.segs);
const text = events.map((e) => e.segs.map((s) => s.utf8 ?? '').join('')).join('').replace(/\s+/g, ' ').trim();
console.log(`字幕事件数=${events.length} 文本长度=${text.length}`);
console.log('样例:', text.slice(0, 160));

const out = 'src/worker/subtitles/bundled-data.json';
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({
  videoId, title: winner.title, author: winner.author,
  languageCode: chosen.languageCode, transcript: text,
}, null, 2));
console.log('已写', out);
