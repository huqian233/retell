import { describe, it, expect } from 'vitest';
import { AppError, toStreamError, errorResponse, USER_MESSAGE } from './errors';

describe('errors', () => {
  it('AppError 带 code 与 http', () => {
    const e = new AppError('NO_CAPTIONS');
    expect(e.code).toBe('NO_CAPTIONS');
    expect(e.http).toBe(422);
    expect(e.message).toBe(USER_MESSAGE.NO_CAPTIONS);
  });

  it('toStreamError 把 AppError 转为 error 事件载荷', () => {
    expect(toStreamError(new AppError('VIDEO_NOT_FOUND'))).toEqual({
      code: 'VIDEO_NOT_FOUND',
      message: USER_MESSAGE.VIDEO_NOT_FOUND,
    });
  });

  it('toStreamError 把未知错误归为 GENERATION_FAILED', () => {
    expect(toStreamError(new Error('boom'))).toEqual({
      code: 'GENERATION_FAILED',
      message: USER_MESSAGE.GENERATION_FAILED,
    });
  });

  it('errorResponse 返回对应 HTTP 状态与 JSON 体', async () => {
    const res = errorResponse(new AppError('RATE_LIMITED'));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({
      error: { code: 'RATE_LIMITED', message: USER_MESSAGE.RATE_LIMITED },
    });
  });
});
