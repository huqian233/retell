import { describe, it, expect } from 'vitest';
import { parseTimedText } from './timedtext';

describe('parseTimedText', () => {
  it('拼接 segs.utf8 并归一空白', () => {
    const json = {
      events: [
        { tStartMs: 0, segs: [{ utf8: 'Hello' }, { utf8: ' world' }] },
        { tStartMs: 1000, segs: [{ utf8: '\n' }] },
        { tStartMs: 2000, segs: [{ utf8: 'again' }] },
        { tStartMs: 3000 },
      ],
    };
    expect(parseTimedText(json)).toBe('Hello world again');
  });
  it('空/无 events → 空串', () => {
    expect(parseTimedText({})).toBe('');
  });
});
