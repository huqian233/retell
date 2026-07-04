import type { GenerationContext } from './context-do';

// 绑定与变量的类型契约。RateLimiter 绑定在 Task 10 追加。
export interface Env {
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;
  DAILY_BUDGET: string;
  WEBSHARE_PROXY_HOST: string;
  WEBSHARE_PROXY_PORT: string;
  WEBSHARE_PROXY_USERNAME: string;
  WEBSHARE_PROXY_PASSWORD: string;
  CONTEXT: DurableObjectNamespace<GenerationContext>;
}
