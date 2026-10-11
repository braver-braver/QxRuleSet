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

最初参考的 [KOP-XIAO/QuantumultX `streaming-ui-check.js`](https://github.com/KOP-XIAO/QuantumultX/blob/master/Scripts/streaming-ui-check.js) 于 2023-06-30 后暂无新的文件提交。当前 **v3.2.0** 是本仓库独立维护版，与上游不再保持逐行同步；不能直接将上游旧版覆盖现有脚本，否则会丢失 AI 及错误分类修复。解析器的 2026-10-09 上游更新与本脚本是两项不同资源，详见 [外部依赖策略](dependencies.md)。

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
