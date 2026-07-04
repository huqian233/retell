import type { GenerationContext } from './context-do';
import type { RateLimiter } from './limiter-do';

// 绑定与变量的类型契约。
export interface Env {
  GEMINI_API_KEY: string;
  GEMINI_MODEL: string;
  DAILY_BUDGET: string;
  WEBSHARE_PROXY_USERNAME: string;
  WEBSHARE_PROXY_PASSWORD: string;
  WEBSHARE_PROXIES: string;
  CONTEXT: DurableObjectNamespace<GenerationContext>;
  LIMITER: DurableObjectNamespace<RateLimiter>;
}
