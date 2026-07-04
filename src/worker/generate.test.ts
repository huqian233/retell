import { it, expect } from 'vitest';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { handleGenerate } from './generate';
import type { Services } from './services';
import type { StreamEvent } from '../shared/protocol';

const ARTICLE = '# 大标题\n\n导语。\n\n## 章一\n\n**甲**:嗨。\n\n## 章二\n\n**乙**:再见。';

function fakeServices(over: Partial<Services> = {}): Services {
  return {
    getTranscript: async () => ({ videoId: 'v', title: 'T', author: 'A', transcript: '字幕', source: 'live' }),
    streamArticle: async function* () {
      for (const ch of ARTICLE.match(/[\s\S]{1,10}/g)!) yield ch;
    },
    generateWH: async () => ({ who: '', what: '', when: '', where: '', why: '', how: '' }),
    ...over,
  };
}

async function collect(res: Response): Promise<StreamEvent[]> {
  const text = await res.text();
  return text.split('\n').filter(Boolean).map((l) => JSON.parse(l) as StreamEvent);
}

function post(reqBody: unknown) {
  return new Request('http://x/api/generate', { method: 'POST', body: JSON.stringify(reqBody) });
}

it('事件序列 meta→delta…→done,done 前上下文已落库', async () => {
  const ctx = createExecutionContext();
  const res = await handleGenerate(post({ url: 'https://youtu.be/xRh2sVcNXQ8' }), env, ctx, fakeServices());
  const events = await collect(res);
  await waitOnExecutionContext(ctx);

  expect(events[0]!.type).toBe('meta');
  expect(events.some((e) => e.type === 'delta')).toBe(true);
  const done = events.at(-1)!;
  expect(done.type).toBe('done');

  const meta = events[0] as Extract<StreamEvent, { type: 'meta' }>;
  const doneEv = done as Extract<StreamEvent, { type: 'done' }>;
  const stub = env.CONTEXT.get(env.CONTEXT.idFromName(meta.contextId));
  const stored = await stub.load();
  expect(stored).not.toBeNull();
  expect(stored!.chapters.length).toBe(doneEv.chapters);
  expect(doneEv.chapters).toBe(2);
});

it('字幕失败:最后一个事件是 error 且带业务码', async () => {
  const { AppError } = await import('./errors');
  const ctx = createExecutionContext();
  const res = await handleGenerate(
    post({ url: 'https://youtu.be/xRh2sVcNXQ8' }),
    env,
    ctx,
    fakeServices({ getTranscript: async () => { throw new AppError('NO_CAPTIONS'); } }),
  );
  const events = await collect(res);
  await waitOnExecutionContext(ctx);
  const last = events.at(-1) as Extract<StreamEvent, { type: 'error' }>;
  expect(last.type).toBe('error');
  expect(last.code).toBe('NO_CAPTIONS');
});

it('缺 url:返回 400 JSON,不开流', async () => {
  const ctx = createExecutionContext();
  const res = await handleGenerate(post({}), env, ctx, fakeServices());
  expect(res.status).toBe(400);
  expect((await res.json() as { error: { code: string } }).error.code).toBe('INVALID_REQUEST');
});
