# 外部依赖策略

本仓库不追求“零外部 URL”，而是区分 **路由语义** 与 **工具/数据源**。

核心原则：

> 会决定某个服务走哪个策略的规则，由本仓库维护；变化快、专业性强、与核心分流无关的工具或数据源继续跟随上游。

## 本仓库维护

以下内容直接决定 Quantumult X 的路由行为，因此在仓库内维护：

- AI rulesets
  - OpenAI / ChatGPT / Codex
  - Claude / Anthropic
  - Gemini
  - macOS AI 桌面应用更新
- Service rulesets
  - Apple / Apple TV
  - BiliBili
  - Bing / Microsoft
  - GitHub
  - Google / YouTube
  - Spotify
  - Social media
  - WeChat / Weixin
- `cn.list`
- `rules/corrections/direct.list`
- `streaming-ui-check.js`

这些资源的变化需要经过本仓库审查，避免上游规则突然改变策略优先级。

## 继续跟随上游

### 订阅资源解析器

```text
KOP-XIAO/QuantumultX/Scripts/resource-parser.js
```

保留上游的原因：

- 机场订阅格式会持续变化；
- parser 需要跟进 Clash / Surge / V2Ray / SS / VMess / VLESS 等格式；
- 本仓库没有必要 fork 一套解析器长期追版本。

如果订阅本身已经是 Quantumult X 原生格式，可以在 `[server_remote]` 中使用 `opt-parser=false`，此时对 parser 的依赖会进一步降低。

### Adblock4limbo

保留：

```text
Adblock4limbo.list
```

作为专业广告过滤数据源。

其 Rewrite：

```text
Adblock4limbo.conf
```

在模板中默认 `enabled=false`。

因此基础分流配置不需要 MITM。只有用户主动开启 Rewrite 后，才需要配置并信任 MITM 证书。

### Rewrite 分层维护

- 自维护小型且可独立验证的规则：`quantumultX/rewrites/common/google-redirect.conf`。
- 特殊 WeatherKit 功能由 NSRingo 上游维护；Adblock4limbo 大型网页广告脚本不在本仓库 Fork。
- 来自个人手机的第三方 Rewrite 只记录启用状态与可验证的维护信息，**不复制 P12/口令/订阅，也不直接导入默认配置**。
- 16 项资产与逐项回归方法见 [iOS Rewrite 清单](rewrites.md)。个人增强必须显式选择，不应影响核心路由。

### iRingo WeatherKit

iOS 模板保留：

```text
NSRingo/WeatherKit/releases/latest/download/iRingo.WeatherKit.snippet
```

作为可选 WeatherKit 增强资源，并默认 `enabled=false`。

继续跟随上游的原因：

- Apple WeatherKit API / 数据结构会变化；
- 该项目需要同步适配 iOS 天气 App；
- 脚本 bundle 和第三方天气 provider 逻辑更新频率高，不适合在本仓库 fork。

它属于 iOS 18+ optional rewrite，不影响基础分流。启用时需要 MITM，并应评估第三方天气 provider 的位置数据隐私边界。

### 诊断工具

`[task_local]` 中的以下资源属于人工触发的诊断工具：

- 地理位置检测
- 节点纯净度查询
- 策略流量查询

它们不可用时，不影响：

- 节点订阅
- DNS
- filter routing
- policy groups
- 基础代理能力

因此继续跟随各自上游。

### 图标

policy / profile 的图标 URL 只影响 UI 展示，不参与路由决策。

图标资源失效时不应被视为配置故障。

## DNS 上游

当前模板使用：

```text
https://dns.alidns.com/dns-query
https://doh.pub/dns-query
```

DNS 上游属于运行基础设施，而不是 ruleset 依赖。

修改 DNS 时应单独评估：

- 国内解析质量
- DoH 可达性
- ECS / CDN 结果
- Quantumult X 的 resolve-on-remote 行为

## 已移除的外部运行时规则

以下类别已不再直接使用第三方 ruleset：

- OpenAI
- Claude
- Gemini
- Spotify
- Google
- GitHub
- Microsoft
- Bing
- YouTube
- Apple
- Apple TV
- BiliBili
- WeChat
- 通用分流修正包

其中原 `ShuntCorrection.list` 被替换为保守的：

```text
quantumultX/rules/corrections/direct.list
```

主要原因是上游纠错包包含大量 Apple 强制直连规则、共享 SaaS/CDN 以及特定影视站规则，会与本仓库的 Apple、广告过滤和通用服务策略发生职责冲突。

## 判断新依赖是否应该本地化

满足以下任一条件时，优先本地维护：

1. 它直接决定服务进入哪个 policy。
2. 它的规则顺序会影响已有 service ruleset。
3. 上游变化可能让核心应用突然改走 direct / proxy / reject。
4. 用户需要对其行为做长期稳定假设。

以下情况通常继续跟随上游：

1. 订阅格式解析器。
2. 大规模广告/隐私规则库。
3. 人工触发的诊断脚本。
4. 图标、展示资源。
5. 需要高频跟踪生态变化、但不改变核心策略边界的数据源。
