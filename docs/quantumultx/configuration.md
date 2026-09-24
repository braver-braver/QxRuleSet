# Quantumult X 配置

配置文件：[`quantumultX/qx-macos.conf`](../../quantumultX/qx-macos.conf)

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
