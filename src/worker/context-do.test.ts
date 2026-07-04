import { it, expect } from 'vitest';
import { env, runDurableObjectAlarm } from 'cloudflare:test';

const sample = () => ({
  meta: { videoId: 'v', title: 'T', author: 'A', subtitleSource: 'live' as const, createdAt: 1 },
  transcript: '字幕全文',
  chapters: [
    { title: '章一', content: '内容一' },
    { title: '章二', content: '内容二' },
  ],
});

function stub(name: string) {
  return env.CONTEXT.get(env.CONTEXT.idFromName(name));
}

it('save/load 往返', async () => {
  const s = stub('ctx-1');
  await s.save(sample());
  const loaded = await s.load();
  expect(loaded?.transcript).toBe('字幕全文');
  expect(loaded?.chapters).toHaveLength(2);
  expect(loaded?.meta.subtitleSource).toBe('live');
});

it('未保存则 load 返回 null', async () => {
  expect(await stub('ctx-empty').load()).toBeNull();
});

it('WH 缓存往返', async () => {
  const s = stub('ctx-2');
  await s.save(sample());
  expect(await s.getWH(0)).toBeNull();
  const wh = { who: 'w', what: 'x', when: 'y', where: 'z', why: 'p', how: 'q' };
  await s.putWH(0, wh);
  expect((await s.getWH(0))?.who).toBe('w');
});

it('闹钟触发后清空', async () => {
  const s = stub('ctx-3');
  await s.save(sample());
  const ran = await runDurableObjectAlarm(s);
  expect(ran).toBe(true);
  expect(await s.load()).toBeNull();
});
