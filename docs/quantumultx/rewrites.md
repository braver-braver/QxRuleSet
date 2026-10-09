# Quantumult X iOS Rewrite 资产清单与维护策略

> 审查基线：2026-10-09，来自用户提供的 iPhone 现行配置（已删除节点订阅）；本仓库**不保存该配置本体**。
> “旧版启用”仅表示上传文件里的 `enabled=true`，不是功能生效的证据。
> “公开源码可获取”仅说明配置 / JS 在 GitHub 上存在；**未进行 iOS 实机请求命中与功能回归测试**。
> 本文不包含用户私人 URL、Cookie、P12、passphrase、订阅或敏感响应。

## 决策

- **核心分流与所有可选 Rewrite 解耦**：默认无 MITM、无 HTTPS body 脚本。
- **保留上游**：WeatherKit；Adblock4limbo（仅作为可选资源，默认关闭；注意其大范围 hostname）。
- **只重写可稳定审计的少量功能**：本仓库新增 `quantumultX/rewrites/common/google-redirect.conf`，默认关闭。
- **暂不引入**：自托管“指南针定位解锁”、Slidebox Pro 和大规模开屏广告包等未完成独立实测的功能。BiliBili、微博、高德仅新增**单接口实验模块**，一律默认关闭，不代表已验证生效。
- **不复制未核实授权的源代码**：对微博/高德/BiliBili，只在实际请求样本、App 版本和授权条件明确后重新实现最小拦截或 JSON 净化。

## 旧版 16 项清单

“公开文件存在”是本次静态审查结果；“未核验自托管”表示未取得可验证响应，并不代表 404。
“可试”表示只有完成 iPhone 的 A/B 验证之后才考虑恢复。

| 旧版功能 | 旧版状态 | 静态证据（2026-10-09） | 长期处理 |
| --- | --- | --- | --- |
| 指南针定位解锁 | 已开启 | 私有/自托管规则未独立获取内容 | 暂缓；不收入公共模板 |
| iRingo WeatherKit | 已开启 | 官方 GitHub release / snippet 仍维护 | 保留上游；模板默认关闭 |
| Slidebox 会员增强 | 已开启 | 单独 `.js` 放在 `rewrite_remote`；自托管内容未核验；解析器可能不识别独立 JS | 暂缓；检查 QX 解析日志；不导入 |
| BiliBiliAdsLite | 已开启 | 第三方自托管包内容未独立核验 | 不搬入旧包；仅提供独立的 splash/show 单接口实验模块 |
| StartUpAds 开屏净化 | 已开启 | 第三方自托管包内容未独立核验 | 暂缓；逐 App 实测 |
| 微博净化 | 已开启 | `ddgksf2013/Rewrite/AdBlock/WeiboAds.conf` 存在；2025-12 更新 | 不 Fork 大脚本；仅提供 ad/preload 单接口实验模块 |
| 高德地图净化 | 已开启 | `ddgksf2013/Rewrite/AdBlock/AmapAds.conf` 存在；外部 JS 含混淆实现 | 不复制混淆脚本；仅提供 splash_screen 单接口实验模块 |
| Google 中国域名跳转 | 已开启 | 简单规则可独立重写和测试 | **自维护**；新模块默认关闭 |
| Adblock4limbo 网页净化 | 已开启 | 官方仓库 2026-10-06 更新；包含大量非广告站点 hostname | 保留上游，默认关闭；不要无差别 MITM |
| Spotify 部分 Premium 增强 | 已关闭 | `app2smile/rules/module/spotify.conf` 存在，但服务端/客户端兼容性无法静态证明 | 继续关闭；不列入默认模板 |
| YouTube 去广告 | 已关闭 | `ddgksf2013/Rewrite/AdBlock/YoutubeAds.conf` 存在；依赖 Maasea 脚本 | 继续关闭；按需单测 |
| 闲鱼净化 | 已关闭 | `ddgksf2013/Rewrite/AdBlock/GoofishAds.conf` 存在 | 不默认集成 |
| Safari 快捷搜索 | 已关闭 | `ddgksf2013/Rewrite/Html/Q-Search.conf` 存在，较久未更新 | 可另行实现小型自维护规则 |
| 豆瓣移动网页增强 | 已关闭 | `ddgksf2013/Rewrite/Html/Douban.conf` 存在 | 不默认集成 |
| 小红书净化 | 已关闭 | 自托管规则未独立获取内容 | 继续关闭 |
| 百度网盘净化 | 已关闭 | 自托管 JS 内容未独立获取；单独 JS 资源需检查解析器兼容 | 继续关闭 |

旧配置中以分号注释掉的其它 Rewrite 不计入以上 16 项；本仓库不将其视为已部署资源。

## 本仓库自维护：Google Redirect

文件：

```text
quantumultX/rewrites/common/google-redirect.conf
```

匹配仅限定 `google.cn` 和 `www.google.cn`，保留路径及查询参数，拒绝误匹配 `google.cn.evil.example`。

在 `qx-ios.conf` 的 **已有** `[rewrite_remote]` 中预留了该 URL，但默认：

```ini
enabled=false
```

开启前先检查 Quantumult X 配置证书：需要在当前 iOS 设备生成/安装并信任 **仅供个人本地使用** 的 MITM CA，且 `[mitm]` 的 hostname 包含 `google.cn` 和 `www.google.cn`。不要把证书、P12 或口令加入 Git。

如果只是基础代理/分流，完全不需要启用该 Rewrite，也无需创建 MITM 证书。

## 第二阶段：BiliBili / 微博 / 高德最小 Rewrite（2026-10-09）

新增三个**实验性、仅处理单一类广告端点**的 QX 配置，**没有从第三方资源复制 JS**：

| 模块 | 限定主机名 | 匹配的广告端点 | QX 处理 | 默认状态 |
| --- | --- | --- | --- | --- |
| `rewrites/apps/bilibili-splash.conf` | `app.bilibili.com` | `/x/v2/splash/show` | `reject-dict` | 关闭 |
| `rewrites/apps/weibo-ad-preload.conf` | `api.weibo.cn` | `/<数字>/ad/preload` | `reject-dict` | 关闭 |
| `rewrites/apps/amap-splash.conf` | `m5.amap.com`、`m5-zb.amap.com` | `/ws/(aos|valueadded)/alimama/splash_screen` | `reject-dict` | 关闭 |

**来源与证据边界**：上述接口路径在公开社区 Rewrite 中已有出现，详见 [WeiboAds.conf](https://github.com/ddgksf2013/Rewrite/blob/master/AdBlock/WeiboAds.conf)、[AmapAds.conf](https://github.com/ddgksf2013/Rewrite/blob/master/AdBlock/AmapAds.conf) 和 [BiliBili 社区规则](https://github.com/Moli-X/Resources/blob/main/Rewrite/Bilibili/AD_Bilibili.conf)。本仓库只根据接口类别重新编写狭窄匹配，不复制第三方 JS、扩大规则范围或宣称对 2026 年的最新版 App 已生效。

它们仅拦截广告预加载/开屏接口，**不会**清理推荐信息流、处理评论区、解锁会员或修改账号权限。只在用户愿意实机验证时手动打开一个模块，避免一次打开三个模块导致问题难以定位。

启用时必须在个人私有配置中自行为相应 host 安装、信任 MITM CA，并只增加该模块说明的 host；公开仓库不能包含证书内容。发生 HTTPS 连接失败、App 卡开屏、无法定位等问题时立即关闭对应模块。

### 回归测试与日志采集

不依赖 npm 包，使用 Node.js 内建测试运行器：

```bash
node --test quantumultX/rewrites/tests/rewrite-patterns.test.mjs
```

自动测试只验证规则匹配范围与默认关闭状态，不能证明 iOS App 功能生效。具体实机回归：先记录当前 App 版本（版本号和 build），在测试 Profile 中逐个启用 Rewrite，检查 QX 请求日志实际命中，再完成关闭/开启 A/B 对照。

- **BiliBili**：验证重新启动后广告位置变化，同时检查登录、视频播放、搜索和弹幕。
- **微博**：验证重新启动后推广位置变化，同时检查登录、主页信息流及发送微博。
- **高德**：验证重新启动后开屏广告变化，同时检查搜索、当前位置、路线规划、导航和语音播报。

日志只需提供已脱敏的主机名、路径、请求时间和命中动作；绝对不要共享 Cookie、Authorization、定位坐标、完整带 token 的 URL、P12 或 passphrase。

## 实机验证：分成三个级别

1. **下载成功**：QX 成功更新 Rewrite，资源解析日志无错误；这仅证明 URL/配置可获取。
2. **规则命中**：在 QX 请求日志中能看到目标 hostname、Rewrite 规则及预期脚本命中；独立 JS 是否被错误当成配置，在此阶段判断。
3. **功能回归**：相同 App 版本、账号和网络条件下，分别关闭/开启单个 Rewrite，结果可稳定复现，同时确认无登录、支付、播放器或页面异常。

对自维护 JSON 脚本：保存**脱敏样例响应**作为 fixture，做纯函数转换前后测试；不允许采集或提交账号信息与敏感请求头。

## 分阶段恢复旧功能

- 测试 Profile **先保持所有可选 Rewrite 关闭**，完成 DNS、Apple、OpenAI、Claude、Gemini、Spotify 和媒体分流验证。
- 首先手工验证 WeatherKit，再按实际需要开启；涉及天气位置数据，第三方 provider 需单独评估。
- Google 跳转作为最小、可观测的自维护示例，单独开启并验证 `https://www.google.cn/search?q=...`。
- 微博 / 高德 / BiliBili 等**一次只恢复一项**；先确定必要功能和当前 App 版本，再选最小规则重新实现。
- 广覆盖的 Adblock4limbo Rewrite 最后验证，遇到网站异常可第一时间关闭；**不要误把同名的 `Adblock4limbo.list` 过滤规则当成 Rewrite**。

## 上游源码与授权

- [iRingo WeatherKit](https://github.com/NSRingo/WeatherKit) — 源码许可证 Apache-2.0，运行时依赖 Apple 天气接口。
- [Adblock4limbo](https://github.com/limbopro/Adblock4limbo) — MIT，复杂网页净化逻辑跟随上游。
- [ddgksf2013/Rewrite](https://github.com/ddgksf2013/Rewrite) / [ddgksf2013/Scripts](https://github.com/ddgksf2013/Scripts) — **未确认允许公开 Fork 的许可证**，不可默认复制大段实现。
- [app2smile/rules](https://github.com/app2smile/rules) — 没有把部分会员增强功能引入默认模板。

授权不确定时，基于实际合法观测到的接口行为编写新的、最小的实现，且保留来源说明；若未获得源文件复制授权，不提交其原始代码。
