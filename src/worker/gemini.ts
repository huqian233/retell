import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, generateObject } from 'ai';
import { z } from 'zod';
import type { Env } from './env';
import type { WHResult } from '../shared/protocol';
import { AppError } from './errors';
import { articleSystemPrompt, articleUserPrompt, whPrompt, type ArticleInput, type WHInput } from './prompts';

function isRateLimit(e: unknown): boolean {
  const s = (e as { statusCode?: number })?.statusCode;
  return s === 429 || /429|rate|quota|resource[_ ]?exhausted/i.test(String(e));
}

export async function* streamArticle(input: ArticleInput, env: Env): AsyncIterable<string> {
  const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
  const result = streamText({
    model: google(env.GEMINI_MODEL),
    system: articleSystemPrompt(),
    prompt: articleUserPrompt(input),
    // 关掉思考模式:流式首字从 ~7.5s 降到 ~1s,实时感是本任务重点。
    providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
  });
  try {
    for await (const delta of result.textStream) yield delta;
  } catch (e) {
    throw isRateLimit(e) ? new AppError('UPSTREAM_RATE_LIMIT') : new AppError('GENERATION_FAILED');
  }
}

const WHSchema = z.object({
  who: z.string(),
  what: z.string(),
  when: z.string(),
  where: z.string(),
  why: z.string(),
  how: z.string(),
});

export async function generateWH(input: WHInput, env: Env): Promise<WHResult> {
  const google = createGoogleGenerativeAI({ apiKey: env.GEMINI_API_KEY });
  try {
    const { object } = await generateObject({
      model: google(env.GEMINI_MODEL),
      schema: WHSchema,
      prompt: whPrompt(input),
    });
    return object;
  } catch (e) {
    throw isRateLimit(e) ? new AppError('UPSTREAM_RATE_LIMIT') : new AppError('GENERATION_FAILED');
  }
}
