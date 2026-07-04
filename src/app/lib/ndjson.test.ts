import { it, expect } from 'vitest';
import { readNdjson } from './ndjson';
import type { StreamEvent } from '../../shared/protocol';

function resFrom(chunks: string[]): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      for (const ch of chunks) c.enqueue(enc.encode(ch));
      c.close();
    },
  });
  return new Response(stream);
}

it('解析跨块边界的 NDJSON 行', async () => {
  const res = resFrom([
    '{"type":"meta","con',
    'textId":"x","title":"T","author":"A","subtitleSource":"live"}\n{"type":"del',
    'ta","text":"hi"}\n{"type":"done","chapters":1}\n',
  ]);
  const events: StreamEvent[] = [];
  for await (const e of readNdjson(res)) events.push(e);
  expect(events.map((e) => e.type)).toEqual(['meta', 'delta', 'done']);
});

it('容忍最后一行无换行', async () => {
  const res = resFrom(['{"type":"done","chapters":0}']);
  const events: StreamEvent[] = [];
  for await (const e of readNdjson(res)) events.push(e);
  expect(events).toHaveLength(1);
});
