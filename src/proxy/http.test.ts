import { describe, it, expect } from 'vitest';
import { parseHttpResponse, decodeChunked, indexOfCRLFCRLF, concat, statusOf } from './http';

const enc = new TextEncoder();
const bytes = (s: string) => enc.encode(s);
const text = (u: Uint8Array) => new TextDecoder().decode(u);

describe('http parser', () => {
  it('content-length 正文按长度截断', () => {
    const r = parseHttpResponse(bytes('HTTP/1.1 200 OK\r\nContent-Length: 5\r\nContent-Type: text/plain\r\n\r\nhello world'));
    expect(r.status).toBe(200);
    expect(r.statusText).toBe('OK');
    expect(r.headers.get('content-type')).toBe('text/plain');
    expect(text(r.body)).toBe('hello');
  });

  it('header 键大小写不敏感', () => {
    const r = parseHttpResponse(bytes('HTTP/1.1 404 Not Found\r\nX-Foo: Bar\r\n\r\n'));
    expect(r.status).toBe(404);
    expect(r.statusText).toBe('Not Found');
    expect(r.headers.get('x-foo')).toBe('Bar');
  });

  it('chunked 解码', () => {
    const raw = 'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n5\r\nhello\r\n6\r\n world\r\n0\r\n\r\n';
    expect(text(parseHttpResponse(bytes(raw)).body)).toBe('hello world');
  });

  it('chunked 带扩展参数', () => {
    const raw = 'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n3;x=1\r\nabc\r\n0\r\n\r\n';
    expect(text(parseHttpResponse(bytes(raw)).body)).toBe('abc');
  });

  it('无 content-length 无 chunked:余下全部为正文', () => {
    const r = parseHttpResponse(bytes('HTTP/1.1 200 OK\r\nConnection: close\r\n\r\nraw body bytes'));
    expect(text(r.body)).toBe('raw body bytes');
  });

  it('缺头部终止符则抛错', () => {
    expect(() => parseHttpResponse(bytes('HTTP/1.1 200 OK\r\nContent-Length: 5'))).toThrow();
  });

  it('工具函数', () => {
    expect(indexOfCRLFCRLF(bytes('ab\r\n\r\ncd'))).toBe(2);
    expect(indexOfCRLFCRLF(bytes('abcd'))).toBe(-1);
    expect(text(concat([bytes('ab'), bytes('cd')]))).toBe('abcd');
    expect(statusOf(bytes('HTTP/1.1 200 Connection established\r\n\r\n'))).toBe(200);
    expect(text(decodeChunked(bytes('4\r\nWiki\r\n5\r\npedia\r\n0\r\n\r\n')))).toBe('Wikipedia');
  });
});
