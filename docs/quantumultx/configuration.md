# Quantumult X 配置

配置模板：

- macOS：[`quantumultX/qx-macos.conf`](../../quantumultX/qx-macos.conf)
- iPhone / iOS：[`quantumultX/qx-ios.conf`](../../quantumultX/qx-ios.conf)

实际使用方法见 [从模板到可用配置](setup.md)。

## 用途

该文件是 Quantumult X for macOS 的主配置入口，当前包含：

- `[general]`：基础网络行为
- `[dns]`：DNS / DoH
- `[task_local]`：交互脚本
- `[policy]`：静态策略组、延迟策略组和可用性策略组
- `[filter_local]`：本地显式分流
- `[filter_remote]`：远程规则资源
- `[rewrite_local]` / `[rewrite_remote]`
- `[server_local]` / `[server_remote]`
- `[mitm]`

## 当前维护重点

### 策略组

策略组主要覆盖：

- AI：Gemini、OpenAI、Claude
- Google / Microsoft / GitHub / Apple
- YouTube / Spotify / BiliBili
- 国际媒体：BBC、Zaobao、Reuters、Bloomberg、FT、NYT、WSJ、Nikkei 等
- 社交媒体
- 香港、台湾、日本、新加坡、韩国、美国、英国节点

地区策略同时使用：

- `url-latency-benchmark`
- `available`

### 本地分流

本地显式规则放在 `[filter_local]`，并位于：

```text
geoip, cn, direct
final, proxy
```

之前。

明确需要代理、且不能被直连规则覆盖的域名，应放在此处。

### 远程分流

远程规则放在 `[filter_remote]`。

OpenAI、Claude、Gemini 及 AI 桌面客户端更新规则由本仓库的 `quantumultX/rules/ai/` 独立维护，主配置只负责引用和绑定策略。详见 [AI 分流规则集](ai-rules.md)。

Spotify、社交媒体、Google、GitHub 规则由 `quantumultX/rules/services/` 独立维护。详见 [通用服务分流规则集](service-rules.md)。

如果远程规则文件内的策略名不应直接采用，应显式使用：

```text
force-policy=<policy>
```

例如 Gemini 规则当前固定到：

```text
force-policy=Gemini
```

## 敏感信息

仓库不应提交：

- 节点订阅
- 账号或 Token
- Cookie
- MITM 密码
- 私钥
- 其他可用于直接访问个人服务的凭据


## macOS 与 iPhone 的差异

两端共享：

- 地区策略组
- AI / Google / GitHub / Spotify / 社交媒体等 ruleset
- rewrite / filter 资源
- 节点订阅格式

DNS 不再完全共用：iPhone 模板优先采用域名级 DoH；macOS 继续保持更保守的兼容配置。

macOS 额外加载桌面应用更新规则：

```text
rules/ai/updates.list
```

iPhone 不加载该文件，应用更新交给 App Store / Apple 服务。

### iPhone 域名级 DoH

`qx-ios.conf` 不再为 QQ、微信、淘宝、京东、BiliBili、网易、iCloud 中国区等服务使用明文 UDP/53 DNS，而是使用域名级 DoH。

默认 resolver：

```text
https://dns.alidns.com/dns-query
https://doh.pub/dns-query
```

域名级映射遵循两个原则：

1. root/apex 与子域名分别声明，例如 `/qq.com/` 与 `/*.qq.com/`，避免只写 wildcard 时漏掉根域名。
2. 当前生产模板每个 domain pattern 只绑定一个 DoH，以兼容 Quantumult X 1.8.0 正式版。

Quantumult X 1.8.1 (950+) TestFlight 已支持同一 domain pattern 的多个 DoH/DoQ 堆叠并发查询；该能力暂时只作为注释示例保留，不作为生产模板的最低版本要求。

同样地，950 新增的 `{# note #}` filter/rewrite 元数据暂时不写入仓库模板，因为 1.8.0 以及较旧 macOS 版本会把这种行视为非法配置。


## 标准运行文件

仓库中的两份主配置是模板：

- `qx-macos.conf`
- `qx-ios.conf`

实际使用时复制其中一份为：

```text
quantumultX/quantumultX.conf
```

该文件已加入 `.gitignore`，用于保存节点订阅、Token、MITM P12 和 passphrase。

## 网络行为修正

为了让策略真正可控：

- `server_check_url` 使用 `http://www.gstatic.com/generate_204`，以标准 HTTP 204 端点进行节点存活/延迟检查，减少 captive portal 页面或重定向带来的干扰。

- `17.0.0.0/8` 已从 `excluded_routes` 移除，避免 Apple / Apple TV 流量绕过 Quantumult X。
- GitHub 域名已从 `dns_exclusion_list` 移除，使 GitHub 代理流量可以继续使用 Quantumult X 的远端解析机制。
- macOS 与 iPhone 模板都默认不设置 `udp_whitelist`，避免语音、视频、WebRTC 与游戏的高位 UDP 被误丢弃；严格白名单仅作为可选注释保留。


## 外部资源边界

核心 service routing 不再依赖第三方 ruleset。

保留上游的资源主要是：

- `resource_parser_url`
- Adblock4limbo 广告数据源
- 人工诊断脚本
- 图标资源

HTTPS Rewrite 默认关闭，因此基础使用不需要 MITM。

完整说明见 [外部依赖策略](dependencies.md)。
