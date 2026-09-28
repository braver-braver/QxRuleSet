# AI 分流规则集

目录：[`quantumultX/rules/ai/`](../../quantumultX/rules/ai/)

## 结构

```text
quantumultX/rules/ai/
├── claude.list
├── gemini.list
├── openai.list
└── updates.list
```

## 职责

| 文件 | 策略 | 用途 |
| --- | --- | --- |
| `openai.list` | `OpenAi服务` | ChatGPT / OpenAI API / Codex 及相关依赖 |
| `claude.list` | `ClaudeAi服务` | Claude / Anthropic / Claude MCP 相关域名 |
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

## 当前来源

- OpenAI：官方网络建议 + 当前客户端实现
- Claude：Anthropic 官方网络信息 + 上游兼容规则
- Gemini：Google 官方 Gemini / Gemini API 端点 + 已验证的 Gemini 专属规则

第三方 ruleset 可以作为发现新域名的参考，但不再作为这三类 AI 服务的直接运行时依赖。
