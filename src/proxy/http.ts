export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Map<string, string>;
  body: Uint8Array;
}

const td = new TextDecoder();

export function concat(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const c of chunks) total += c.byteLength;
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

export function indexOfCRLFCRLF(buf: Uint8Array): number {
  for (let i = 0; i + 3 < buf.length; i++) {
    if (buf[i] === 13 && buf[i + 1] === 10 && buf[i + 2] === 13 && buf[i + 3] === 10) return i;
  }
  return -1;
}

export function statusOf(buf: Uint8Array): number {
  const nl = buf.indexOf(10);
  const line = td.decode(buf.subarray(0, nl < 0 ? buf.length : nl));
  const m = /^HTTP\/\d\.\d\s+(\d{3})/.exec(line);
  if (!m) throw new Error('bad status line');
  return Number(m[1]);
}

export function decodeChunked(data: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [];
  let i = 0;
  while (i < data.length) {
    let j = i;
    while (j + 1 < data.length && !(data[j] === 13 && data[j + 1] === 10)) j++;
    const size = parseInt(td.decode(data.subarray(i, j)).split(';')[0]!.trim(), 16);
    i = j + 2;
    if (!Number.isFinite(size) || size <= 0) break;
    parts.push(data.subarray(i, i + size));
    i += size + 2;
  }
  return concat(parts);
}

export function parseHttpResponse(raw: Uint8Array): HttpResponse {
  const b = indexOfCRLFCRLF(raw);
  if (b < 0) throw new Error('incomplete HTTP response: no header terminator');
  const headerText = td.decode(raw.subarray(0, b));
  const rest = raw.subarray(b + 4);

  const [statusLine, ...headerLines] = headerText.split('\r\n');
  const sm = /^HTTP\/\d\.\d\s+(\d{3})\s*(.*)$/.exec(statusLine!);
  if (!sm) throw new Error('bad status line');
  const status = Number(sm[1]);
  const statusText = (sm[2] ?? '').trim();

  const headers = new Map<string, string>();
  for (const line of headerLines) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    headers.set(line.slice(0, idx).trim().toLowerCase(), line.slice(idx + 1).trim());
  }

  let body = rest;
  const te = headers.get('transfer-encoding');
  const cl = headers.get('content-length');
  if (te && /chunked/i.test(te)) body = decodeChunked(rest);
  else if (cl) body = rest.subarray(0, Number(cl));

  return { status, statusText, headers, body: new Uint8Array(body) };
}
