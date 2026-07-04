import { useCallback, useRef, useState } from 'react';
import type { SubtitleSource, WHResult } from '../../shared/protocol';
import { readNdjson } from '../lib/ndjson';

export type Status = 'idle' | 'fetching' | 'streaming' | 'done' | 'error';

export type WHState =
  | { status: 'loading' }
  | { status: 'done'; data: WHResult }
  | { status: 'error'; message: string };

export interface Meta {
  contextId: string;
  title: string;
  author: string;
  subtitleSource: SubtitleSource;
}

export interface GenerationState {
  status: Status;
  article: string;
  meta: Meta | null;
  error: string | null;
  whByChapter: Record<number, WHState>;
}

const initial: GenerationState = { status: 'idle', article: '', meta: null, error: null, whByChapter: {} };

export function useGeneration() {
  const [state, setState] = useState<GenerationState>(initial);
  const ref = useRef(state);
  ref.current = state;

  const generate = useCallback(async (url: string, requirements: string) => {
    setState({ ...initial, status: 'fetching' });
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url, requirements: requirements.trim() || undefined }),
      });
      if (!res.ok && (res.headers.get('content-type') ?? '').includes('application/json')) {
        const j = (await res.json()) as { error: { message: string } };
        setState((s) => ({ ...s, status: 'error', error: j.error.message }));
        return;
      }
      for await (const ev of readNdjson(res)) {
        switch (ev.type) {
          case 'meta':
            setState((s) => ({
              ...s,
              status: 'streaming',
              meta: { contextId: ev.contextId, title: ev.title, author: ev.author, subtitleSource: ev.subtitleSource },
            }));
            break;
          case 'delta':
            setState((s) => ({ ...s, article: s.article + ev.text }));
            break;
          case 'done':
            setState((s) => ({ ...s, status: 'done' }));
            break;
          case 'error':
            setState((s) => ({ ...s, status: 'error', error: ev.message }));
            break;
        }
      }
    } catch {
      setState((s) => ({ ...s, status: 'error', error: '网络中断,请重试。' }));
    }
  }, []);

  const requestWH = useCallback(async (chapter: number) => {
    const cur = ref.current;
    if (!cur.meta) return;
    const existing = cur.whByChapter[chapter];
    if (existing?.status === 'loading' || existing?.status === 'done') return;

    setState((s) => ({ ...s, whByChapter: { ...s.whByChapter, [chapter]: { status: 'loading' } } }));
    const setWH = (w: WHState) =>
      setState((s) => ({ ...s, whByChapter: { ...s.whByChapter, [chapter]: w } }));
    try {
      const res = await fetch('/api/wh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contextId: cur.meta.contextId, chapter }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error: { message: string } };
        setWH({ status: 'error', message: j.error.message });
        return;
      }
      setWH({ status: 'done', data: (await res.json()) as WHResult });
    } catch {
      setWH({ status: 'error', message: '网络错误,请重试。' });
    }
  }, []);

  return { state, generate, requestWH };
}
