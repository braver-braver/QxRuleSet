# 服务解锁检测脚本

脚本：[`quantumultX/scripts/streaming-ui-check.js`](../../quantumultX/scripts/streaming-ui-check.js)

## 类型

Quantumult X `event-interaction` 脚本。

入口配置位于：

[`quantumultX/qx-macos.conf`](../../quantumultX/qx-macos.conf)

的 `[task_local]`。

## 当前检测

### AI

- Claude Web
- Claude API
- ChatGPT Web
- OpenAI API
- Gemini Web
- Gemini API

### 网络区域

- Google 网络区域异常 / “送中”检测

### 流媒体

- Netflix
- YouTube Premium
- Disney+

## 上游维护状态（2026-10-11）

最初参考的 [KOP-XIAO/QuantumultX `streaming-ui-check.js`](https://github.com/KOP-XIAO/QuantumultX/blob/master/Scripts/streaming-ui-check.js) 于 2023-06-30 后暂无新的文件提交。目前的 **v3.x** 系列是本仓库独立维护版，与上游不再保持逐行同步；不能直接将上游旧版覆盖现有脚本，否则会丢失 AI 及错误分类修复。解析器的 2026-10-09 上游更新与本脚本是两项不同资源，详见 [外部依赖策略](dependencies.md)。

## 实现约定

脚本依赖 Quantumult X 提供的运行环境，包括：

- `$environment`
- `$task.fetch`
- `$configuration.sendMessage`
- `$done`

脚本使用明显无效的测试 API Key；仅当 HTTP 状态及服务端结构化错误**一致**时才将结果标记为「接口可达（未认证）」，不应替换为真实账号密钥。该结果不证明模型调用权限、账户订阅或地区许可。

## 修改检查

修改脚本时至少确认：

1. JavaScript 可以正常解析。
2. 所有异步分支最终都能进入 `$done`。
3. HTTP 401 / 403 / 429 等状态码的语义没有被混淆。
4. 上游检测接口变化时，不要简单把所有非 200 都视为地区封锁。
5. 交互输出中的 HTML 需继续转义动态文本。


## 2026-10-09 误判修复（v3.2.0）

本脚本是**无登录凭据的出口诊断工具**，不能证明账号具备订阅权益或已成功完成模型调用、视频播放。新版优先减少假阳性：

- **AI API**：无效密钥导致的 HTTP 400/401 仅报告「接口可达（未认证）」。先检查错误正文中的明确地区封锁信息，尤其 Gemini API 在 HTTP 400 下的 `FAILED_PRECONDITION` / `User location is not supported`；429/529 显示限流或繁忙，不报告可用。
- **AI Web**：HTTP 200 和普通登录重定向仅能证明页面可达，不能证明登录后模型可用。403 人机挑战与明确地区限制分别报告。
- **Google 送中**：不再以 `google.com.hk`、`hkredirect` 或简体 HTML 语言作为大陆网络的确定证据；同意页、验证码、无法解释的跳转保留「无法判定」。
- **Netflix / YouTube**：单一标题页面 HTTP 200/404 与 Premium 落地页不能证明完整解锁、仅自制剧或订阅可购买。结果改为「样本页可达／不可用」或「页面可达，订阅资格未证实」。
- **Disney+**：旧设备注册接口可能变化。HTTP 500 等非 200 响应不再冒充地区封锁，明确 `inSupportedLocation` 只描述设备接口返回的地区状态，不宣称实际播放成功。

### 回归测试

```bash
node --check quantumultX/scripts/streaming-ui-check.js
node --test quantumultX/scripts/tests/streaming-ui-check.test.mjs
```

测试使用模拟的 `$task.fetch` 和 Quantumult X 环境，不请求真实代理节点。修改后仍需要在 iOS/macOS Quantumult X 中分别实测典型支持/受限节点，并确认策略组 `$environment.params` 的实际出站路径。

**注意**：现有 Disney+ 检测仍依赖上游设备注册接口，若接口彻底停用，需要重新研究正式接入流程；不要从单次接口失败推断所在地区无法观看。


## 2026-10-14 QX 无结果问题修复（v3.3.0）

### 原因与处理

旧版在 `Promise.all` 中等待 **10 项全部检测**，并在它们之后再 `await $configuration.sendMessage`。
网络超时每项可重复两次，Claude/ChatGPT 的地区探测与 Web 请求还会串行；这可能导致交互任务在 QX 运行窗口内不返回 UI。**已静态定位高风险路径，但具体设备异常仍需 QX 运行日志确认。**

- **8.5 秒全局报告期限**：一旦到期，调用一次 `$done({title, htmlMessage})`，已完成结果照常显示，尚未完成的项目明确标记「未完成（总时限）」，不假装解锁成功或区域不支持。
- **单项请求限制 2.0–6.2 秒、默认不重试**：不会因慢节点反复叠加 10 秒 HTTP 超时；保留 `$task.fetch` 的 `opts.policy` 以指定出口。内部计时器参数不会传入 QX 请求对象。
- **Claude/ChatGPT 的地区探测与网页并行**，地区不明时显示「❓」而非猜测国家。
- **策略链路查询最多等待 0.75 秒**。即使 `$configuration.sendMessage` 永远不返回、同步抛错或 API 不可用，最终报告仍可显示。
- 空的 `$environment.params` 不会传入 `policy: undefined`，并以「当前分流（未指定策略）」标注，避免把默认路由当成指定节点结果。
- **幂等完成**：避免超时以后网络请求迟到触发二次 `$done`。

### 回归与排查

```bash
node --check quantumultX/scripts/streaming-ui-check.js
node --test quantumultX/scripts/tests/streaming-ui-check.test.mjs
```

新增模拟 QX 测试覆盖：全部 HTTP 请求永久 pending、部分请求已成功而其余阻塞、策略 API 永久 pending、同步网络错误、晚到响应、空策略参数和 QX 非标准超时字段检查。模拟验证不等于 iOS / macOS 真机验证。

**设备端验证步骤**：

1. QX Tunnel 运行时更新「服务解锁查询」远程脚本缓存；确认加载的是仓库 `main` 的 **v3.3.0**，而非原缓存 v3.2.0。
2. 从**具体节点**（而非不明确的策略父组）启动交互；正常节点应快速得到完整结果，异常节点应在约 8.5 秒内得到部分结果。
3. 如结果仍为空，查看 QX 脚本运行日志是代码加载失败、脚本超时还是 `$done` 错误；同时检查节点分流与 DNS。可脱敏分享错误类型/时间，**不要分享订阅链接、MITM 证书或真实 Token**。
4. 对比 iOS 与 macOS 的 QX 版本和实际导入 Profile；GitHub 更新不会自动更新已缓存的脚本。



## 2026-10-19 脚本维护（v3.4.0）

### 无网络引擎自检

需要确认「解锁查询完全没有弹出窗口」究竟是脚本未加载还是网络检测失败时，可在 QX 的 `[task_local]` 临时加入以下 **第二条** 任务（保留原本的正常解锁查询）：

```ini
event-interaction https://raw.githubusercontent.com/braver-braver/QxRuleSet/refs/heads/main/quantumultX/scripts/streaming-ui-check.js#mode=selftest, tag=服务解锁脚本自检, img-url=checkmark.seal.system, enabled=true
```

它使用 QX 官方支持的远程脚本 `#` 参数机制和 `$environment.variables`（新版本）、`$environment.sourcePath`（旧版本）读取 `mode=selftest`；**不会发起网络请求、不读取订阅凭据、不调用策略组配置 API**。正确运行时会立即显示「✅ QX 脚本引擎执行成功」和当前策略标签。这**不代表节点可以访问任何服务**。

- **自检没有弹窗**：先核对 QX Tunnel、任务启用状态、远程脚本 URL 是否更新成功、脚本缓存和 QX 运行日志；不要据此判断节点被平台封禁。
- **自检成功但正常查询失败**：重点检查当前节点实际出口、任务日志中的请求错误和 QX 超时。
- 自检完毕后，**禁用或移除**临时 `#mode=selftest` 任务，正常查询仍使用没有 `#mode` 的 URL。
- 在 `main` 合并更新后需要 QX 主动刷新远程脚本缓存；仅 GitHub 合并不会刷新设备端缓存。

### 检测准确度与稳健性

- **Disney+**：移除历史设备注册 GraphQL 调用及其内置静态客户端 Token。改用匿名 `https://www.disneyplus.com/` Web 探测，仅报告「网页可达 / 网页重定向 / HTTP 限制 / 网络错误」，**不能证明所在地区已经解锁，更不能证明会员播放正常**。由于过去的 Token / API 可能失效，这一修改有意降低对地区可用性的结论强度。
- **Google 送中**：HTTP 200/204 仅能表明本次没有观察到中国站跳转，不能断言出口地区一定不在中国大陆。
- **Claude / ChatGPT 出口归属**：Trace 失败后共用一次备用 `ipapi.co` 查询，减少重复网络请求。备用 IP API 与服务平台自己的地区判定不一定一致。
- **异常 HTTP 响应**：`$task.fetch` 返回 `null`、缺少状态码或非法状态码时，明确显示「响应格式异常」，不再让 Promise 链路意外悬空。
- **Cloudflare 人机验证**：优先识别 `cf-mitigated: challenge` 响应头；普通 HTTP 200 页面即使内含 `cf-chl-` 等字符串，也不能据此直接判断正在被验证拦截。
- **展示兼容性**：输出使用标准 `<br/>` HTML 换行；节点标签仍通过 HTML 转义。
- **全局超时**：保持 v3.3.0 的 8.5 秒统一看门狗及「仅调用一次 `$done()`」语义。

所有新增验证使用模拟 QX 环境（**无法模拟真实 QX UI / 节点出口 / 账号权限**）。CI 可以证明脚本语法和模拟分支行为正确，不代表脚本在特定 iPhone 或 Mac 上已经完成真实解锁检查。

## 2026-10-29 Claude API / Web 检测收敛（v3.4.2）

- 无效 Key 探测仅在结构化 Anthropic `authentication_error`（HTTP 401）或 `invalid_request_error`（HTTP 400）时显示「接口可达（未认证）」；泛化的 400/401 可能来自代理或网关，改为「状态不明」。
- 明确地区拒绝（包括 HTTP 451、响应体中的区域限制）优先于认证状态；429/529 继续标为「限流/繁忙」，不报告完整解锁。
- [第三方 Claude IP 检测](https://ip.net.coffee/claude/) 仅能提供出口 IP、浏览器环境及网络质量线索，不能替代通过 `$task.fetch` 和明确 `opts.policy` 对目标节点的检查；第三方信任分不等于 Anthropic 官方账号判定。
- Claude Web 请求设为 `redirection=false`：仅允许明确属于 Claude/Anthropic 的登录跳转；未知重定向、Cloudflare challenge 跳转以及空页面 HTTP 204 不认定为网页正常。HTTP 200 若 HTML 标题明确显示人机验证，也不再被误判为可访问的 Claude 页面。
- 回归测试采用脱敏 QX 模拟响应；未验证 Quantumult X 真机、真实代理节点或登录账号模型调用。

## 2026-11-11 认证响应与重定向核验（v3.5.0）

本轮针对无效 Key 检测中出现的**状态码误判**和网页跳转误判做保守修复，不新增登录、真实 API Key、视频播放或账户查询。

- **OpenAI API**：仅将 HTTP 401 且带有结构化 `error.code=invalid_api_key` 的响应报告为「接口可达（未认证）」。代理/网关生成的普通 401 改为「状态不明」。HTTP 451 单独报告「地区/法律限制」，401 中明确的地区限制不再被认证分支覆盖。
- **Gemini API（GenerateContent/Generative Language）**：对 HTTP 400/401 要求 Google `error.details[]` 中包含 `google.rpc.ErrorInfo`、`reason=API_KEY_INVALID`、`domain=googleapis.com` 及 `metadata.service=generativelanguage.googleapis.com`，且 HTTP 状态和 `error.status` 相符。泛用 400、缺字段、错误的服务域名保持「状态不明」。仅真实 `models` JSON 响应才能把 HTTP 200 标为「接口响应成功（解锁未证实）」。`FAILED_PRECONDITION` 等明确地区拒绝优先处理。
- **ChatGPT Web / Gemini Web**：拒绝把陌生站点的 301/302 等跳转、协议降级、用户信息伪装和空 HTTP 204 页面算作可达；只认可目标服务/明确登录主机的 HTTPS 跳转。Cloudflare 的 `cf-mitigated: challenge` 以及页面实际 `<title>` 为验证标题时标为「验证拦截」，普通页面 JavaScript 内的相关字串不构成证据。
- **Google 送中**：仅在 **HTTP 3xx 真正重定向** 时检查 `Location` URL 的**真实 hostname** 是否为 `google.cn` / `google.com.cn` 或其子域名；HTTP 200/201/204 等携带 `Location` 也不能当作跳转证据，不能仅凭 URL 查询参数出现 `google.cn` 就报告“可能送中”。仍不以简体页面或语言参数推断节点地区。
- **稳定性**：保留 8.5 秒全局看门狗、统一 `$done`、2.0–6.2 秒各项请求上限、无登录探测、selftest 以及部分结果回传机制。

对照资料：[OpenAI API 官方错误码](https://developers.openai.com/api/docs/guides/error-codes)、[Google Gemini GenerateContent API 官方错误格式](https://ai.google.dev/gemini-api/docs/generate-content/api-errors)、[Cloudflare Challenge 响应头](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/detect-response/)。

回归命令：

```bash
node --check quantumultX/scripts/streaming-ui-check.js
node --test quantumultX/scripts/tests/*.test.mjs
```

**限制**：CI 是模拟 Quantumult X `$task.fetch`、策略状态与响应格式的离线测试。它不能替代 iOS/macOS 真机、真实节点出口、账号订阅或实际播放验证。合并后仍需 QX 客户端手动刷新远程脚本缓存。

## 2026-11-12 Claude 地区落地页识别（v3.5.1）

在保留 v3.5.0 的 API 判定和安全跳转验证基础上，补充 Claude 官方不支持地区落地页 `/app-unavailable-in-region` 的识别：仅 HTTP 3xx 指向 Claude/Anthropic 第一方 HTTPS 路径，或真实 HTML `<title>` 为 `App unavailable in region` 才判定「未支持」。不扫描 JavaScript bundle 文案，也不把第三方 URL 查询参数视为地区证据。

同时补充 Anthropic、OpenAI 的明确地区拒绝文本；Claude API 普通 403 仍只标记为「访问受限（地区或代理拦截待查）」。这属于离线响应模拟，不能代表 QX 真机、账号或节点地区许可已验证。
