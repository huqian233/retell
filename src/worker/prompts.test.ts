import { describe, it, expect } from 'vitest';
import { articleSystemPrompt, articleUserPrompt, whPrompt } from './prompts';

describe('prompts', () => {
  it('系统提示词含中文与二级标题约束', () => {
    const s = articleSystemPrompt();
    expect(s).toContain('简体中文');
    expect(s).toContain('##');
  });

  it('无生成要求时不含用户围栏', () => {
    const p = articleUserPrompt({ transcript: 'hi', title: 'T' });
    expect(p).toContain('字幕原文');
    expect(p).not.toContain('<user_requirements>');
  });

  it('有生成要求时用围栏包裹并声明冲突以规则为准', () => {
    const p = articleUserPrompt({ transcript: 'hi', title: 'T', requirements: '面向初学者' });
    expect(p).toContain('<user_requirements>');
    expect(p).toContain('面向初学者');
    expect(p).toContain('以规则为准');
  });

  it('whPrompt 含章节标题、章节内容与整篇字幕', () => {
    const p = whPrompt({ transcript: 'FULL', chapterTitle: 'CT', chapterContent: 'CC' });
    expect(p).toContain('CT');
    expect(p).toContain('CC');
    expect(p).toContain('FULL');
  });
});
