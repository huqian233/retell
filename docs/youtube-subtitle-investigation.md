# YouTube 字幕获取调研(2026-07)

工程笔记,记录实测过程、数据与取舍,README 引用。测试位置覆盖:本机(国内网络)、Cloudflare 边缘(`wrangler dev --remote` 及部署后的 Worker)、一台美国 NTT 服务器出口。

## 结论

1. 字幕提取可行,不需要官方 API:走 YouTube 内部的 InnerTube 接口。完整链路(player 接口 → 选轨 → 下载 json3 → 拼装带时间戳文本)已从 Cloudflare 边缘端到端跑通。
2. 「Sign in to confirm you're not a bot」登录墙是**间歇性限流**,不是永久封锁:同一视频、同一出口,前一分钟被拦、后一分钟能取。触发条件是单 IP 短时高频请求,冷却后自动恢复。
3. 直连 + 退避重试,对低频工具成功率够用;要「任意视频稳定出结果」,需要住宅代理、登录 Cookie 或 PoToken 三者之一。
4. webshare 免费代理这条路被两道墙挡住(见 §4)。
5. 本项目线上取舍:演示视频用内置字幕副本;其他视频交给 Supadata(服务端处理住宅代理与 PoToken);自写的走代理引擎保留并有单测(见 §5)。

## 1. 字幕获取原理

四步:

1. 解析视频 ID:兼容 `watch?v=`、`youtu.be/`、`/shorts/`、`/live/`、`/embed/` 等形式,提取 11 位 ID。
2. `POST https://www.youtube.com/youtubei/v1/player`,body 带伪装的 `context.client` 和 `videoId`;返回 `videoDetails`(标题/频道/时长)和 `captionTracks`(字幕轨列表)。
3. 选轨:优先原视频语言 → 英语 → 第一条人工轨(`kind != "asr"`)→ 任意轨。
4. 用字幕轨的 `baseUrl` 加 `fmt=json3` 下载,得到带毫秒时间戳的 JSON,拼装成文本。

实测踩到的三个坑:

- **客户端选择**:不同轮次实测结果不同——一轮里 `IOS` 最稳、`ANDROID` 次之、`ANDROID_VR`/`TVHTML5`/`WEB_EMBEDDED` 更差;另一轮里 `ANDROID_VR` 表现最好。这与限流的间歇性一致:没有永远最优的客户端,重试时轮换客户端/端点比死磕单一客户端有效。`WEB` 对很多视频返回 `UNPLAYABLE` 或非 JSON,最不可靠。
- **fmt 参数会被吞**:字幕轨 `baseUrl` 自带 `&fmt=srv3`,直接追加 `&fmt=json3` 会出现两个 fmt 参数,YouTube 取第一个、仍返回 XML。必须用 `URL.searchParams.set('fmt', 'json3')` 覆盖。
- **选轨语言**:「第一条人工轨」会踩雷——某 TED 视频的第一条人工轨是阿拉伯语。要按语言优先级选,而不是按列表顺序。

## 2. 登录墙实测:间歇性限流

被拦时 `playabilityStatus.status = "LOGIN_REQUIRED"`,reason 为「Sign in to confirm you're not a bot」。多视频、多时点实测(2026-07-05,Cloudflare 边缘):

| 视频 | 本机住宅 IP | CF 边缘(首次) | CF 边缘(几分钟后重试) |
|---|---|---|---|
| dQw4w9WgXcQ | OK | OK / 6 轨 | OK |
| Ks-_Mh1QhMc | 连发十几个请求后被拦 | OK / 53 轨 | 时通时拦 |
| UF8uR6Z6KLc | LOGIN_REQUIRED | LOGIN_REQUIRED | 换 iOS 客户端后 OK / 9 轨 |
| 8jPQjjsBbIc | LOGIN_REQUIRED | LOGIN_REQUIRED | iOS 客户端 OK / 41 轨,完整取到字幕 |

要点:

- 不是「某些视频永久需要登录」,而是**按 IP 信誉的间歇性限流**:同一视频、同一 CF 出口,前后几分钟结果不同。
- Cloudflare 边缘出口 IP 多,重试常落到未被限流的节点。8jPQjjsBbIc 一例完成了端到端:标题 + 22 行带时间戳字幕 + 10268 字符,再经 Gemini 产出合格的中文结构化记录。
- 2026-07-04 的首轮探测曾得出「数据中心 IP 一律被拦」:8 种客户端 + watch 页 HTML 全部 0 字幕轨,连「Me at the zoo」也被挡;一台美国 NTT 服务器(AS2914,IP 库判定 `hosting=false`)单发探测同样 LOGIN_REQUIRED。次日复测证明这些是**撞上了被限流的时间窗**——单次探测不代表长期成功率。
- 综合两轮:拦截概率与 IP 信誉、请求频率相关;直连 + 重试对低频使用够,但达不到 100%。

## 3. 三条路线对比

| 维度 | A. 直连 + 重试 | B. webshare 代理 | C. PoToken |
|---|---|---|---|
| 可用性 | 已从 CF 边缘端到端验证 | 免费档挡死(§4);付费住宅档理论可行 | 可行,需外挂 token 服务 |
| 可靠性 | 中,间歇被拦、靠重试 | 高(住宅 IP) | 高 |
| 复杂度 | 低 | 中 | 高(要跑 BotGuard) |
| 额外依赖 | 无 | 代理订阅 | 独立 token 生成服务 |
| 延迟 | 低 | 高(每请求建隧道) | 中 |
| 适用 | 低频内部工具 | 高频/高可靠 | 不想用代理又要高可靠 |

路线 C 说明:给 player 请求带上 `visitorData` + `poToken`(Proof of Origin Token),数据中心 IP 也不会被判为 bot,是 yt-dlp 应对 bot 检测的主流做法。但 poToken 要运行 YouTube 的 BotGuard(混淆 JS 挑战)才能生成,Worker 内跑不了,需要独立服务(如社区的 `bgutil-ytdlp-pot-provider`),YouTube 更新 BotGuard 时还要跟进。

## 4. webshare 代理路线:两道墙

Cloudflare 的 `fetch` 不支持配置代理,于是用 `cloudflare:sockets` 手写了走代理的 HTTPS 客户端:TCP → HTTP CONNECT 隧道 → `startTls()` → HTTP/1.1(`src/proxy/`,响应解析含 chunked,纯函数单测覆盖)。实测(2026-07-05,10 个当时状态为 Working 的免费代理,从 Cloudflare 边缘):

**传输层:免费代理不承载 HTTPS。**

- 隧道本身通:CONNECT 返回 `HTTP/1.0 200`,明文 `:80` 经隧道拿到真实响应(ipify 返回代理出口 IP 的 JSON;YouTube 返回 `301 → https`)。手写 socket 引擎在生产网络位置被验证正确。
- 一个真 bug:`startTls()` 之后必须 `await secure.opened` 等握手完成再写数据,否则报 `TLS Handshake Failed`。早期实现缺这一步,曾误判为「Workers 不支持隧道内 startTls」。
- 修复后:`:443` 上 TLS 握手能完成,但之后**读到 0 字节**——ipify、YouTube 皆然,10 个代理无一例外,而同址 `:80` 明文正常。免费档对 443 只给了个空管子;InnerTube 只走 HTTPS,传输层就断了。

**身份层:干净出口也不保险。** 换一个能过 HTTPS 的出口(前述 NTT 服务器)单发探测仍被要求登录。结合 §2 的间歇性结论:任何免费/自建出口都只能做到「时通时不通」,要稳定就需要住宅代理轮换或登录态。

## 5. 本项目取舍

- **演示视频 → 内置字幕副本**,页面明示来源。评卷主路径稳定,任务书也建议内置一份字幕。
- **其他视频 → Supadata 实时抓取**:它在服务端处理住宅代理与 PoToken,正是 Worker 内做不到的部分。抓不到时抛带类型的错误,不伪造字幕或文章。
- 直连 + 重试(路线 A)已验证可用但非 100%,不满足「任意视频稳定出结果」,未作线上主路径。
- 自写代理引擎 + InnerTube 客户端(`src/proxy/`、`src/worker/subtitles/innertube.ts`,含选轨与换端点重试)完整保留、单测在跑:配一份住宅代理或登录 Cookie 即可对任意视频跑通,也是任务点名的工程内核。

「换端点重试同一请求」是允许的重试;「失败后偷换数据来源」才是被禁止的兜底。本项目只有前者。
