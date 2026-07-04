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
