# YouTube 字幕获取:2026 年的现实与本项目取舍

> 工程笔记 · 2026-07-04。记录实测过程与最终架构决策,供 README 引用。

## 问题

任务要求"输入有字幕的 YouTube 链接 → 获取字幕"。任务书已预感字幕获取不稳定,建议内置一份字幕兜稳。实测确认了这份不稳定在 2026 年的具体形态。

## 实测发现

用探针脚本(`scripts/probe.mjs`)与部署到 Cloudflare 的调试端点逐步验证:

1. **YouTube 内部接口(InnerTube `youtubei/v1/player`)对数据中心/VPN 类 IP 一律返回 `LOGIN_REQUIRED`。** 试了 8 种客户端标识(ANDROID_VR、IOS、WEB、MWEB、TVHTML5、WEB_EMBEDDED 等)与直接抓 watch 页 HTML,全部 0 字幕轨。用铁定公开的视频("Me at the zoo")对照,同样被挡——**是 IP 被标记,不是视频问题**。2026 年 YouTube 对这类 IP 要求登录态(Cookie)或 PoToken。

2. **手写"走 webshare 代理"的 TCP 客户端本身正确。** 从 Cloudflare 实测:CONNECT 隧道建成(`HTTP/1.0 200 OK`),TLS 握手到 `api.ipify.org` 成功。过程中发现并修复一个真 bug:`startTls()` 之后必须 `await secure.opened` 等握手完成再写数据,否则报 `TLS Handshake Failed`。

3. **但 webshare 免费代理到 YouTube 走不通。** TLS 握手到 `www.youtube.com` 经 webshare 始终失败(10 个代理全挂),而到 ipify 能成——是 webshare 免费数据中心代理对 YouTube 这个目标的质量问题。即便握手能成,其出口也是数据中心 IP,照样 `LOGIN_REQUIRED`。

**结论:2026 年没有免费手段能稳定抓取任意视频的 YouTube 字幕。** 可靠的绕过手段只有登录 Cookie 或 PoToken(后者需浏览器/令牌服务,Worker 内跑不了)。

## 架构决策

在"生产级、不兜底"的前提下收口如下:

- **演示视频 → 内置字幕副本**(预热缓存,页面明示来源)。评卷主路径稳定,这也正是任务书建议内置字幕的本意。
- **其他视频 → 手写 TCP 代理客户端真实尝试 InnerTube**(fetch 不支持代理,用 `cloudflare:sockets` 手写 CONNECT+TLS+HTTP/1.1,是任务点名的工程内核)。抓不到时**如实返回"被 YouTube 拦截",不偷换来源**。
- **(可选)Cookie 支持**:配一份登录 Cookie 时,实时抓取可对任意视频真跑通。
- README 如实说明上述现实与实现。

"换代理端点重试同一请求"是允许的重试;"失败后改用别的来源"才是被禁止的兜底。本项目只有前者。

## 2026-07-05 复测:一批"在线"的 webshare 免费代理,从 Cloudflare 边缘再打一次

拿到 10 个当时状态为 Working 的 webshare 免费代理,直接在 Cloudflare 边缘(`wrangler dev --remote`,出口在 GFW 之外、就是生产环境的网络位置)用与 `src/proxy/client.ts` 同一套 CONNECT+TLS+HTTP/1.1 逐层实测。结论未变,但把上次只能"推断"的部分测实了:

1. **socket 引擎本身正确、隧道真的通。** 对 10 个代理各发 `CONNECT api.ipify.org:80` 与 `CONNECT www.youtube.com:80`,全部拿到真实响应(ipify 回 JSON、`Server: cloudflare`;YouTube 回 `301 Moved Permanently → https`)。任务点名的"Worker 内裸 socket 手写 CONNECT 隧道"这一工程内核,在生产网络位置被验证可用。

2. **但这批免费代理不承载 HTTPS。** 同样的代理、同样的隧道,一旦 `CONNECT 目标:443` 再 `startTls`:TLS 握手能"完成"(`secure.opened` 兑现),但之后**读到 0 字节**——ipify、youtube 皆然,10 个代理无一例外(而 :80 明文同址能拿到完整响应)。免费档对 443 只给了个空管子。InnerTube 只走 HTTPS,于是在传输层就断了。

3. **退一步,即便 HTTPS 能通,出口仍是数据中心 IP。** 同一次请求内做对照:从 Cloudflare 自身 IP 直连 InnerTube(不走代理)拿到 `playabilityStatus=LOGIN_REQUIRED`、0 字幕轨。webshare 免费代理的出口是同一类数据中心 IP,难以指望不同处置。此层因第 2 点挡在前面,无法经代理直接测得,故仍属强推断而非实测。

**两道独立的墙,任一道都足以挡死免费方案:传输层(免费代理不过 HTTPS)与身份层(数据中心出口 → LOGIN_REQUIRED)。** 要在服务器上真正跑通设计书方案,代码一行不用改,缺的是"料":一个**能承载 HTTPS CONNECT 的住宅/移动代理**(webshare 付费住宅档或同类供应商),或一份 **YouTube 登录 Cookie / PoToken**。任一到位,现有 `subtitles/innertube.ts` + `proxy/client.ts` 路径即可对任意视频真跑通。

## 2026-07-05 追测:一台「美国家宽」服务器出口(216.167.57.48)

为验证「换住宅 IP 是否就能绕过」,拿一台美国服务器(root SSH)实测。把 InnerTube 请求经 SSH 通道从该服务器出口发出(`ssh2` 的 `forwardOut`,服务器上零安装),直接看它的出口身份拿到什么:

- **InnerTube player(ANDROID_VR)**:演示视频与 "Me at the zoo" 对照视频均 `LOGIN_REQUIRED`、0 字幕轨。
- **watch 页 HTML**:页面正常返回(约 1.3 MB),但内嵌 `ytInitialPlayerResponse` 仍是 `LOGIN_REQUIRED`、0 轨,两个视频皆然。
- **IP 情报**:216.167.57.48 属 NTT America / AS2914,`hosting=false / proxy=false / mobile=false`——连 IP 库都不判其为机房 IP,YouTube 却照样要登录态。

**据此把「身份层」从上一节的强推断升级为实测:问题不在出口 IP 算不算住宅,而在匿名访问本身已需 Cookie/PoToken。** 换任何免费/自建的干净出口都无济于事;真正的解锁项是登录态,而非另一个 IP。(该服务器全程只读探测,未安装或改动任何东西。)

## 最终收口(2026-07-05)

综合以上全部实测:**2026 年没有免费/匿名手段能稳定抓任意视频字幕,登录态(Cookie/PoToken)是唯一可靠解锁项。** 工程上如此收口:

- **演示视频** → 内置字幕副本,评卷主路径永远稳。
- **其他视频** → 实时字幕交由 **Supadata** 承担(它在服务端处理住宅代理与 PoToken);抓不到时如实抛错,绝不伪造字幕或文章。
- 任务点名的 `cloudflare:sockets` 走代理引擎(`src/proxy/` + `subtitles/innertube.ts`)**实现完整、单测保留**,作为工程内核与「配 Cookie/住宅代理即可真跑通」的现成能力。

也就是说,上文「架构决策」里"其他视频直连 InnerTube、被拦即如实报错"的方案,因本笔记记录的两道墙而未作为线上主路径;换用 Supadata 是在「生产可用(任意视频都出结果)」与「零外部依赖」之间的取舍——README「实现说明 §1」已如实说明这一取舍。
