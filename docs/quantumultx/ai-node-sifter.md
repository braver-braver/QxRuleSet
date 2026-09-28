# AI 安全节点筛选

脚本：[`quantumultX/scripts/ai-node-sifter.js`](../../quantumultX/scripts/ai-node-sifter.js)

## 目标

普通的 `available` 或 `url-latency-benchmark` 只能判断节点是否可联网、延迟是否合适，不能判断该出口是否真正被 OpenAI、Claude 或 Gemini 接受。

AI 安全节点层额外执行服务级验证，只允许明确验证通过的节点承载对应 AI 流量。

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

这是默认的稳定性策略。

## 当前节点失效

当前节点变成 `FAIL` 或 `UNCERTAIN` 时：

1. 立即把安全节点池切换到 `reject`；
2. 再扫描其余候选节点；
3. 只保留 `PASS` 节点；
4. 使用 `url_latency_benchmark` 测试这些安全节点；
5. 如果原出口地区仍有其他安全节点，优先保持同地区；
6. 否则从全部安全节点中按延迟选择；
7. 使用 `set_policy_state` 切换策略。

这意味着扫描期间普通 AI 流量也不会继续通过已经失效的出口。

## 无安全节点

如果没有任何候选节点明确通过验证：

```text
安全节点池 → reject
```

不会 fallback 到：

- `proxy`
- `全球策略`
- 随机节点
- 普通 latency policy

这属于有意的 fail-closed 行为。

## 自动任务

模板默认每天执行两次低频复核：

```text
03:15 / 15:15  OpenAI
03:25 / 15:25  Claude
03:35 / 15:35  Gemini
```

任务使用设备本地时区。

由于采用 sticky routing，正常情况下自动任务只验证当前节点，不会全量扫描，也不会频繁切换出口。

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
