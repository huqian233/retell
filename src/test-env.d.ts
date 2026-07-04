/// <reference types="@cloudflare/vitest-pool-workers/types" />
import type { Env as WorkerEnv } from './worker/env';

// pool-workers 0.18/vitest4 中 `cloudflare:test` 的 env 类型为全局 Cloudflare.Env。
// 用我们手写的 Env 承接它,使 env.CONTEXT 等绑定在 tsc 下有类型。
declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {}
  }
}
