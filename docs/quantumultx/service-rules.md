# 通用服务分流规则集

目录：[`quantumultX/rules/services/`](../../quantumultX/rules/services/)

## 结构

```text
quantumultX/rules/services/
├── github.list
├── google.list
├── social.list
└── spotify.list
```

## 职责

| 文件 | 策略 | 用途 |
| --- | --- | --- |
| `spotify.list` | `Spotify` | Spotify Web / App / 音频与静态资源 CDN |
| `social.list` | `社交媒体` | X、Reddit、Meta、Discord、Telegram、Bluesky |
| `google.list` | `谷歌服务` | Google Search、Gmail、Drive、API、静态资源与下载基础设施 |
| `github.list` | `GitHub服务` | GitHub Web/API/Git、静态资源、release、GHCR、Copilot 及 npm 相关域名 |

这些 ruleset 由 `qx-macos.conf` 的 `[filter_remote]` 引用，并使用 `force-policy` 绑定到对应策略。

## Spotify

Spotify 规则采用域名优先：

- `spotify.com`
- `pscdn.co`
- `scdn.co`
- `spotifycdn.com`
- Spotify 使用的 Akamai / Fastly CDN

不再依赖固定 IP，也避免使用过宽的 `HOST-KEYWORD,spotify`。

## 社交媒体

当前覆盖：

- X / Twitter
- Reddit
- Instagram / Facebook / Threads / Messenger / WhatsApp
- Discord
- Telegram
- Bluesky

Telegram 仍保留已知 MTProto IPv4 网段，以覆盖直接 IP 连接。

## Google

Google ruleset 是“通用 Google 服务”，不承担：

- Gemini 专属流量
- YouTube 专属流量

优先级设计：

```text
Gemini
  ↓
YouTube
  ↓
Google 通用服务
```

这样 `gemini.google.com` / Gemini API 会先匹配 AI ruleset，而 YouTube 的专属域名和 API 也可以优先进入 `油管服务`。

Google ruleset 不维护 Google IP 段，避免共享 Google 网络地址把 YouTube、Gemini 或其他 Google 产品错误吸入同一策略。

## GitHub

GitHub ruleset 以域名为主，覆盖：

- `github.com`
- `*.githubusercontent.com`
- `*.githubassets.com`
- `github.io`
- `github.dev`
- `ghcr.io`
- GitHub Copilot
- GitHub status / blog / community
- npm

不再维护 `20.205.243.*` 等固定 GitHub IP。GitHub 官方也建议网络控制优先使用 DNS / domain 方式，因为服务 IP 地址会随基础设施调整。

## 维护原则

1. 专属服务域名优先于共享基础设施。
2. 能使用 `HOST-SUFFIX` 时，不使用过宽 `HOST-KEYWORD`。
3. CDN 使用明确 host / suffix，不轻易把整个 Akamai、Fastly、Cloudflare 域名纳入单一服务。
4. Google / GitHub 等大型平台优先使用域名规则，不维护大范围固定 IP。
5. 新增规则前检查是否会覆盖 AI、YouTube、Apple、Microsoft 等已有策略。
6. 每个 ruleset 独立维护版本号和更新时间。
