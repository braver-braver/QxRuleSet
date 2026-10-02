# Mihomo / Clash Party（Windows）

主模板：

```text
mihomo/clash-party-override.js
```

目标环境：

- Windows 10 / 11
- Clash Party
- Mihomo 内核（非必须使用 Smart Core）
- 机场订阅继续由 Clash Party 管理
- 本仓库只负责覆写策略、DNS、Sniffer 与规则

## 为什么使用覆写而不是完整订阅模板

Clash Party 的覆写会在机场订阅加载后执行，因此可以：

1. 保留机场原始节点。
2. 机场更新后继续自动应用本仓库策略。
3. 不在仓库里保存订阅 URL、Token 或节点密码。
4. 使用 Mihomo 的 `include-all-proxies` + `filter` 动态生成地区节点组。

模板会接管：

```text
rules
```

对于代理组，模板会把自己的策略组放在前面，同时保留所有不重名的机场原有组，避免复杂订阅的 `dialer-proxy` / 链式代理依赖被破坏。

并补充：

```text
rule-providers
dns
sniffer
部分 tun 参数
```

不会写入：

```text
proxy-providers
proxies
订阅 URL
mixed-port
external-controller
secret
```

## 导入 Clash Party

PR 合并后，可直接使用：

```text
https://raw.githubusercontent.com/braver-braver/QxRuleSet/refs/heads/main/mihomo/clash-party-override.js
```

Clash Party：

```text
覆写
  ↓
通过 URL 导入
  ↓
粘贴上面的地址
  ↓
订阅管理
  ↓
目标订阅 → 编辑信息
  ↓
覆写 → 选择 QxRuleSet Mihomo
```

建议先只给一个测试订阅启用，不要一开始设置成全局覆写。

## Clash Party 推荐设置

### 内核

使用：

```text
Mihomo
```

模板不依赖 Clash Party Smart Core。

如果以后使用 Smart Core，应单独测试其 Smart Override 是否和本模板冲突。

### TUN

TUN 的开关交给 Clash Party GUI 控制。

推荐：

```yaml
stack: mixed
dns-hijack:
  - any:53
  - tcp://any:53
auto-route: true
auto-detect-interface: true
strict-route: false
```

模板会提供上述参数，但不会强制 `tun.enable=true`。

因此：

- 需要全局接管时，在 Clash Party 打开 TUN。
- 只想使用系统代理时，可以关闭 TUN，模板仍可继续工作。

Windows 防火墙开启时，如果 TUN 异常，应确认 Mihomo 内核被允许通过防火墙。

### DNS 接管

Clash Party 的应用级 DNS 配置优先级高于普通覆写。

如果希望完整使用本模板中的 DNS：

1. 关闭 Clash Party 的 DNS 接管/覆写；或
2. 在 Clash Party DNS 页面配置与模板一致的参数。

不同版本 UI 文案可能略有变化。

## DNS 设计

默认：

```text
国内 / DIRECT
  ↓
AliDNS + DNSPod DoH
```

以下服务使用经过代理的境外 DoH：

```text
OpenAI
Claude
Gemini
国际媒体
GitHub
Google
YouTube
Telegram / Twitter / Reddit / Facebook / Discord
Spotify
```

境外 DoH：

```text
Cloudflare DoH
Google DoH
        ↓
PROXY
        ↓
🚀 默认代理
```

代理节点自己的域名继续通过国内 DoH 解析，避免 DNS 启动环路：

```text
proxy-server-nameserver
  ↓
AliDNS / DNSPod
```

模板使用 Fake-IP，并对以下内容返回真实 IP：

- private / LAN 域名
- `.lan`
- `.local`
- Windows 时间同步
- Windows NCSI 网络状态检查

## 节点策略

### 通用节点

```text
🚀 默认代理
├── ⚡ 自动选择
├── 🇸🇬 新加坡
├── 🇯🇵 日本
├── 🇭🇰 香港
├── 🇹🇼 台湾
├── 🇰🇷 韩国
├── 🇺🇸 美国
├── 🇬🇧 英国
├── 🌐 全部节点
└── DIRECT
```

地区组使用 Mihomo 原生 `url-test`：

```text
https://www.gstatic.com/generate_204
expected-status: 204
```

并排除常见机场信息节点：

```text
剩余
套餐
流量
到期
官网
注册
重置
Traffic
Expire
...
```

如果你的机场使用特殊命名，可以直接修改：

```text
REGION.HK / TW / JP / SG / KR / US / GB
```

## AI

三个独立服务：

```text
🤖 OpenAI
🧠 Claude
✨ Gemini
```

自动组只允许节点名称匹配：

```text
US / GB / JP / SG
```

并使用服务自己的 URL 做健康检测：

```text
OpenAI → https://chatgpt.com/cdn-cgi/trace
Claude → https://claude.ai/cdn-cgi/trace
Gemini → https://gemini.google.com/
```

这比普通 `generate_204` 更能发现“节点本身通，但服务不可用”的情况。

但要注意：

> Mihomo 这一版只是“服务可达性 + 节点名称地区预筛”，并不等价于 Quantumult X 的 `ai-node-sifter.js`。

QX 脚本还会验证真实出口地区，并区分 PASS / FAIL / UNCERTAIN。

因此对特别敏感的账号，Windows 端仍建议在 `🤖 OpenAI / 🧠 Claude / ✨ Gemini` 中选择明确、稳定的地区节点。

## 国际媒体

```text
📰 国际媒体
```

覆盖本仓库自维护的：

- BBC
- Zaobao / 联合早报
- Channel NewsAsia
- The Straits Times
- Reuters / AP / Bloomberg
- FT / Economist / Guardian
- NYT / WSJ / CNN
- Nikkei / SCMP
- Al Jazeera / DW / France 24 / RFI

默认第一选择：

```text
🇸🇬 新加坡
```

普通 BBC News 不要求英国出口。

BBC iPlayer 等英国地区限定内容，需要手动切到：

```text
🇬🇧 英国
```

## Rule Providers

本仓库自己维护：

```text
mihomo/rules/openai.yaml
mihomo/rules/claude.yaml
mihomo/rules/gemini.yaml
mihomo/rules/media.yaml
mihomo/rules/direct.yaml
```

这些规则通过 `PROXY` 策略更新，避免中国大陆网络下直接访问 GitHub Raw 不稳定。

通用平台规则不复制一份到本仓库，而是使用 Mihomo / MetaCubeX geosite：

```text
apple
github
google
youtube
spotify
bilibili
microsoft
bing
telegram
twitter
reddit
facebook
instagram
discord
cn
private
category-ads-all
```

这样可以降低 Quantumult X 与 Mihomo 两套规则长期同步的维护成本。

## 规则顺序

核心顺序：

```text
LAN / private
  ↓
本仓库 direct corrections
  ↓
OpenAI
Claude
Gemini
  ↓
广告
  ↓
社交媒体
国际媒体
  ↓
GitHub
Bing
Microsoft
YouTube
Google
Spotify
BiliBili
Apple
  ↓
CN / GEOIP CN
  ↓
MATCH → 🚀 默认代理
```

重点边界：

- Gemini 必须在 Google 前。
- YouTube 必须在 Google 前。
- Bing 必须在 Microsoft 前。
- AI 必须在广告和通用 Google 规则前。
- 国际媒体域名不使用整个 Akamai / Cloudflare / Fastly 共享 CDN。

## Windows 排错

### TUN 开启后断网

先测试：

1. 关闭 TUN，仅打开系统代理。
2. 确认订阅节点本身正常。
3. Windows 防火墙允许 Mihomo。
4. 保持 `strict-route=false`。
5. 再重新打开 TUN。

如果系统代理正常、TUN 断网，应优先按 Windows TUN / DNS 接管问题排查，不要先怀疑 ruleset。

### DNS 设置看起来没有生效

检查 Clash Party 是否仍开启应用级 DNS 接管。

应用级配置会在普通覆写之后再次合并，因此可能覆盖本模板 `dns` 字段。

### 地区组为空

说明机场节点名称没有命中当前正则。

例如机场可能使用：

```text
Premium-A
IEPL-03
US-West
Tokyo Premium
```

有明确地区含义时，扩展对应 `REGION.*` 正则即可。

不要凭猜测把完全不透明的节点名映射到国家。

### Rule Provider 下载失败

模板中的自维护 provider 使用：

```text
proxy: PROXY
```

因此先确保：

```text
🚀 默认代理
```

存在可用节点。

## 不做的事情

默认模板不包含：

- HTTPS MITM
- Spotify Premium Rewrite
- WeatherKit Rewrite
- 节点订阅密钥
- 机场 Token
- Smart Core 专用模型配置
- 自动修改 Windows 注册表 / 防火墙

这些能力应独立维护，避免基础网络模板承担过多副作用。
