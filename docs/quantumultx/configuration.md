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

- DNS
- 地区策略组
- AI / Google / GitHub / Spotify / 社交媒体等 ruleset
- rewrite / filter 资源
- 节点订阅格式

macOS 额外加载桌面应用更新规则：

```text
rules/ai/updates.list
```

iPhone 不加载该文件，应用更新交给 App Store / Apple 服务。


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

- `17.0.0.0/8` 已从 `excluded_routes` 移除，避免 Apple / Apple TV 流量绕过 Quantumult X。
- GitHub 域名已从 `dns_exclusion_list` 移除，使 GitHub 代理流量可以继续使用 Quantumult X 的远端解析机制。
- iPhone 模板默认不设置 `udp_whitelist`，避免 VoIP、视频通话和游戏的高位 UDP 端口被误丢弃。
- macOS 模板保留原有较保守的 UDP 白名单设置。


## 外部资源边界

核心 service routing 不再依赖第三方 ruleset。

保留上游的资源主要是：

- `resource_parser_url`
- Adblock4limbo 广告数据源
- 人工诊断脚本
- 图标资源

HTTPS Rewrite 默认关闭，因此基础使用不需要 MITM。

完整说明见 [外部依赖策略](dependencies.md)。
