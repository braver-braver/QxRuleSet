# AI 安全节点筛选

脚本：[`quantumultX/scripts/ai-node-sifter.js`](../../quantumultX/scripts/ai-node-sifter.js)

## 目标

普通的 `available` 或 `url-latency-benchmark` 只能判断节点是否可联网、延迟是否合适，不能判断该出口是否真正被 OpenAI、Claude 或 Gemini 接受。

AI 安全节点层额外执行服务级验证。脚本现在支持两种运行模式：iOS/默认仍可使用严格 fail-closed；macOS 模板使用 sticky recovery，优先保持和恢复上一次验证通过的节点，避免睡眠/开盖后的瞬时网络错误把策略误打回 `reject`。

> 该机制用于降低误走不受支持出口的风险，不构成任何账号安全或封禁保证。

## 策略结构

```text
OpenAi服务
└── 🤖 OpenAI安全节点

ClaudeAi服务
└── 🧠 Claude安全节点

Gemini
└── ✨ Gemini安全节点
```

三个内部安全节点池都是 `static` policy，并通过 `server-tag-regex` 从订阅中自动吸收候选节点。

当前候选名称只预筛：

- US / United States
- GB / UK / United Kingdom
- JP / Japan
- SG / Singapore

节点名称只用于第一层缩小候选范围；最终判定依赖实际出口地区和服务端响应。

## 首次使用

安全节点池把 `reject` 放在第一位。

因此第一次导入配置后，OpenAI / Claude / Gemini 默认是 fail-closed 状态。

添加并更新节点订阅后，至少手动运行一次：

- `OpenAI 安全节点`
- `Claude 安全节点`
- `Gemini 安全节点`

脚本选出验证通过的节点之后，对应 AI 流量才会恢复。

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
US / GB / JP / SG
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
api.anthropic.com/v1/messages
```

Gemini：

```text
gemini.google.com/app
generativelanguage.googleapis.com
```

API 请求使用明显无效的测试 key，只根据响应状态判断服务端是否可达，不需要真实 API Key。

### 4. PASS / FAIL / UNCERTAIN

`PASS`：

- Web 正常可达；
- API 返回能证明端点已经到达服务端的状态，例如 invalid key / invalid request / rate limit。

`FAIL`：

- 明确 unsupported country / unsupported region；
- HTTP 451；
- 实际出口地区不在允许集合。

`UNCERTAIN`：

- Cloudflare / bot challenge；
- 无法确认语义的普通 403；
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

该状态在 Quantumult X 运行期间持久保存，可用于 macOS 睡眠/开盖或配置状态重载后的自动恢复。

## 两种恢复模式

### strict / fail-closed

未传入 `mode=sticky` 时保留原来的严格行为：

1. 当前节点是 `PASS`：保持；
2. 当前节点是 `FAIL` 或 `UNCERTAIN`：先切 `reject`；
3. 扫描其余候选；
4. 只选择 `PASS`；
5. 没有 `PASS`：继续 `reject`。

该模式仍适用于希望“任何无法确认都立即阻断”的场景。

### sticky recovery（macOS 默认）

macOS 模板给脚本传入：

```text
mode=sticky
```

行为改为：

```text
当前 PASS
  → 保持当前节点
  → 更新 last-known-good

当前 UNCERTAIN
  → 不切 reject
  → 保留当前节点
  → 弹出通知

当前明确 FAIL
  → 扫描其他候选
  → 有 PASS：切换到验证通过节点
  → 无 PASS：保留原节点并通知
```

`UNCERTAIN` 包括刚恢复网络时常见的：

- DNS 尚未稳定；
- timeout；
- Cloudflare challenge；
- 临时 403；
- 暂时无法识别出口地区。

因此这类瞬时状态不会再破坏原来的策略选择。

如果 Quantumult X 在重新联网/策略重载后已经把安全组落到 `reject`：

1. 读取持久化的 `last-known-good`；
2. 直接指定该节点做服务级复测；
3. `PASS`：自动恢复它；
4. `UNCERTAIN`：仍恢复上次节点，但通知“本次无法重新确认”；
5. 明确 `FAIL`：不恢复已知失败出口，扫描其他候选；
6. 仍没有可用候选：保持当前 `reject` 并通知。

这样既避免把一次开盖重连误当成地区失效，也不会在已经明确判定为不受支持地区时盲目恢复。

## 自动任务

### 低频定时复核

macOS 模板每天执行两次：

```text
03:15 / 15:15  OpenAI
03:25 / 15:25  Claude
03:35 / 15:35  Gemini
```

均使用 `mode=sticky`。

### 网络变化复核

Quantumult X 官方支持：

```text
event-network
```

网络变化时会触发任务。macOS 模板利用它处理开盖、Wi-Fi 重连和网络切换：

```text
网络变化
  ↓
OpenAI 等待 4 秒
Claude 等待 7 秒
Gemini 等待 10 秒
  ↓
复测当前/last-known-good
  ↓
PASS → 静默保持/恢复
UNCERTAIN → 保留并通知
FAIL → 扫描替代节点
```

三个 provider 错峰执行，避免刚恢复网络时同时发起大量探测。

脚本以**最后一次**网络变化为准：每次事件都会更新同一 provider 的事件令牌；旧任务在等待结束后发现令牌已过期就退出。只有最新事件对应的任务会在 4 / 7 / 10 秒稳定期结束后复核，且过期任务不得修改策略或发送通知。

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
