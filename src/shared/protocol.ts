export type SubtitleSource = 'bundled' | 'live';

export interface GenerateRequest {
  url: string;
  requirements?: string;
}

export interface WHRequest {
  contextId: string;
  chapter: number;
}

export interface WHResult {
  who: string;
  what: string;
  when: string;
  where: string;
  why: string;
  how: string;
}

export type StreamEvent =
  | { type: 'meta'; contextId: string; title: string; author: string; subtitleSource: SubtitleSource }
  | { type: 'delta'; text: string }
  | { type: 'done'; chapters: number }
  | { type: 'error'; code: string; message: string };

export const WH_KEYS = ['who', 'what', 'when', 'where', 'why', 'how'] as const;

export const WH_LABELS: Record<keyof WHResult, string> = {
  who: 'Who',
  what: 'What',
  when: 'When',
  where: 'Where',
  why: 'Why',
  how: 'How',
};
