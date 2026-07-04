import { DurableObject } from 'cloudflare:workers';
import type { Env } from './env';

interface Window {
  count: number;
  resetAt: number;
}

export class RateLimiter extends DurableObject<Env> {
  async hit(limit: number, windowMs: number): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now();
    const w = (await this.ctx.storage.get<Window>('w')) ?? { count: 0, resetAt: now + windowMs };
    if (now >= w.resetAt) {
      w.count = 0;
      w.resetAt = now + windowMs;
    }
    if (w.count >= limit) return { allowed: false, remaining: 0 };
    w.count += 1;
    await this.ctx.storage.put('w', w);
    return { allowed: true, remaining: limit - w.count };
  }
}
