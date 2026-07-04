import type { Env } from './env';
import type { WHResult } from '../shared/protocol';
import { getTranscript, type TranscriptResult } from './subtitles/index';
import { streamArticle, generateWH } from './gemini';
import type { ArticleInput, WHInput } from './prompts';

export interface Services {
  getTranscript(url: string): Promise<TranscriptResult>;
  streamArticle(input: ArticleInput): AsyncIterable<string>;
  generateWH(input: WHInput): Promise<WHResult>;
}

export function realServices(env: Env): Services {
  return {
    getTranscript: (url) => getTranscript(url, env),
    streamArticle: (input) => streamArticle(input, env),
    generateWH: (input) => generateWH(input, env),
  };
}
