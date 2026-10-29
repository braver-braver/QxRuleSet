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

脚本中的测试 API Key 仅用于根据 HTTP 状态判断服务端点是否可达，不应替换为真实账号密钥。

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


## 2026-10-29 脚本维护（v3.4.1）

### Claude 网页：识别「所在地区不支持」落地页

Claude 在不支持的地区访问 `claude.ai` 时，会 302 跳转到 `https://www.anthropic.com/app-unavailable-in-region`（继续跳到 `claude.com` 同路径），落地页标题为 `App unavailable in region | Claude by Anthropic`。QX 默认跟随重定向，旧版脚本只匹配 `country not supported` 一类标题，因此会把这个 200 落地页报告为「网页可达」。

- 新增 `isClaudeRegionUnavailable()`：同时检查 `Location` 头含 `app-unavailable-in-region`（未跟随重定向时），以及落地页 `<title>` 含 `app unavailable in region`（已跟随时）。命中后报告「未支持」。
- **只检查标题和 Location，不扫描整页文案**：SPA 脚本中可能含有同样的字符串，沿用「普通文案不单独作为判据」的约定。回归测试覆盖了这一点。

### API 明确地区措辞

`hasExplicitRegionMessage()` 增加两条明确措辞，仅在响应正文明确写出时才报告「地区受限」：

- Anthropic：`Access to Anthropic models is not allowed from unsupported countries, regions, or territories.`
- OpenAI：`Country, region, or territory not supported`

### Claude API 403 措辞

Claude Code 官方排障文档对 `403` 的解释是「代理/网络过滤拦截主机，或所在地区不受支持」；`403 Request not allowed` 也可能来自订阅/角色权限问题。无可证明地区的响应正文时，Claude API 的 403 现显示「访问受限 (403，地区或代理拦截待查)」，**不再暗示是地区封锁**，也不把它升级为「地区受限」。

### 未改动与证据边界

- **Gemini Web、ChatGPT Web 的不支持地区页面**：未找到可靠的、可复核的页面特征，本次没有新增启发式判断，保持现有「页面可达（解锁未证实）」语义。
- 以上 Claude 网页行为来自 Anthropic 官方 `app-unavailable-in-region` 页面内容及公开 issue 中的用户报告（**未在受限地区的真实 QX 出口上复现**）。新增测试使用模拟响应，不代表真机验证；上线后建议用一个已知受限出口与一个已知支持出口各跑一次。
- 与 v3.4.0 相同：更新 `main` 后，QX 设备上的远程脚本缓存需手动刷新。

### 回归测试

```bash
node --check quantumultX/scripts/streaming-ui-check.js
node --test quantumultX/scripts/tests/*.test.mjs
```

新增 5 项（共 26 项）：落地页（已跟随）/ 302 Location（未跟随）/ 脚本内同样文案不误报 / Anthropic 与 OpenAI 明确措辞 / 裸 403 不当作地区封锁。其中前 3 类在 v3.4.0 上会失败。
