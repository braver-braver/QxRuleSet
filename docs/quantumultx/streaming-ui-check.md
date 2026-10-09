# 服务解锁检测脚本

脚本：[`quantumultX/scripts/streaming-ui-check.js`](../../quantumultX/scripts/streaming-ui-check.js)

## 类型

Quantumult X `event-interaction` 脚本。

入口位于 [`qx-ios.conf`](../../quantumultX/qx-ios.conf) 与 [`qx-macos.conf`](../../quantumultX/qx-macos.conf) 的 `[task_local]`，相关数据源见 [诊断脚本维护](diagnostics.md)。

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

## 结果含义（v3.1.2）

- AI Web 入口页面可达并不意味着账号已登录或模型已解锁。
- API 使用无效示例密钥测试；400/401 仅表示 HTTP 端点响应，并不代表地区或账号支持；429/529 表示限流/繁忙。
- 普通 403 可能来自风控、WAF、安全挑战或地区封锁；需要明确地区错误字段才能较确定地归因。
- Google 香港跳转、简体页面不代表大陆出口；明确 google.cn 跳转也仅视为疑似线索。
- Netflix/YouTube 页面可达不能证明视频可播放或会员权益。

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
3. HTTP 400 / 401 / 403 / 429 / 529 等状态码的语义没有被混淆，且不把未鉴权状态写成“支持”。
4. 上游检测接口变化时，不要简单把所有非 200 都视为地区封锁。
5. 交互输出中的 HTML 需继续转义动态文本。
