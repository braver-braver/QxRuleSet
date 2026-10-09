# Quantumult X iOS 维护说明

配置：

```text
quantumultX/qx-ios.conf
```

## 版本基线

当前模板以 App Store 正式版 Quantumult X 1.8.0 为最低行为基线，同时兼容当前 iOS TestFlight 1.8.1 (950)。

1.8.1 (950) 对 DNS 有一个与本模板直接相关的变化：

- 同一个 domain pattern 可以配置多条 DoH / DoQ；
- 这些加密 DNS 会堆叠并并发查询；
- 如果同 pattern 同时存在明文 DNS 与 DoH/DoQ，加密 DNS 优先。

为兼容正式版 1.8.0，**生产模板对每个 domain pattern 只配置一条 DoH**。域名根节点和子域名分别声明（如 `/qq.com/` 与 `/*.qq.com/`），避免漏匹配。1.8.1 (950)+ 的同 pattern 多 DoH/DoQ 并发能力仅作为注释示例保留，不强制用户升级 Beta。

## 为什么不使用 `{# note #}`

1.8.1 (950) 新增了 filter / rewrite 的 searchable note：

```text
{# note #} host-suffix, example.com, proxy
```

当前模板暂不使用。

原因：

- 该语法目前属于 iOS Beta 新能力；
- 较旧的 QX 版本可能把以 `{# ... #}` 开头的规则视为非法；
- 本仓库仍同时维护 macOS 配置。

待正式版和 macOS 侧都支持后，再考虑统一迁移。

## DNS

默认：

```text
https://dns.alidns.com/dns-query
https://doh.pub/dns-query
```

域名级映射主要用于国内服务：

- Tencent / QQ / WeChat
- JD
- BiliBili
- NetEase
- iCloud China
- Alibaba / Taobao / Tmall / Aliyun

不为 OpenAI / Claude / Gemini / GitHub 强制配置境外 DoH。

原因是这些流量通常通过代理策略连接，Quantumult X 的 placeholder / resolve-on-remote 机制使实际代理连接不必依赖本地 DNS 结果；强制直连境外 DoH 反而可能在中国大陆网络环境中引入额外失败点。

## UDP

iPhone 模板默认不配置：

```text
udp_whitelist
udp_drop_list
```

因此不主动阻断高位 UDP、QUIC 或 STUN，避免影响：

- FaceTime
- WebRTC
- Telegram / WhatsApp / Discord Voice
- 游戏
- HTTP/3

如果有明确的企业网络或安全需求，再单独启用严格 UDP 控制。

## MITM / Rewrite

基础分流不需要 MITM。

原有 iPhone 配置中的个人 Rewrite 已按安全边界审计：16 项列于 [iOS Rewrite 清单与渐进恢复](rewrites.md)，**不会直接从用户上传配置迁移任何证书、私钥或第三方增强脚本**。

模板增加了仅用于 `google.cn` / `www.google.cn` 的自维护可选重定向：

```text
quantumultX/rewrites/common/google-redirect.conf
```

当前关闭，HTTPS 启用时需为这两个域名单独配置可信 MITM。

模板中的 HTTPS Rewrite 都默认：

```text
enabled=false
```

### Adblock4limbo Rewrite

作为可选网页/HTTPS Rewrite 层保留。

### iRingo WeatherKit

**最低 iOS 18**（上游要求）。不满足条件时不要启用该资源。

iOS 模板额外提供：

```text
https://github.com/NSRingo/WeatherKit/releases/latest/download/iRingo.WeatherKit.snippet
```

默认关闭。

启用前请先确认 iOS 18 或更新版本。满足版本要求后：

1. 在 Quantumult X 生成/安装 MITM CA；
2. 在 iOS 中信任该 CA；
3. 确保 `weatherkit.apple.com` 可以被 MITM；
4. 再启用 WeatherKit remote resource。

WeatherKit 插件会修改 Apple WeatherKit 请求/响应，并可能根据配置调用第三方天气数据源。使用彩云天气、和风天气等 provider 时，应注意天气查询包含位置相关信息。

## Spotify Rewrite

目前没有把 Spotify Premium Rewrite 放进默认 iOS 模板。

原因：

- 依赖 MITM；
- 对 Spotify 客户端版本和服务端行为敏感；
- 功能属于部分 Premium 模拟，不是稳定的基础网络能力。

如确实需要，建议作为用户自己的 optional rewrite 单独添加，而不是进入仓库默认模板。

## iOS 与 macOS 的差异

iOS：

- 不加载桌面 AI application update rules；
- App 更新由 App Store / Apple 服务处理；
- 提供 WeatherKit 可选 Rewrite；
- 在 1.8.1 (950) TestFlight 可自行实验同 pattern 多 DoH；生产模板默认不启用。

macOS：

- 加载 ChatGPT / Codex / Claude Desktop 更新相关策略；
- 暂不依赖 iOS Beta 专属语法；
- 不默认提供 WeatherKit Rewrite。

## 测试清单

每次修改 iOS 配置后至少确认：

1. 节点订阅可以正常更新；
2. `generate_204` 节点测速正常；
3. 国内站点 DNS 没有明显变慢或解析失败；
4. OpenAI / Claude / Gemini 安全节点任务正常；
5. App Store / Apple / iCloud 正常；
6. 微信、支付宝等国内应用正常；
7. QUIC / VoIP / 视频通话没有被 UDP 设置误伤；
8. 未配置 MITM 时，所有基础分流仍可正常使用。
