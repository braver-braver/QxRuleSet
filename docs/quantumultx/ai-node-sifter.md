# AI 安全节点筛选

脚本：[`quantumultX/scripts/ai-node-sifter.js`](../../quantumultX/scripts/ai-node-sifter.js)

## 目标

普通的 `available` 或 `url-latency-benchmark` 只能判断节点是否可联网、延迟是否合适，不能判断该出口是否真正被 OpenAI、Claude 或 Gemini 接受。

AI 安全节点脚本提供服务级验证。**iOS 仍使用 `provider=all` 的联合 AI 策略及自动复核；macOS 自 2026.11.17.2 起使用三个独立手动固定出口，不再自动调用本脚本。**

> 该机制用于降低误走不受支持出口的风险，不构成任何账号安全或封禁保证。

## 策略结构

**iOS：**

```text
openai.list ─┐
claude.list ─┼─→ 海外AI → 🛡 AI联合安全节点 → 同一节点三重验证
gemini.list ─┘
```

**macOS（独立手动固定出口，不触发筛选脚本）：**

```text
openai.list → OpenAi服务 → 🤖 OpenAI安全节点
claude.list → ClaudeAi服务 → 🧠 Claude安全节点
gemini.list → Gemini → ✨ Gemini安全节点
```

iOS 联合安全池与 macOS 三个独立候选池均允许 US / GB / JP / SG / TW；iOS 仍需对同一节点完成三家服务验证。macOS 仅人工选择节点，不保证候选节点已通过服务验证。`AI应用更新` 保留独立策略。

筛选脚本当前候选名称只预筛（与 macOS 手选候选池不同）：

- US / United States
- GB / UK / United Kingdom
- JP / Japan
- SG / Singapore
- TW / Taiwan / Taipei / 台湾 / 台灣 / 臺灣

节点名称只用于第一层缩小候选范围；即使节点名包含台湾，也必须由三家服务分别确认实际 TW 出口和可达性；iOS 的最终判定依赖实际出口地区和服务端响应。macOS 用户需自行确认所选节点是否适用于对应服务。

## 首次使用

安全节点池把 `reject` 放在第一位。首次导入配置后，AI 请求默认 fail-closed，不会回退到普通的全球代理或直连。

添加并更新节点订阅后：

- **iOS：**手动运行一次 `海外 AI 联合安全节点`，等待同一候选节点通过全部三项检测；少一项或任何响应不确定都不会自动选中。
- **macOS：**在 OpenAI、Claude、Gemini 三个策略中分别人工选择一个真实节点。四个诊断工具只查询，不负责设置节点；无定时或网络自动 AI 任务。

iOS 只有联合安全池验证通过才会恢复流量；macOS 则需要手动选中真实节点，不能保持 `reject`。

## 判定流程

### 1. 获取候选节点

使用 Quantumult X：

```text
get_customized_policy
```

读取安全节点池的 `candidates`。

### 2. 获取真实出口地区

每个候选节点都使用：

```javascript
opts: { policy: node }
```

实际发起请求。

脚本不会仅相信节点名字，而会检查实际出口地区。

当前仅接受：

```text
US / GB / JP / SG / TW
```

名称和真实出口不一致时，以真实出口为准。

### 3. 服务级验证

OpenAI：

```text
chatgpt.com
api.openai.com/v1/models
```

Claude：

```text
claude.ai
api.anthropic.com/v1/models
```

Gemini：

```text
gemini.google.com/app
generativelanguage.googleapis.com
```

API 请求使用明显无效的测试 key，不需要真实 API Key。Claude 使用只读 GET `/v1/models`，不再发送模拟 Messages 请求。HTTP 401 `authentication_error` 或 400 `invalid_request_error` 必须为结构化 Anthropic 错误才作为网络可达证据；它**不能证明**账号订阅、模型调用权限或 Anthropic 地区准入。

### 4. PASS / FAIL / UNCERTAIN

`PASS`：

- Claude Web 返回正常的 HTTP 200 页面，或跳转到已知的 Claude/Anthropic 登录入口（陌生第三方跳转不得标为 PASS）；
- API 返回能够识别为 Anthropic 的结构化 invalid key / invalid request 错误且没有明确地区限制（仅代表网络可达）。

`FAIL`：

- 明确 unsupported country / unsupported region；
- HTTP 451；
- 实际出口地区不在允许集合。

`UNCERTAIN`：

- Cloudflare / bot challenge（包括没有 `cf-mitigated` 响应头，但 HTML 标题明确为验证页的 HTTP 200）；
- Claude Web 重定向到不可信站点、挑战路径，或返回 HTTP 204 等非网页响应；
- Claude 网页 HTTP 200 中仅作为静态 JavaScript 出现的地区限制 / Cloudflare 文案（不视为实际封锁）；
- 无法确认语义的普通 400 / 401 / 403；
- 429 限流和 529 负载繁忙（不会标为 PASS）；
- DNS / timeout / 网络失败；
- 无法识别出口地区；
- 未知 HTTP 状态。

只有 `PASS` 可以成为自动选择目标。

`UNCERTAIN` 与 `FAIL` 在自动选路中都不会被采用。

## Sticky Routing

每次任务首先只验证当前节点。

如果当前节点仍然 `PASS`：

```text
保持当前节点
不扫描其他节点
不因为更低延迟而切换
```

每次 `PASS` 还会通过 `$prefs` 记录：

```text
last-known-good node
region
verifiedAt
```

该状态在 Quantumult X 运行期间持久保存，供仍使用筛选脚本的旧版配置或 iOS 逻辑参考。新版 macOS 模板不依赖该状态。

## 两种恢复模式

### strict / fail-closed

未传入 `mode=sticky` 时保留原来的严格行为：

1. 当前节点是 `PASS`：保持；
2. 当前节点是 `FAIL` 或 `UNCERTAIN`：先切 `reject`；
3. 扫描其余候选；
4. 只选择 `PASS`；
5. 没有 `PASS`：继续 `reject`。

该模式仍适用于希望“任何无法确认都立即阻断”的场景。

### sticky recovery（兼容历史私人配置；新版 macOS 模板不调用）

旧版 macOS / 私人配置可能传入 `provider=all&mode=sticky`：

```text
当前联合节点 PASS
  → 保持原节点，更新 last-known-good

当前联合节点 UNCERTAIN
  → 只有曾通过三重验证的同一节点才暂时保留并通知
  → 从未验证的手选节点先切 reject，继续查找其他候选

当前联合节点明确 FAIL（例如任一家地区拒绝）
  → 先切 reject，检测其他候选
  → 有三重 PASS：恢复可用的联合节点
  → 无三重 PASS：保持 reject
```

如果配置重载后当前为 `reject`，可以使用 `last-known-good` 复测；**只有新的联合检测为 PASS 才恢复**，UNCERTAIN 与 FAIL 均不能从 reject 恢复该出口。无候选节点时同样保持 reject。

脚本仍兼容 `provider=openai/claude/gemini` 和 `provider=all` 的历史配置；新版 macOS 模板均不调用这些入口。

## iOS/macOS 联合节点的证据门槛

`provider=all` 总是对**同一个节点标签（QX `opts.policy`）**并行执行三组服务端检查，并对出口地区做交叉验证：

- OpenAI 只接受结构化 `invalid_api_key` 401，或包含有效模型 ID 的模型列表响应；普通 401、429、HTML 错页不是通过。
- Claude 保留既有严格的网页、HTTP 重定向和结构化 Anthropic API 错误验证；地区不支持直接拒绝。
- Gemini 只接受 Google 官方形状的 `API_KEY_INVALID` / `google.rpc.ErrorInfo`，或真实模型列表；不能把所有 400/401 直接当作接口可达。对登录跳转，还需校验 HTTPS 和第一方域名。
- 任一服务明确失败则拒绝该共同节点；任一结果不确定、出口地区不一致、云端挑战或超时都不予选中。仅三者均通过且地区一致，才写入联合安全策略。

这是**网络出口可达性的保守检测**，不包含真实 API Key，不能证明账号登录、订阅等级、模型额度或未来不会触发风控。联合验证消耗的 HTTP 请求较多，因此 iOS 安排一个手动任务及每天两次复核；macOS 不安排 AI 筛选任务。单轮最多扫描 **9 个新候选节点**（当前与历史节点按原有逻辑单独复测），避免大量机场节点造成请求风暴；超出数量的节点本轮不扫描，也不会自动认定为安全。

## 自动任务

### 低频定时复核

iOS 模板每天在 03:15 和 15:15 执行一次 `provider=all` 联合复核（严格 fail-closed）。

macOS 模板不再定时复核 AI 节点。

### 网络变化复核

新版 macOS 模板不再注册 `event-network` AI 复核任务。以下联合脚本的恢复逻辑仅供使用它的旧配置或其他终端参考。

## Quantumult X API

脚本依赖：

- `get_customized_policy`
- `get_policy_state`
- `url_latency_benchmark`
- `set_policy_state`

以及：

```javascript
$task.fetch({
  ...,
  opts: { policy: node }
})
```

这些能力允许脚本绕过当前 service policy，直接指定待测节点发起请求。

## 与 streaming-ui-check.js 的区别

`streaming-ui-check.js`：

- 面向人工诊断；
- 检测用户当前选择的节点/策略；
- 展示 AI + Google + 流媒体状态；
- 不负责自动更换 AI 节点。

`ai-node-sifter.js`：

- 面向 AI 策略管理；
- 遍历安全池候选节点；
- 严格判断 PASS / FAIL / UNCERTAIN；
- 自动 fail-closed；
- 必要时选择并写回安全节点。

两个脚本职责保持独立。
