export type ErrorCode =
  | 'INVALID_REQUEST'
  | 'VIDEO_NOT_FOUND'
  | 'NO_CAPTIONS'
  | 'YOUTUBE_BLOCKED'
  | 'UPSTREAM_RATE_LIMIT'
  | 'RATE_LIMITED'
  | 'BUDGET_EXHAUSTED'
  | 'CONTEXT_EXPIRED'
  | 'GENERATION_FAILED';

const HTTP: Record<ErrorCode, number> = {
  INVALID_REQUEST: 400,
  VIDEO_NOT_FOUND: 404,
  NO_CAPTIONS: 422,
  YOUTUBE_BLOCKED: 502,
  UPSTREAM_RATE_LIMIT: 429,
  RATE_LIMITED: 429,
  BUDGET_EXHAUSTED: 429,
  CONTEXT_EXPIRED: 404,
  GENERATION_FAILED: 502,
};

export const USER_MESSAGE: Record<ErrorCode, string> = {
  INVALID_REQUEST: '链接无效,请检查是否为有效的 YouTube 视频链接。',
  VIDEO_NOT_FOUND: '找不到该视频,可能已被删除或设为私享。',
  NO_CAPTIONS: '该视频没有字幕,请换一个有字幕的视频。',
  YOUTUBE_BLOCKED: '连续尝试后仍被 YouTube 拦截,请稍后再试。',
  UPSTREAM_RATE_LIMIT: 'Gemini 额度紧张,请稍后再试。',
  RATE_LIMITED: '操作太频繁,请稍候再试。',
  BUDGET_EXHAUSTED: '今日演示额度已用尽,明日恢复。',
  CONTEXT_EXPIRED: '生成上下文已过期,请重新生成文章。',
  GENERATION_FAILED: '生成中断,请重试。',
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly http: number;
  constructor(code: ErrorCode) {
    super(USER_MESSAGE[code]);
    this.name = 'AppError';
    this.code = code;
    this.http = HTTP[code];
  }
}

export function toStreamError(e: unknown): { code: string; message: string } {
  if (e instanceof AppError) return { code: e.code, message: e.message };
  return { code: 'GENERATION_FAILED', message: USER_MESSAGE.GENERATION_FAILED };
}

export function errorResponse(e: unknown): Response {
  const { code, message } =
    e instanceof AppError
      ? { code: e.code, message: e.message }
      : { code: 'GENERATION_FAILED', message: USER_MESSAGE.GENERATION_FAILED };
  const status = e instanceof AppError ? e.http : 502;
  return Response.json({ error: { code, message } }, { status });
}
