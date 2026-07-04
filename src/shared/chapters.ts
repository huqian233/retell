export interface Chapter {
  title: string;
  content: string;
}

const H2 = /^##(?!#)\s+(.*)$/;

export function parseArticle(md: string): { intro: string; chapters: Chapter[] } {
  const lines = md.split('\n');
  const introLines: string[] = [];
  const chapters: Chapter[] = [];
  let current: { title: string; body: string[] } | null = null;

  for (const line of lines) {
    const m = H2.exec(line);
    if (m) {
      current = { title: m[1]!.trim(), body: [] };
      chapters.push({ title: current.title, content: '' });
    } else if (current) {
      current.body.push(line);
      chapters[chapters.length - 1]!.content = current.body.join('\n').trim();
    } else {
      introLines.push(line);
    }
  }

  return { intro: introLines.join('\n').trim(), chapters };
}
