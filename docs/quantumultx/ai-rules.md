# AI 分流规则集

目录：[`quantumultX/rules/ai/`](../../quantumultX/rules/ai/)

## 结构

```text
quantumultX/rules/ai/
├── claude.list
├── claude-telemetry.list  # 可选，默认不加载
├── gemini.list
├── openai.list
└── updates.list
```

## 职责

| 文件 | 策略 | 用途 |
| --- | --- | --- |
| `openai.list` | `OpenAi服务` | ChatGPT / OpenAI API / Codex 及相关依赖 |
| `claude.list` | `ClaudeAi服务` | Claude / Anthropic / Claude MCP 相关域名 |
| `claude-telemetry.list`（可选） | `ClaudeAi服务` | 两个 Datadog 精确遥测端点，默认不加载 |
| `gemini.list` | `Gemini` | Gemini Web / Google AI Studio / Gemini API |
| `updates.list` | `AI应用更新` | AI 桌面客户端更新检查、appcast、安装包 CDN |

这些 ruleset 由 `qx-macos.conf` 的 `[filter_remote]` 引用，并使用 `force-policy` 绑定到对应策略组。

## 优先级

`updates.list` 放在 provider ruleset 之前。

原因是部分更新域名同时属于 provider 的主域名体系，例如：

```text
persistent.oaistatic.com
```

既可以被 `*.oaistatic.com` 捕获，也应优先走 `AI应用更新`。

## 维护原则

1. AI 专属域名放入对应 provider ruleset。
2. 桌面客户端更新域名放入 `updates.list`。
3. 共享基础设施尽量不要用过宽规则强行归到某一家 AI。
4. 优先使用 `HOST` / `HOST-SUFFIX`，谨慎使用 `HOST-KEYWORD`。
5. Google 的共享域名应尽可能留给 `谷歌服务`，Gemini ruleset 只捕获 Gemini 专属端点。
6. 每个文件独立维护版本号和更新时间。
7. 新增规则前检查是否会和其他 AI ruleset 或通用 Google/Microsoft 规则发生覆盖。

## Claude Code 分流范围与可选遥测（2026-10-29）

依据 [Anthropic 官方网络要求](https://code.claude.com/docs/en/network-config#network-access-requirements) 与 [Net.Coffee 候选清单](https://ip.net.coffee/claude/site.html) 核对：

- `HOST-SUFFIX,anthropic.com` 已覆盖 `api.anthropic.com`、`mcp-proxy.anthropic.com` 与 `assets-proxy.anthropic.com`；`HOST-SUFFIX,claude.com` 已覆盖 OAuth 所需的 `platform.claude.com` 和组织 SSO 所需的 `sso.claude.com`。
- `claude.ai` 已覆盖 `downloads.claude.ai`，`claudeusercontent.com` 已覆盖 Chrome 桥接及 Artifact 内容，`claudemcpcontent.com` 已覆盖 MCP widget 子域名。无需堆叠重复规则。
- `github.com`、`raw.githubusercontent.com`、`registry.npmjs.org`、`storage.googleapis.com` 是共享依赖，继续交由通用 GitHub、Google 或其他既有策略管理。
- `sentry.io`、`statsigapi.net`、`intercom.io`、`cdn.usefathom.com` 与关键词 `datadog/sentry/sift` 都可能覆盖其他应用，**不加入默认 Claude 分流**。
- Anthropic 官方记录 Claude Code 的可选遥测使用 `http-intake.logs.us5.datadoghq.com` 和 `browser-intake-us5-datadoghq.com`。有需要时才手动加载 `claude-telemetry.list`；即使是精确 HOST，这两个共享收集器也可能承载其他软件的请求，启用前应了解这一副作用。
- 不照搬参考站点的 NTP、IP-ASN、IPv4/IPv6 整段代理规则，也不为 Claude 全局禁用 IPv6。NTP 报文不包含系统时区；IP 评分仅是第三方辅助线索，不是 Anthropic 的账号许可证明。

**可选遥测规则**：如决定使用，请在自己的 `[filter_remote]` 中添加以下资源，并放在相关通用分流规则之前。正式 iOS/macOS 模板不会自动加载：

```ini
https://raw.githubusercontent.com/braver-braver/QxRuleSet/refs/heads/main/quantumultX/rules/ai/claude-telemetry.list, tag=Claude可选遥测, force-policy=ClaudeAi服务, update-interval=86400, opt-parser=false, enabled=true
```

如果不需要遥测，不添加该资源即可；Claude Code 还可以使用 `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` 关闭这两种可选上报。离线测试仅保证规则范围及模板引用位置，不代表真实客户端、出口地址或账号可用性。

## 当前来源

- OpenAI：官方网络建议 + 当前客户端实现
- Claude：Anthropic 官方网络信息 + 上游兼容规则
- Gemini：Google 官方 Gemini / Gemini API 端点 + 已验证的 Gemini 专属规则

第三方 ruleset 可以作为发现新域名的参考，但不再作为这三类 AI 服务的直接运行时依赖。


## AI 安全节点

AI ruleset 只负责“哪些域名属于哪个 provider”。

实际节点选择由三层安全 policy 承担：

```text
OpenAi服务 → 🤖 OpenAI安全节点
ClaudeAi服务 → 🧠 Claude安全节点
Gemini → ✨ Gemini安全节点
```

这些策略由 [AI 安全节点筛选](ai-node-sifter.md) 自动维护。

安全池首次导入默认选择 `reject`。更新节点订阅后需要至少手动执行一次对应的安全节点任务。
