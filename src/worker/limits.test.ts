import { it, expect } from 'vitest';
import { env, createExecutionContext } from 'cloudflare:test';
import { enforceIp, enforceBudget } from './limits';
import { handleGenerate } from './generate';
import type { Env } from './env';
import type { Services } from './services';

const fake: Services = {
  getTranscript: async () => ({ videoId: 'v', title: 'T', author: 'A', transcript: '字幕', source: 'live' }),
  streamArticle: async function* () {
    yield '## 章一\n\n**甲**:嗨。';
  },
  generateWH: async () => ({ who: '', what: '', when: '', where: '', why: '', how: '' }),
};

it('每IP限流:第6次抛 RATE_LIMITED', async () => {
  for (let i = 0; i < 5; i++) await enforceIp(env, '1.1.1.1', 'generate');
  await expect(enforceIp(env, '1.1.1.1', 'generate')).rejects.toMatchObject({ code: 'RATE_LIMITED' });
});

it('每日预算耗尽抛 BUDGET_EXHAUSTED', async () => {
  const e = { ...env, DAILY_BUDGET: '1' } as Env;
  await enforceBudget(e);
  await expect(enforceBudget(e)).rejects.toMatchObject({ code: 'BUDGET_EXHAUSTED' });
});

it('生成处理器接入限流:同IP第6次返回 429 且不开流', async () => {
  const ctx = createExecutionContext();
  const make = () =>
    new Request('http://x/api/generate', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': '9.9.9.9' },
      body: JSON.stringify({ url: 'https://youtu.be/xRh2sVcNXQ8' }),
    });
  for (let i = 0; i < 5; i++) {
    const r = await handleGenerate(make(), env, ctx, fake);
    await r.text();
  }
  const r6 = await handleGenerate(make(), env, ctx, fake);
  expect(r6.status).toBe(429);
  expect((await r6.json() as { error: { code: string } }).error.code).toBe('RATE_LIMITED');
});
