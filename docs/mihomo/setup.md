# Mihomo / Clash Party（Windows）

## 5 分钟上手：只需要你的订阅链接

本仓库提供 **JavaScript 覆写**，不需要把机场订阅 Token、节点密码写进本仓库，也不需要自己合并 YAML。

1. 打开 Clash Party → **订阅管理** → 添加订阅，粘贴自己的订阅 URL，更新并确认至少能看到一个可用节点。订阅必须能被 Clash Party/Mihomo 正常解析，不能把纯网页或机场登录页面当订阅。
2. 打开 **覆写** → 通过 URL 导入下面的 JavaScript：
   `https://raw.githubusercontent.com/braver-braver/QxRuleSet/refs/heads/main/mihomo/clash-party-override.js`
3. 回到 **订阅管理** → 找到刚添加的订阅 → **编辑信息** → **覆写**，选中刚导入的 QxRuleSet JS 并保存，再更新/应用该订阅。**覆写要绑定到订阅**，仅导入 JS 不会自动启用。
4. 在代理组中先选择 **🚀 默认代理 → ⚡ 自动选择**；测试浏览器访问与节点健康检查。
5. Windows 按需求在 Clash Party GUI 开启 **系统代理**，如希望代理更多系统流量，再开启 **TUN**。脚本不会自动打开 TUN、写端口、修改系统防火墙。

**你的私有订阅链接只保留在 Clash Party 本机。** 如果机场链接需要特殊客户端转换或认证，先用 Clash Party 自己的订阅更新功能验证；这个 JS 不会尝试读取、上传或修复订阅凭据。

**注意应用级配置优先级：** 如果要由本 JS 控制 DNS 和嗅探，在 Clash Party 设置中关闭对 DNS/嗅探的应用级覆盖（具体菜单文案随版本不同）；如果选择由 Clash Party 管理，则以 GUI 的最终配置为准。遇到无法启动，先查看 Clash Party 的「最终配置 / 内核日志」，不要同时加载多个会重建 `rules` / `proxy-groups` 的覆写。

**故障时最短回退：** 在订阅编辑信息中取消绑定这个覆写并重新应用订阅；原订阅节点和认证信息不会被脚本删除。

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
4. 使用 Mihomo 的 `include-all` + `filter` 动态生成地区节点组。

模板会接管：

```text
rules
```

对于代理组，模板会把自己的策略组放在前面，**完整保留机场的原始组**；遇到同名组或同名节点时，只将 QxRuleSet 的生成组重命名为 `QXR · ...`，并同步修正本仓库的规则引用，避免干扰机场 `dialer-proxy` / 链式代理依赖。

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

可直接使用稳定分支（必须先在订阅管理导入节点订阅）：

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

建议先只给一个测试订阅启用。Clash Party 的覆写需要在订阅编辑界面指定，而非导入后自动全局生效。

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
__QXR_BOOTSTRAP__
        ↓
🚀 默认代理
```

代理节点自己的域名继续通过国内 DoH 解析，避免 DNS 启动环路：

```text
proxy-server-nameserver
  ↓
AliDNS / DNSPod
```

DNS 监听限制在本机 `127.0.0.1:1053`，避免无意向局域网开放 DNS 服务；系统代理和 TUN 的开关仍由 Clash Party GUI 负责。实际生效的 DNS 监听地址需以 GUI 生成的最终配置为准。

模板使用 Fake-IP，并对以下内容返回真实 IP：

- private / LAN 域名
- `.lan`
- `.local`
- Windows 时间同步
- Windows NCSI 网络状态检查

## 与机场原始组共存

- 地区、自动和 AI URL-test 节点组统一启用 `include-all: true`，同时涵盖 `proxies` 和 `proxy-providers`。
- 不再使用固定名称 `PROXY` 做内部下载组：机场自带 `PROXY` 及其链式代理引用原样保留。节点和 Proxy Provider 的名称也纳入冲突检测。
- 内部组默认叫 `__QXR_BOOTSTRAP__`。如果机场也使用此名称，配置会自动选择带序号的名称，并同步修改境外 DoH 与 Rule Provider 下载出口。
- 自维护 Rule Provider 优先使用 `qxr_openai`、`qxr_claude`、`qxr_gemini`、`qxr_media`、`qxr_direct_custom`；如机场已有同名资源，会自动选择后缀 `_1`、`_2` 等，并同步修正 DNS policy、规则和缓存文件名，绝不覆盖机场原件。
- 台湾规则不把 `🇨🇳` 当作台湾出口；美国三字码及 AI 地区筛选增加 token 边界，避免 `Overseas-HK` 被错认成 `SEA`。
- 移除 OpenAI 专用规则中的通用 Cloudflare / Stripe / WorkOS / Sentry 等域名，避免影响其他网站的身份认证与支付。

以上都是静态策略修正，不代表 Mihomo 内核或 Windows TUN 已经经过实机验证。

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

因此对特别敏感的账号，Windows 端仍建议在 `🤖 OpenAI / 🧠 Claude / ✨ Gemini` 中选择明确、稳定的地区节点。若订阅节点不含地区标签，AI 自动组可能为空并安全地落到 `REJECT`；你可以先独立确认真实出口与服务资格，再手动切换到 `🌐 全部节点`。**这项手动选择不是地区解锁证明。**

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
🚀 默认代理 → ⚡ 自动选择
```

这是为了兼容**只含部分地区或采用不透明命名的订阅**。如希望固定地区，可以在「📰 国际媒体」中手动选择 `🇸🇬 新加坡`、`🇬🇧 英国` 等节点组。其他普通服务（YouTube、GitHub、Bing、社交媒体）也优先继承默认代理，避免未匹配到地区时错误落入 `REJECT`。

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

这些规则通过内部 `__QXR_BOOTSTRAP__` 策略更新，避免中国大陆网络下直接访问 GitHub Raw 不稳定。

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

## 自动化回归

本仓库包含不依赖第三方 npm 包的 Node.js 测试：

```bash
node --test mihomo/tests/override.test.mjs
```

测试覆盖内联及 Provider 节点、机场原始同名组保留、节点名称冲突、Rule Provider 同名与 DNS 引用一致性、缺少地区标签时的默认回退，以及地区正则误匹配。GitHub Actions 会对每次 Mihomo 改动运行上述回归测试。Windows Clash Party / Mihomo 内核配置解析及 TUN 联网仍需要在真实设备上验证。

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
proxy: __QXR_BOOTSTRAP__
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
