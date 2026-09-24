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
