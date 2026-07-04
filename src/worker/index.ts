import type { Env } from './env';
import { realServices } from './services';
import { handleGenerate } from './generate';
import { handleWH } from './wh';

export { GenerationContext } from './context-do';
export { RateLimiter } from './limiter-do';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/api/generate') {
      return handleGenerate(request, env, ctx, realServices(env));
    }
    if (request.method === 'POST' && url.pathname === '/api/wh') {
      return handleWH(request, env, realServices(env));
    }
    if (url.pathname === '/api/health') return Response.json({ ok: true });
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
