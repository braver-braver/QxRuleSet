# 通用服务分流规则集

目录：[`quantumultX/rules/services/`](../../quantumultX/rules/services/)

## 结构

```text
quantumultX/rules/services/
├── apple.list
├── apple-updates.list
├── appletv.list
├── bilibili.list
├── bilibili-video.list
├── bilibili-pcdn.list  # 可选、默认关闭
├── github-pages.list
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
| `github-pages.list` | `GitHub服务` | 独立高优先级 GitHub Pages（仅 `github.io`） |
| `media.list` | `国际媒体` | BBC、Zaobao、Reuters、Bloomberg、FT、NYT、WSJ、Nikkei 等国际新闻媒体 |
| `youtube.list` | `油管服务` | YouTube Web / API / video CDN |
| `bing.list` | `Bing服务` | Bing Search 与相关服务 |
| `microsoft.list` | `微软服务` | Microsoft 365 / Outlook / OneDrive / Azure / Windows |
| `appletv.list` | `AppleTV服务` | Apple TV 视频服务 |
| `apple.list` | `苹果服务` | Apple / iCloud / App Store / Apple 基础服务 |
| `apple-updates.list` | `direct` | Apple 系统更新、恢复与 Rosetta 更新的精确主机 |
| `bilibili.list` | `BiliBili` | Bilibili Web / App / API、通用媒体和历史 Profile 兼容 |
| `bilibili-video.list` | `BiliBili视频` | 可独立选择出口的视频传输主机（默认继承 `BiliBili`） |
| `bilibili-pcdn.list`（可选） | `reject` | **默认关闭**，仅在确认特定 PCDN 主机异常后用于 A/B 排查 |
| `wechat.list` | `direct` | WeChat / Weixin / 微信支付及兼容 IP |

这些 ruleset 由 `qx-macos.conf` 的 `[filter_remote]` 引用，并使用 `force-policy` 绑定到对应策略。

## Apple 系统更新

`apple-updates.list` 在 iOS/macOS 模板的 `[filter_remote]` 中最先加载，使用 `force-policy=direct`。这样手动将“苹果服务”切到代理地区时，系统更新仍保持直连；Apple TV 继续使用 `AppleTV服务`，iCloud 和 App Store 继续使用 `苹果服务`，不会因本资源被强制直连。

主机范围来自 [Apple 官方网络要求的 Software updates 表](https://support.apple.com/en-us/101555)，只使用精确 `HOST`，不将整个 `apple.com`、`cdn-apple.com` 或共享 CDN 强制直连。该表说明主机用途；直连是本仓库的路由选择，不是 Apple 对所有网络的统一要求，也不保证 CDN 下载速度。

2026-10-29 核对后，规则覆盖官方表中 20 个已明确标注为系统更新目录、附加组件更新、恢复、安装或下载用途的主机。`gdmf-ados.apple.com`、`gsra.apple.com` 用于附加组件更新；`wkms-public.apple.com`、`fcs-keys-pub-prod.cdn-apple.com` 用于为连接的设备安装系统。

`xp.apple.com` 虽列在 Apple 的 Software updates 表内，但该表未注明具体用途；[macOS 更新日志分析](https://eclecticlight.co/2026/03/04/how-macos-26-tahoe-updates-2-finite-state-machines/)显示它用于提交更新进度事件。为避免将尚未证实为更新/恢复传输所必需的上报流量一律强制直连，暂不加入例外列表；它仍按 `苹果服务` 既有策略路由。离线测试显式覆盖这项排除。

已有私人 Profile 不会自动获得模板新增的资源引用。增量迁移时，将新模板中 `apple-updates.list` 的完整引用行加到现有 `[filter_remote]` 顶部并刷新该资源。若有个人 `[filter_local]` 主机覆盖，也应检查其实际优先级；本规则不能覆盖全局代理模式或上游路由器的再次分流。

本机验收应查看 QX 请求日志中的实际命中规则、`direct` 策略、连接地址，并同时观察系统下载字节数。CI 只验证规则范围和资源先后顺序。若所在网络必须经代理访问更新服务，可禁用此资源，让请求重新由“苹果服务”策略处理。

## 私人节点 DNS 维护

节点域名专用 DNS 仍由私人 Profile 管理，不把机场域名、端点或订阅写入模板。域名绑定的 DoH 保留每个端点独立一行、每行重复域名匹配项的写法。当前使用环境反馈：合并到同一行无效，因此不将默认 DoH 的逗号分隔示例套用于节点域名专用 DNS。[QX 官方示例](https://github.com/crossutility/Quantumult-X/blob/master/sample.conf) 分别展示了默认多 DoH 和单个域名绑定 DoH，并未给出域名绑定多个端点合并后的示例。

检查端点必须发送有效 DNS 查询并校验响应；`HEAD /dns-query` 返回 405 只说明 HTTP 服务可达。若某端点持续 TLS 握手失败，应先确认其他端点能解析实际节点域名，再移除失效端点。保留普通域名的默认 DNS 设置；节点 DNS 不应扩展成全局解析器。

## Bilibili 视频卡顿排查（2026-11-07）

视频 CDN 不是仅靠增加 `bilivideo.com` / `bilivideo.cn` 就能修复的：它们已由原有 `bilibili.list` 覆盖。播放器的实际传输主机可能来自商业镜像、BCache 或 PCDN；连接速度与地区、ISP、DNS 结果、所选出口以及具体视频都有关系。参考 [PCDN/CDN 分型和排查](https://linux.do/t/topic/642419) 以及 [PCDN 拦截导致 TV 播放失败的反馈](https://github.com/privacy-protection-tools/anti-AD/issues/1121)。这些是社区现场报告，不能证明某一用户的具体卡顿根因。

**默认行为保持不变**：iOS/macOS 仍使用 `BiliBili` 选择网页、API 与地域版权相关服务；新增 `static=BiliBili视频, BiliBili, direct, ...` 的默认第一候选是已有 `BiliBili`，因此仍继承用户此前对该组的直连或代理选择。仅当明确手动切换 `BiliBili视频` 时才单独调整视频 CDN 的出口，不会同时把网页/API 改到另一地区。

`bilibili-video.list` **仅对已经在旧 `bilibili.list` 中归类的视频主机提供独立出口**：`bilivideo.cn` / `bilivideo.com` 和精确 `upos-hz-mirrorakam.akamaized.net`。其他国际版/港澳台镜像及第三方 `v1d.szbdyd.com` 不加入默认视频资源，避免未经验证就改变原有分流；后者只作为可选 PCDN 拦截目标。它通过 `force-policy=BiliBili视频, inserted-resource=true` 加载，在普通本地 `geoip, cn, direct` 之前按主机匹配，避免改变视频策略组后又被本地 GeoIP 直连覆盖。没有接管整个 `akamaized.net` / `bilibilivideo.com` / `szbdyd.com`，也没有维护 IP 段或改动全局 DNS。

`bilibili-pcdn.list` 采用 `force-policy=reject, inserted-resource=true`，但在**两个模板中都为 `enabled=false`**。仅在 QX 请求记录明确显示 `mcdn.bilivideo.cn`、`mcdn.bilivideo.com` 或 `v1d.szbdyd.com` 的具体节点缓冲异常时，才可以短暂开启此资源做同一视频、同一清晰度的对照实验。社区已有启用类似黑名单后 Bilibili TV / 直播无法正常播放的反馈；若出现重试、播放失败或直播故障，立即关闭。不要阻断全体 `biliapi.net` 或以共享 CDN 关键词批量 `reject`。播放器若走 `IP:Port` 的 PCDN，仅凭域名规则无法识别。

**现有私人 Profile 的增量迁移**：先手动增加新 `BiliBili视频` 策略组，再从最新版 iOS/macOS 模板复制两条 `[filter_remote]` 引用（PCDN 资源保持关闭），刷新对应远端资源并检查规则命中。切勿只导入新 ruleset 却没有定义 `BiliBili视频` 策略组。仓库不会自动修改私人订阅、节点凭据或个人 Profile。

**实测步骤**：在 QX 的请求记录中记录视频和音频分片真正的 `Host`、命中策略、最终连接方式、失败重试与端口；播放器「视频统计信息」可辅助识别 DASH 视频/音频 CDN。保持相同视频与画质，依次比较 `BiliBili视频=BiliBili`、`direct` 和一个已确认可达的香港/台湾节点。若依旧卡顿，需要进一步检查运营商路径、具体 CDN 或浏览器解码与缓冲，不应宣称规则已经解决播放问题。离线 CI 仅验证配置结构和命中范围，不代表真实带宽或 QX 真机效果。

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

### GitHub Pages 路由优先级（2026-11-04）

iOS 和 macOS 模板在 `[filter_remote]` 的第一条资源加载 `github-pages.list`，并指定 `force-policy=GitHub服务, inserted-resource=true`。它仅包含 `HOST-SUFFIX,github.io`，在 Quantumult X 中插入到普通 `[filter_local]` 规则之前，避免解析异常时本地 `geoip, cn, direct` 抢先选路；其他 GitHub 域名仍由现有 `github.list` 处理。原 `github.list` 的 `github.io` 规则保留，用于兼容尚未迁移的个人 Profile。

这是对**规则匹配优先级**的防护，并不是 DNS 污染、地区节点故障、运营商路由不稳或 Pages 网站本身配置错误的充分修复。不要为 Pages 增加固定 IP、宽泛的 CDN 通配符，或无证据地替换全局 DoH。

旧个人 Profile 需要手动在 `[filter_remote]` 首位加入模板中的 `GitHub Pages优先` 资源，然后刷新该远端资源。实际验收请打开具体的 `user.github.io` 页面，在 Quantumult X 请求日志确认命中 `GitHub服务`，并临时选用一个明确可达的固定代理节点与默认自动选择组做 A/B 对比。离线测试仅检查规则范围、模板引用和优先级声明，不能替代真机或节点测试。若页面仍加载不全，检查它是否使用独立 CDN 或自定义域名，而不是把整段云服务地址纳入 GitHub 规则。

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
