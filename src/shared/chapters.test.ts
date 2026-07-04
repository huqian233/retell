import { describe, it, expect } from 'vitest';
import { parseArticle } from './chapters';

describe('parseArticle', () => {
  it('空串:无 intro 无章节', () => {
    expect(parseArticle('')).toEqual({ intro: '', chapters: [] });
  });

  it('只有 intro、没有二级标题', () => {
    expect(parseArticle('# 标题\n\n导语一段。')).toEqual({
      intro: '# 标题\n\n导语一段。',
      chapters: [],
    });
  });

  it('intro + 两个章节', () => {
    const md = '# 大标题\n\n引子。\n\n## 第一章\n\n**甲**:你好。\n\n## 第二章\n\n**乙**:再见。';
    const r = parseArticle(md);
    expect(r.intro).toBe('# 大标题\n\n引子。');
    expect(r.chapters).toEqual([
      { title: '第一章', content: '**甲**:你好。' },
      { title: '第二章', content: '**乙**:再见。' },
    ]);
  });

  it('不把 # 或 ### 当作章节', () => {
    const md = '## 真章节\n\n### 子标题\n\n正文。';
    const r = parseArticle(md);
    expect(r.chapters).toHaveLength(1);
    expect(r.chapters[0]!.title).toBe('真章节');
    expect(r.chapters[0]!.content).toBe('### 子标题\n\n正文。');
  });

  it('流式半截:标题行已到、正文未到', () => {
    const r = parseArticle('## 半截章节\n');
    expect(r.chapters).toEqual([{ title: '半截章节', content: '' }]);
  });

  it('标题前后多余空白容忍', () => {
    expect(parseArticle('##   带空格标题  \n内容').chapters[0]).toEqual({
      title: '带空格标题',
      content: '内容',
    });
  });
});
