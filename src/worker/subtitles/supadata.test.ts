import { describe, it, expect } from 'vitest';
import { parseSupadata } from './supadata';

describe('parseSupadata', () => {
  it('拼接分段文本并归一空白', () => {
    const json = { lang: 'en', content: [{ text: 'hello  world' }, { text: 'foo\nbar' }] };
    expect(parseSupadata(json)).toBe('hello world foo bar');
  });

  it('兼容 content 为纯字符串的情形', () => {
    expect(parseSupadata({ content: '  a   b  ' })).toBe('a b');
  });

  it('缺失或空 content 返回空串', () => {
    expect(parseSupadata({})).toBe('');
    expect(parseSupadata({ content: [] })).toBe('');
    expect(parseSupadata({ content: [{ offset: 0 }] })).toBe('');
  });
});
