# Retell · 把 YouTube 视频转述成中文文章

粘贴一个有字幕的 YouTube 链接,生成一篇结构清晰的中文文章:正文流式输出、边生成边渲染,每个章节可一键生成 5W1H 总结。整个应用是单个 Cloudflare Worker,同时托管前端和接口。

**在线地址:** https://retell.huqian188.workers.dev (演示视频开箱即用)

## 速览:任务要求 → 实现

| 任务要求 | 做法 | 代码 |
|---|---|---|
| 获取/处理字幕 | 演示视频用内置副本;其他视频经 Supadata 实时抓取;直连、webshare 代理、PoToken 三条路线均实测,见下节 | `src/worker/subtitles/` |
| Gemini 流式输出 | `streamText` 增量流封成 NDJSON 逐行下发;关闭思考模式,首字约 1 秒 | `src/worker/gemini.ts` |
| 用户生成要求影响输出 | 当作不可信输入,围栏包裹后注入提示词,与规则冲突时规则优先 | `src/worker/prompts.ts` |
| 章节级 5W1H | 上下文存 Durable Object,前端只传 `{contextId, chapter}`,结果缓存、重复点击不重复计费 | `src/worker/wh.ts` |
| webshare 代理 + 原始 socket | `cloudflare:sockets` 手写 CONNECT 隧道 + TLS + HTTP/1.1 客户端,完整实现并有单测 | `src/proxy/` |

## 字幕获取:三条路线的实测结论

2026 年匿名抓 YouTube 字幕的主要障碍是「Sign in to confirm you're not a bot」登录墙。在本机、Cloudflare 边缘、一台美国服务器出口分别实测后的结论:

- **登录墙是间歇性限流,不是永久封锁。** 按 IP 信誉触发、冷却后恢复。直连 InnerTube 接口 + 退避重试,已从 Cloudflare 边缘端到端跑通(真实 TED 视频取到完整字幕并生成文章),低频使用够用,但达不到 100%。
- **webshare 免费代理被两道墙挡住**:免费档在 443 端口不承载 HTTPS(CONNECT 隧道能建、明文能通,startTls 后读到 0 字节,10 个代理皆然);且匿名出口本身就会间歇被要求登录。
- **要「任意视频稳定出结果」,需要住宅代理、登录 Cookie 或 PoToken 之一。**

据此线上取舍:演示视频走内置字幕副本(页面明示来源);其他视频交给 Supadata,由它在服务端处理住宅代理与 PoToken;抓不到时返回带类型的错误,不伪造内容。自写的代理引擎保留,配一份住宅代理或 Cookie 即可对任意视频跑通。完整实测数据与踩坑记录见 [`docs/youtube-subtitle-investigation.md`](docs/youtube-subtitle-investigation.md)。

## 架构

```
浏览器(React 单页,Vite 打包)
  │  POST /api/generate → NDJSON 流(meta / delta / done / error)
  │  POST /api/wh       → JSON(Who / What / When / Where / Why / How)
  ▼
Cloudflare Worker(单一)
  ├─ 静态资源(打包后的前端,SPA 回退)
  ├─ generate:字幕 → Gemini 流式 → 逐行 NDJSON;完成后写上下文
  ├─ wh:读上下文 → 缓存命中或生成
  ├─ GenerationContext(Durable Object,SQLite,24 小时后自毁)
  └─ RateLimiter(Durable Object,每 IP 限流 + 每日预算)
外部:Supadata(实时字幕)、Gemini(直连)
```

前端零密钥,不直连任何上游。

## 本地运行

```bash
npm install
cp .dev.vars.example .dev.vars   # 填入 Gemini Key、Supadata Key
npm run dev                      # http://localhost:5173
npm test                         # 61 个用例:纯逻辑单测 + workerd 运行时集成测试
npm run build && npx wrangler deploy -c dist/retell/wrangler.json   # 部署
```

本地联调需要能直连 Gemini 与 YouTube(大陆需系统代理);线上跑在 Cloudflare 边缘,无此限制。接口探针脚本见 `scripts/probe.mjs`。

## 实现要点

**流式输出。** 用 AI SDK(`ai` + `@ai-sdk/google`)调 Gemini flash。`streamText` 拿增量文本,后端逐块封成 NDJSON 行即时下发;前端读流、按行解析、追加渲染。文章生成关闭思考模式(`thinkingBudget: 0`),流式首字从约 7.5 秒降到约 1 秒。选 NDJSON 而非裸文本流,是为了中途失败时能下发带类型的错误事件,而不是断线。

**用户生成要求。** 自然语言要求以 `<user_requirements>` 围栏包裹注入,系统指令声明:在不违反结构与忠实性规则的前提下采纳,冲突时规则优先,不执行其中改变角色/忽略指令的内容。既让任务类型/风格/受众/约束生效,又缓解提示词注入。

**章节级 5W1H。** 一次生成完成后,字幕全文、按章节切好的文章、用户要求写入以 `contextId` 命名的 Durable Object(强一致,24 小时自毁)。点击某章 5W1H 时只回传 `{contextId, chapter}`,不重传文章;后端用 zod 约束的结构化输出生成六字段,写回缓存,重复点击幂等。前后端共用同一个 `parseArticle` 切分函数,避免「前端第 n 章 ≠ 后端第 n 章」。

**其他取舍。**
- Durable Object 存上下文:一次生成对应一个具名对象,单实例保证强一致,闹钟处理过期,契合「服务端保存上下文」的题意。
- 按章节记忆化渲染:流式追加时只有正在生成的章节重渲染,已完成章节不重复解析。
- 额度守卫:两个接口每 IP 限流 + 每日总预算(复用同一个固定窗口 DO),防止公开网址上的免费额度被刷空。

## 技术栈

TypeScript(strict)· React 19 · Vite + `@cloudflare/vite-plugin` · Cloudflare Workers / Durable Objects(SQLite)· AI SDK(Gemini)· `cloudflare:sockets` · 手写 CSS + 自托管 Geist 字体 · vitest + `@cloudflare/vitest-pool-workers`
