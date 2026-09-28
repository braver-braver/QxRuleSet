# OpenAI / ChatGPT 分流与更新链路

规则文件：[`quantumultX/rules/ai/openai.list`](../../quantumultX/rules/ai/openai.list)

## 维护策略

OpenAI / ChatGPT 的关键域名由本仓库维护，不再完全依赖第三方远程规则集。

`qx-macos.conf` 通过：

```text
force-policy=OpenAi服务
```

加载 `rules/ai/openai.list`。

规则基线来自 OpenAI 官方网络建议，并保留少量旧规则用于兼容历史客户端或第三方依赖。

## 核心域名

当前至少覆盖：

- `*.chatgpt.com`
- `*.openai.com`
- `*.oaistatic.com`
- `*.oaiusercontent.com`
- `*.oaistatsig.com`
- `*.openaimerge.com`
- `*.workos.com`
- `*.workoscdn.com`

以及 ChatGPT 使用的部分 challenge、support、telemetry 域名。

## ChatGPT / Codex Desktop 更新

当前 macOS ChatGPT / Codex Desktop 的更新链路至少包含两部分。

### Sparkle appcast 与安装包

域名：

```text
persistent.oaistatic.com
```

当前应用可使用类似：

```text
https://persistent.oaistatic.com/codex-app-prod/appcast.xml
https://persistent.oaistatic.com/codex-app-prod/appcast-x64.xml
```

获取 macOS 更新信息，安装包也由同一域名分发。

该域名维护在 [`rules/ai/updates.list`](../../quantumultX/rules/ai/updates.list) 中，并通过 `force-policy=AI应用更新` 优先绑定到更新策略。

### ChatGPT backend appcast

当前桌面端还会访问：

```text
https://chatgpt.com/backend-api/wham/app/appcast
```

该请求与普通 ChatGPT 请求共用 `chatgpt.com` 域名。

Quantumult X 常规 filter 规则按主机名、IP 等维度分流，不适合只针对这个 URL path 指定不同策略。因此：

- `persistent.oaistatic.com` → `AI应用更新`
- `chatgpt.com` → `OpenAi服务`

不要为了单独处理 appcast 而把整个 `chatgpt.com` 改到 `AI应用更新`，否则 ChatGPT 主业务流量也会一起切换策略。

## WebSocket

ChatGPT 与 Codex 的部分实时功能依赖 HTTPS 之外的 WebSocket：

- `ws.chatgpt.com:443`
- `chatgpt.com:443` 的 WebSocket Upgrade

这些域名已经被 `HOST-SUFFIX,chatgpt.com` 覆盖。

如果出现“页面能打开，但回答流式输出卡住、Codex 断连、通知不刷新”等现象，应同时检查代理节点和中间网络是否允许 WebSocket 长连接。

## 更新规则时的原则

1. 优先参考 OpenAI 官方网络建议。
2. 再核对 OpenAI 官方客户端或 `openai/codex` 当前实现。
3. 避免使用过宽的 `HOST-KEYWORD,openai` 作为唯一兜底。
4. 共享基础设施域名（例如 Cloudflare、Stripe、Sentry）尽量使用精确 `HOST`，避免影响其他应用。
5. 更新下载域名与 OpenAI 主业务域名分开维护。
