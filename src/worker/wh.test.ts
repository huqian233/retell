import { it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { handleWH } from './wh';
import type { Services } from './services';
import type { WHResult } from '../shared/protocol';

function post(bodyObj: unknown) {
  return new Request('http://x/api/wh', { method: 'POST', body: JSON.stringify(bodyObj) });
}

function services(gen: () => Promise<WHResult>): Services {
  return {
    getTranscript: async () => ({ videoId: 'v', title: 'T', author: 'A', transcript: '', source: 'live' }),
    streamArticle: async function* () {},
    generateWH: gen,
  };
}

async function seed(id: string) {
  const stub = env.CONTEXT.get(env.CONTEXT.idFromName(id));
  await stub.save({
    meta: { videoId: 'v', title: 'T', author: 'A', subtitleSource: 'live', createdAt: 1 },
    transcript: 'FULL',
    chapters: [{ title: '章一', content: '内容' }],
  });
}

it('未命中则生成并写回,命中则不再生成', async () => {
  await seed('wh-1');
  let calls = 0;
  const svc = services(async () => {
    calls++;
    return { who: 'W', what: '', when: '', where: '', why: '', how: '' };
  });

  const r1 = await handleWH(post({ contextId: 'wh-1', chapter: 0 }), env, svc);
  expect((await r1.json() as WHResult).who).toBe('W');
  expect(calls).toBe(1);

  const r2 = await handleWH(post({ contextId: 'wh-1', chapter: 0 }), env, svc);
  expect((await r2.json() as WHResult).who).toBe('W');
  expect(calls).toBe(1);
});

it('上下文不存在 → CONTEXT_EXPIRED 404', async () => {
  const svc = services(async () => ({ who: '', what: '', when: '', where: '', why: '', how: '' }));
  const res = await handleWH(post({ contextId: 'missing', chapter: 0 }), env, svc);
  expect(res.status).toBe(404);
  expect((await res.json() as { error: { code: string } }).error.code).toBe('CONTEXT_EXPIRED');
});

it('章节越界 → INVALID_REQUEST 400', async () => {
  await seed('wh-2');
  const svc = services(async () => ({ who: '', what: '', when: '', where: '', why: '', how: '' }));
  const res = await handleWH(post({ contextId: 'wh-2', chapter: 9 }), env, svc);
  expect(res.status).toBe(400);
});
