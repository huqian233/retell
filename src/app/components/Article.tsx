import { useMemo } from 'react';
import Markdown from 'react-markdown';
import { parseArticle } from '../../shared/chapters';
import { ChapterSection } from './ChapterSection';
import type { WHState } from '../hooks/useGeneration';

export function Article({
  article,
  canWH,
  streaming,
  whByChapter,
  onRequestWH,
}: {
  article: string;
  canWH: boolean;
  streaming: boolean;
  whByChapter?: Record<number, WHState>;
  onRequestWH?: (index: number) => void;
}) {
  const { intro, chapters } = useMemo(() => parseArticle(article), [article]);
  return (
    <article className="prose">
      {intro && <Markdown>{intro}</Markdown>}
      {chapters.map((ch, i) => (
        <ChapterSection key={i} index={i} chapter={ch} canWH={canWH} wh={whByChapter?.[i]} onRequestWH={onRequestWH} />
      ))}
      {streaming && <span className="cursor" aria-hidden="true" />}
    </article>
  );
}
