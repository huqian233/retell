import { it, expect } from 'vitest';
import { env } from 'cloudflare:test';

function limiter(name: string) {
  return env.LIMITER.get(env.LIMITER.idFromName(name));
}

it('未超限放行,超限拒绝,remaining 递减', async () => {
  const l = limiter('ip:a');
  const r1 = await l.hit(2, 60_000);
  expect(r1).toEqual({ allowed: true, remaining: 1 });
  expect((await l.hit(2, 60_000)).allowed).toBe(true);
  expect(await l.hit(2, 60_000)).toEqual({ allowed: false, remaining: 0 });
});

it('不同实例互不影响', async () => {
  expect((await limiter('ip:b').hit(1, 60_000)).allowed).toBe(true);
  expect((await limiter('ip:c').hit(1, 60_000)).allowed).toBe(true);
});
