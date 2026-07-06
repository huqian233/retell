import { memo } from 'react';
import Markdown from 'react-markdown';
import type { Chapter } from '../../shared/chapters';
import type { WHState } from '../hooks/useGeneration';
import { WHPanel } from './WHPanel';

export interface ChapterSectionProps {
  index: number;
  chapter: Chapter;
  canWH: boolean;
  wh?: WHState;
  onRequestWH?: (index: number) => void;
}

export const ChapterSection = memo(
  function ChapterSection({ index, chapter, canWH, wh, onRequestWH }: ChapterSectionProps) {
    return (
      <section>
        <h2 className="chapter-title">
          <span className="chapter-no" aria-hidden="true">
            {String(index + 1).padStart(2, '0')}
          </span>
          <span className="chapter-text">{chapter.title}</span>
          <button className="wh-btn" disabled={!canWH || !onRequestWH || wh?.status === 'loading'} onClick={() => onRequestWH?.(index)}>
            5W1H
          </button>
        </h2>
        {wh && <WHPanel state={wh} />}
        <Markdown>{chapter.content}</Markdown>
      </section>
    );
  },
  (a, b) =>
    a.chapter.title === b.chapter.title &&
    a.chapter.content === b.chapter.content &&
    a.canWH === b.canWH &&
    a.wh === b.wh &&
    a.onRequestWH === b.onRequestWH,
);
