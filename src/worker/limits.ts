import type { Env } from './env';
import { AppError } from './errors';

const PER_IP = {
  generate: { limit: 5, windowMs: 60_000 },
  wh: { limit: 20, windowMs: 60_000 },
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'anon';
}

export async function enforceIp(env: Env, ip: string, kind: 'generate' | 'wh'): Promise<void> {
  const cfg = PER_IP[kind];
  const stub = env.LIMITER.get(env.LIMITER.idFromName(`ip:${kind}:${ip}`));
  if (!(await stub.hit(cfg.limit, cfg.windowMs)).allowed) throw new AppError('RATE_LIMITED');
}

export async function enforceBudget(env: Env): Promise<void> {
  const limit = Number(env.DAILY_BUDGET) || 200;
  const stub = env.LIMITER.get(env.LIMITER.idFromName('budget:global'));
  if (!(await stub.hit(limit, DAY_MS)).allowed) throw new AppError('BUDGET_EXHAUSTED');
}
