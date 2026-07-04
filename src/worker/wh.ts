import type { Env } from './env';
import type { Services } from './services';
import type { WHRequest } from '../shared/protocol';
import { AppError, errorResponse } from './errors';
import { enforceIp, enforceBudget, clientIp } from './limits';

export async function handleWH(request: Request, env: Env, services: Services): Promise<Response> {
  let body: WHRequest;
  try {
    body = await request.json();
  } catch {
    return errorResponse(new AppError('INVALID_REQUEST'));
  }
  if (!body || typeof body.contextId !== 'string' || typeof body.chapter !== 'number') {
    return errorResponse(new AppError('INVALID_REQUEST'));
  }

  try {
    await enforceIp(env, clientIp(request), 'wh');
    const stub = env.CONTEXT.get(env.CONTEXT.idFromName(body.contextId));
    const stored = await stub.load();
    if (!stored) throw new AppError('CONTEXT_EXPIRED');

    const chapter = stored.chapters[body.chapter];
    if (!chapter) throw new AppError('INVALID_REQUEST');

    const cached = await stub.getWH(body.chapter);
    if (cached) return Response.json(cached);

    await enforceBudget(env);
    const wh = await services.generateWH({ transcript: stored.transcript, chapterTitle: chapter.title, chapterContent: chapter.content });
    await stub.putWH(body.chapter, wh);
    return Response.json(wh);
  } catch (e) {
    return errorResponse(e);
  }
}
