import { connect } from 'cloudflare:sockets';
import { parseHttpResponse, indexOfCRLFCRLF, concat, statusOf, type HttpResponse } from './http';
import type { Env } from '../worker/env';

const enc = new TextEncoder();

export interface ProxyConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface ProxyRequest {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

// webshare 免费档给的是 10 个独立 host:port(共用账密)。解析成列表,由上层轮换重试。
export function proxiesFromEnv(env: Env): ProxyConfig[] {
  const username = env.WEBSHARE_PROXY_USERNAME.trim();
  const password = env.WEBSHARE_PROXY_PASSWORD.trim();
  return env.WEBSHARE_PROXIES.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((hp) => {
      const [host, port] = hp.split(':');
      return { host: host!.trim(), port: Number(port), username, password };
    });
}

export async function proxyFetch(target: string, req: ProxyRequest, proxy: ProxyConfig): Promise<HttpResponse> {
  const url = new URL(target);
  const host = url.hostname;
  const port = url.port ? Number(url.port) : 443;

  const socket = connect(
    { hostname: proxy.host, port: proxy.port },
    { secureTransport: 'starttls', allowHalfOpen: false },
  );

  try {
    await socket.opened;

    // 1) CONNECT 隧道
    const cred = btoa(`${proxy.username}:${proxy.password}`);
    const connectReq =
      `CONNECT ${host}:${port} HTTP/1.1\r\n` +
      `Host: ${host}:${port}\r\n` +
      `Proxy-Authorization: Basic ${cred}\r\n` +
      `Proxy-Connection: keep-alive\r\n\r\n`;
    const w0 = socket.writable.getWriter();
    await w0.write(enc.encode(connectReq));
    w0.releaseLock();
    await readConnectResponse(socket.readable);

    // 2) 升级 TLS(SNI 指向真实目标主机),等握手完成再写,否则报 TLS Handshake Failed
    const secure = socket.startTls({ expectedServerHostname: host });
    await secure.opened;

    // 3) 手写 HTTP/1.1 请求
    const method = req.method ?? 'GET';
    const bodyBytes = req.body ? enc.encode(req.body) : undefined;
    const headers: Record<string, string> = {
      Host: host,
      'User-Agent': 'Mozilla/5.0',
      Accept: '*/*',
      'Accept-Encoding': 'identity',
      Connection: 'close',
      ...req.headers,
    };
    if (bodyBytes) headers['Content-Length'] = String(bodyBytes.byteLength);
    let head = `${method} ${url.pathname}${url.search} HTTP/1.1\r\n`;
    for (const [k, v] of Object.entries(headers)) head += `${k}: ${v}\r\n`;
    head += '\r\n';

    const w = secure.writable.getWriter();
    await w.write(enc.encode(head));
    if (bodyBytes) await w.write(bodyBytes);
    w.releaseLock();

    const raw = await readToEnd(secure.readable);
    return parseHttpResponse(raw);
  } finally {
    try {
      await socket.close();
    } catch {
      /* 已关闭 */
    }
  }
}

async function readConnectResponse(readable: ReadableStream<Uint8Array>): Promise<void> {
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) throw new Error('proxy closed during CONNECT');
      chunks.push(value);
      const buf = concat(chunks);
      if (indexOfCRLFCRLF(buf) >= 0) {
        const status = statusOf(buf);
        if (status !== 200) throw new Error(`proxy CONNECT failed: ${status}`);
        return;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function readToEnd(readable: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = readable.getReader();
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return concat(chunks);
}
