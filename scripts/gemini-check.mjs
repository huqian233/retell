// 验证 AI SDK google provider + 当前 key + 型号 + 流式。
// 运行:node scripts/gemini-check.mjs  （需 GEMINI_API_KEY / GEMINI_MODEL + VPN）
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';

const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
const t = Date.now();
const r = streamText({
  model: google(model),
  prompt: '用一句话中文介绍你自己。',
  providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
});
let out = '';
let first = 0;
for await (const d of r.textStream) {
  if (!first) first = Date.now() - t;
  out += d;
  process.stdout.write(d);
}
console.log(`\n[model=${model} firstChunk=${first}ms total=${Date.now() - t}ms len=${out.length}]`);
