import type { Env } from './env';
import type { Services } from './services';
import type { GenerateRequest, StreamEvent } from '../shared/protocol';
import { AppError, toStreamError, errorResponse } from './errors';
import { parseArticle } from '../shared/chapters';
import { enforceIp, enforceBudget, clientIp } from './limits';

export async function handleGenerate(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  services: Services,
): Promise<Response> {
  let body: GenerateRequest;
  try {
    body = await request.json();
  } catch {
    return errorResponse(new AppError('INVALID_REQUEST'));
  }
  if (!body || typeof body.url !== 'string') return errorResponse(new AppError('INVALID_REQUEST'));
  if (body.requirements != null && (typeof body.requirements !== 'string' || body.requirements.length > 500)) {
    return errorResponse(new AppError('INVALID_REQUEST'));
  }

  try {
    await enforceIp(env, clientIp(request), 'generate');
    await enforceBudget(env);
  } catch (e) {
    return errorResponse(e);
  }

  const contextId = crypto.randomUUID();
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();
  const send = (e: StreamEvent) => writer.write(encoder.encode(JSON.stringify(e) + '\n'));

  const pump = async () => {
    try {
      const tx = await services.getTranscript(body.url);
      await send({ type: 'meta', contextId, title: tx.title, author: tx.author, subtitleSource: tx.source });

      let full = '';
      for await (const delta of services.streamArticle({ transcript: tx.transcript, title: tx.title, requirements: body.requirements })) {
        full += delta;
        await send({ type: 'delta', text: delta });
      }

      const { chapters } = parseArticle(full);
      const stub = env.CONTEXT.get(env.CONTEXT.idFromName(contextId));
      await stub.save({
        meta: { videoId: tx.videoId, title: tx.title, author: tx.author, requirements: body.requirements, subtitleSource: tx.source, createdAt: Date.now() },
        transcript: tx.transcript,
        chapters,
      });
      await send({ type: 'done', chapters: chapters.length });
    } catch (e) {
      await send({ type: 'error', ...toStreamError(e) });
    } finally {
      await writer.close();
    }
  };
  ctx.waitUntil(pump());

  return new Response(readable, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
  });
}
