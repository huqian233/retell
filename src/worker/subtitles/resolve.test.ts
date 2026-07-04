import { describe, it, expect } from 'vitest';
import { resolveVideoId } from './index';

describe('resolveVideoId', () => {
  const ID = 'xRh2sVcNXQ8';
  it.each([
    [`https://www.youtube.com/watch?v=${ID}`, ID],
    [`https://youtube.com/watch?v=${ID}&t=30s`, ID],
    [`https://youtu.be/${ID}`, ID],
    [`https://youtu.be/${ID}?si=abc`, ID],
    [`https://www.youtube.com/shorts/${ID}`, ID],
    [`https://www.youtube.com/embed/${ID}`, ID],
    [`https://www.youtube.com/live/${ID}`, ID],
    [`https://m.youtube.com/watch?v=${ID}`, ID],
  ])('解析 %s', (url, expected) => {
    expect(resolveVideoId(url)).toBe(expected);
  });

  it.each([
    'https://example.com/watch?v=xRh2sVcNXQ8',
    'https://www.youtube.com/watch?v=short',
    'not a url',
    'https://www.youtube.com/',
  ])('拒绝 %s', (url) => {
    expect(resolveVideoId(url)).toBeNull();
  });
});
