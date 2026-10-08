# 通用服务分流规则集

目录：[`quantumultX/rules/services/`](../../quantumultX/rules/services/)

## 结构

```text
quantumultX/rules/services/
├── apple.list
├── appletv.list
├── bilibili.list
├── bing.list
├── github.list
├── google.list
├── media.list
├── microsoft.list
├── social.list
├── spotify.list
├── wechat.list
└── youtube.list
```

## 职责

| 文件 | 策略 | 用途 |
| --- | --- | --- |
| `spotify.list` | `Spotify` | Spotify Web / App / 音频与静态资源 CDN |
| `social.list` | `社交媒体` | X、Reddit、Meta、Discord、Telegram、Bluesky |
| `google.list` | `谷歌服务` | Google Search、Gmail、Drive、API、静态资源与下载基础设施 |
| `github.list` | `GitHub服务` | GitHub Web/API/Git、静态资源、release、GHCR、Copilot 及 npm 相关域名 |
| `media.list` | `国际媒体` | BBC、Zaobao、Reuters、Bloomberg、FT、NYT、WSJ、Nikkei 等国际新闻媒体 |
| `youtube.list` | `油管服务` | YouTube Web / API / video CDN |
| `bing.list` | `Bing服务` | Bing Search 与相关服务 |
| `microsoft.list` | `微软服务` | Microsoft 365 / Outlook / OneDrive / Azure / Windows |
| `appletv.list` | `AppleTV服务` | Apple TV 视频服务 |
| `apple.list` | `苹果服务` | Apple / iCloud / App Store / Apple 基础服务 |
| `bilibili.list` | `BiliBili` | Bilibili Web / App / 视频 CDN |
| `wechat.list` | `direct` | WeChat / Weixin / 微信支付及兼容 IP |

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

Google ruleset 额外维护地区 Google Search 域名（例如 `google.co.uk`、`google.co.jp`、`google.de` 等），避免这些请求落到 `final, proxy` 而绕过 `谷歌服务`。

YouTube Data API 的 `youtube.googleapis.com` 明确维护在 `youtube.list`，因此会在通用 `googleapis.com` 规则之前进入 `油管服务`。

Google ruleset 不维护 Google IP 段，避免共享 Google 网络地址把 YouTube、Gemini 或其他 Google 产品错误吸入同一策略。

## 国际媒体

`media.list` 用于把国际新闻媒体从通用 `final, proxy` 中单独分离出来，当前重点覆盖：

- BBC（含常见 BBC iPlayer 专用媒体主机）
- 联合早报 / Zaobao
- Channel NewsAsia / The Straits Times / Business Times Singapore
- Reuters / AP / Bloomberg
- Financial Times / The Economist / The Guardian
- New York Times / Wall Street Journal / CNN
- Nikkei / SCMP
- Al Jazeera / DW / France 24 / RFI

策略组：

```text
国际媒体
├── 🇸🇬 新加坡顺选·健康
├── 🇯🇵 日本顺选·健康
├── 🇬🇧 英国顺选·健康
├── 🇺🇸 美国顺选·健康
├── 🇭🇰 香港顺选·健康
├── 🇨🇳 台湾顺选·健康
├── 对应地区延迟优选
├── proxy
└── direct
```

默认第一项是新加坡健康组，适合亚洲国际媒体与 Zaobao 等站点的常规浏览。

BBC News 普通网页并不要求英国出口；但 BBC iPlayer 等具有地区限制的内容仍需手动选择英国节点。当前没有为媒体服务引入类似 AI 的自动安全节点筛选，因为媒体访问失败通常不涉及账户安全风险，先保持规则简单、可解释。

`media.list` 只维护媒体自身域名和少量明确属于 BBC 的媒体分发主机，不纳入整个 Akamai / Cloudflare / Fastly 等共享 CDN，以避免误抓其他服务。

在 `[filter_remote]` 中，媒体规则放在广告过滤之后，因此已知广告/跟踪域名仍有机会先被广告规则拦截。

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


## WeChat

WeChat / Weixin 由本仓库的 `wechat.list` 维护，并通过 `force-policy=direct` 加载。

域名规则是主要依据；少量单 IP 规则仅为了兼容旧上游列表中的直接 IP 连接场景，并应定期复核。

不再直接引用第三方 WeChat ruleset。
