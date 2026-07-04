// 走 webshare 代理(CONNECT 隧道 + TLS + HTTP/1.1)的探针 —— Task 6 proxyFetch 的 Node 预演。
// 目的:实测 webshare 出口 IP 能否绕过 YouTube LOGIN_REQUIRED,并抓演示视频字幕。
// 运行:node scripts/probe-proxy.mjs <videoId>
import net from 'node:net';
import tls from 'node:tls';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const videoId = process.argv[2] ?? 'xRh2sVcNXQ8';
const USER = 'mfhhlxkt';
const PASS = 'c2zz49t96lfj';
const PROXIES = [
  { host: '45.38.107.97', port: 6014 },
  { host: '31.56.127.193', port: 7684 },
  { host: '142.111.67.146', port: 5611 },
];

function dechunk(body) {
  let out = '';
  let i = 0;
  while (i < body.length) {
    const nl = body.indexOf('\r\n', i);
    if (nl < 0) break;
    const size = parseInt(body.slice(i, nl).split(';')[0].trim(), 16);
    if (!Number.isFinite(size) || size === 0) break;
    out += body.slice(nl + 2, nl + 2 + size);
    i = nl + 2 + size + 2;
  }
  return out;
}

function proxyRequest(proxy, host, path, method, bodyObj, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const sock = net.connect({ host: proxy.host, port: proxy.port });
    let phase = 'connect';
    let buf = Buffer.alloc(0);
    const fail = (e) => { sock.destroy(); reject(e instanceof Error ? e : new Error(String(e))); };
    sock.setTimeout(25000, () => fail(new Error('socket timeout')));
    sock.on('error', fail);
    sock.on('connect', () => {
      const cred = Buffer.from(`${USER}:${PASS}`).toString('base64');
      sock.write(`CONNECT ${host}:443 HTTP/1.1\r\nHost: ${host}:443\r\nProxy-Authorization: Basic ${cred}\r\n\r\n`);
    });
    sock.on('data', (d) => {
      if (phase !== 'connect') return;
      buf = Buffer.concat([buf, d]);
      const end = buf.indexOf('\r\n\r\n');
      if (end < 0) return;
      const statusLine = buf.slice(0, buf.indexOf('\r\n')).toString();
      if (!/ 200 /.test(statusLine)) return fail(new Error('CONNECT: ' + statusLine));
      phase = 'tls';
      sock.removeAllListeners('data');
      const tlsSock = tls.connect({ socket: sock, servername: host }, () => {
        const body = bodyObj ? JSON.stringify(bodyObj) : '';
        let req = `${method} ${path} HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\nAccept-Encoding: identity\r\n`;
        for (const [k, v] of Object.entries(extraHeaders)) req += `${k}: ${v}\r\n`;
        if (body) req += `Content-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\n`;
        req += '\r\n' + body;
        tlsSock.write(req);
      });
      let resp = Buffer.alloc(0);
      tlsSock.setTimeout(25000, () => fail(new Error('tls timeout')));
      tlsSock.on('data', (d) => { resp = Buffer.concat([resp, d]); });
      tlsSock.on('end', () => {
        const raw = resp.toString('utf8');
        const hEnd = raw.indexOf('\r\n\r\n');
        const headers = raw.slice(0, hEnd).toLowerCase();
        let payload = raw.slice(hEnd + 4);
        if (headers.includes('transfer-encoding: chunked')) payload = dechunk(payload);
        resolve({ status: raw.slice(0, raw.indexOf('\r\n')), payload });
      });
      tlsSock.on('error', fail);
    });
  });
}

const UA_VR = 'com.google.android.apps.youtube.vr.oculus/1.61.48 (Linux; U; Android 12L; Quest 3) gzip';
const CLIENTS = [
  { clientName: 'ANDROID_VR', clientVersion: '1.61.48', ua: UA_VR, extra: { deviceMake: 'Oculus', deviceModel: 'Quest 3', androidSdkVersion: 32, osName: 'Android', osVersion: '12L' } },
  { clientName: 'WEB', clientVersion: '2.20250101.00.00', extra: {} },
];

let winner = null;
outer: for (const proxy of PROXIES) {
  for (const c of CLIENTS) {
    try {
      const body = { context: { client: { hl: 'en', gl: 'US', clientName: c.clientName, clientVersion: c.clientVersion, ...c.extra } }, videoId };
      const headers = c.ua ? { 'User-Agent': c.ua } : {};
      const { status, payload } = await proxyRequest(proxy, 'www.youtube.com', '/youtubei/v1/player?prettyPrint=false', 'POST', body, headers);
      let json;
      try { json = JSON.parse(payload); } catch { console.log(`${proxy.host} ${c.clientName}: ${status} 非JSON(len=${payload.length})`); continue; }
      const st = json?.playabilityStatus?.status;
      const tracks = json?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      console.log(`${proxy.host} ${c.clientName}: status=${st} tracks=${tracks?.length ?? 0} title=${json?.videoDetails?.title ?? ''}`);
      if (tracks?.length) { winner = { proxy, client: c, json, tracks }; break outer; }
    } catch (e) {
      console.log(`${proxy.host} ${c.clientName}: ERROR ${e.message}`);
    }
  }
}

if (!winner) { console.error('\n所有 webshare 代理 + client 组合仍被挡。'); process.exit(2); }

const { proxy, client, json, tracks } = winner;
console.log(`\n>>> 成功:webshare ${proxy.host} + ${client.clientName}`);
const manual = tracks.filter((t) => t.kind !== 'asr');
const chosen = (manual.length ? manual : tracks)[0];
const u = new URL(chosen.baseUrl.includes('fmt=') ? chosen.baseUrl : chosen.baseUrl + '&fmt=json3');
const { payload } = await proxyRequest(proxy, u.hostname, u.pathname + u.search, 'GET', null, client.ua ? { 'User-Agent': client.ua } : {});
const sub = JSON.parse(payload);
const events = (sub.events ?? []).filter((e) => e.segs);
const text = events.map((e) => e.segs.map((s) => s.utf8 ?? '').join('')).join('').replace(/\s+/g, ' ').trim();
console.log(`选中轨 lang=${chosen.languageCode} kind=${chosen.kind ?? 'manual'} 事件=${events.length} 文本长度=${text.length}`);
console.log('样例:', text.slice(0, 160));

const out = 'src/worker/subtitles/bundled-data.json';
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ videoId, title: json.videoDetails?.title, author: json.videoDetails?.author, languageCode: chosen.languageCode, transcript: text }, null, 2));
console.log('已写', out);
console.log('胜出 client:', JSON.stringify(client));
