# Quantumult X 诊断脚本维护

> 基线：2026-10-09。iOS/macOS 共用脚本源码，个人订阅与 MITM 未改动。

## 工具一览

| 类型 | QX 入口 | 自维护脚本 | 结果边界 |
| --- | --- | --- | --- |
| 节点 GEO 信息显示 | `[general] geo_location_checker` | `scripts/geo-location-checker.js` | IP / 国家地区 / ASN |
| 地理位置检测 | `[task_local]` | `scripts/geo-query.js` | 当前策略出口 IP / 地区 |
| 节点纯净度查询 | `[task_local]` | `scripts/node-reputation.js` | 有限公开代理线索，**非纯净度评分** |
| 策略流量查询 | `[task_local]` | `scripts/traffic-check.js` | QX 提供的流量统计 |
| 服务解锁查询 | `[task_local]` | `scripts/streaming-ui-check.js` | 端点可达性 / 地区疑似线索 |

这几项均为只读查询。手动任务通过 `$environment.params` 取得用户所选策略，使用 `opts.policy` 发起代理链路上的检测请求；空参数不自动改成 DIRECT。GEO 信息显示使用 QX `$response`，并不额外联网。

## 地理位置：HTTPS 与可靠性

- **ipwho.is**：`https://ipwho.is/`，免费 HTTPS IP 地理数据，包含 `country_code`、`region`、`city`、`connection.asn` / `isp`，免费接口限 1,000 次/天/客户端出口 IP，不提供完整 VPN/Tor 风险数据。
- 原第三方 GEO 解析器经过混淆，还将 `TW` 旗帜强制改为 🇨🇳；新版按 ISO 两位国家地区码显示 🇹🇼，无需复制混淆实现。
- 原 `ip-api.com` 免费地址使用 HTTP，不能加密；新版全部改为 HTTPS。
- 手动 GEO 查询失败会退回 `https://www.cloudflare.com/cdn-cgi/trace`，只报告 IP / 国别，不臆造城市、ASN 或运营商。
- `[general]` 的 GEO 钩子失败时调用 `$done(null)`，不显示伪造结果。
- 结果是公网 IP 的粗略位置，不等于设备 GPS。跨网络或链路切换时结果可能变化。

来源：https://ipwhois.io/documentation

## 节点纯净度：只输出能证明的东西

先以当前策略访问 ipwho.is 得到出口 IP，再按这个明确 IP 查询 `https://api.ip2location.io/?ip=<出口IP>`：

- 免费 `is_proxy=true` 是开放代理风险线索。
- 免费 `is_proxy=false` **仅代表未检测到开放代理标记**，并不能推断住宅、机房、VPN、平台风控或评分。
- 字段缺失、HTTP 429、网络错误时显示“暂不可用”，不输出 0%/100% 纯净度。
- 数据查询会将你的代理出口 IP 提供给这两个第三方服务；只在手动触发时查询，不上传订阅/密码。

来源：https://www.ip2location.io/ip2location-documentation；IP2Location.io 免费/免 Key 方案限制可能调整，不能把其完整商业风险字段当作免费能力。

## 策略流量查询

- 使用 Quantumult X 的 `get_customized_policy` 和 `get_traffic_statistics` 只读 API。
- 对指定策略的直接候选节点汇总 TCP/UDP 收发量，排序时始终将节点名与流量保持同一记录，避免旧版错位。
- 限制显示 Top 5；不递归全部嵌套策略组；API 不支持时明确提示。
- 返回的是 QX 统计窗口的数据，不等于机场订阅的已用流量或余额。

## 服务解锁的判读

- 401/400：端点有 HTTP 响应，**未鉴权**；429：限流；529：服务繁忙。都不能直接显示“可用/解锁成功”。
- Web 首页 200/跳转：只能证明入口可达，不能验证账号登录、模型、Netflix 播放或 YouTube Premium 订阅。
- Google 香港跳转、中文语言首选项均不是“中国大陆出口”的证据；Google 中国站跳转也只能提示疑似。
- 对于普通 403、验证码、人机挑战，应区分“风控/受限”与明确地区不支持。

## 验证

运行模拟 QX 响应的 Node.js 测试（没有真实网络请求）：

```bash
node --test quantumultX/scripts/tests/diagnostics.test.mjs
```

验证点：GEO 成功/无效响应、台湾旗帜、所选策略路由与 HTML 转义、API 限流降级、开放代理线索、榜单排序和单次 `$done`、解锁结果分类。

**尚未进行 QX iPhone/macOS 实机联网测试**。下载新版模板后须在 QX 内更新远程任务脚本，检查实际请求日志中是否正确采用所选策略，并在 Wi-Fi/蜂窝网络下分别试用。

任何测试截图或日志需要删除订阅 URL、Cookie、Authorization、MITM 私钥、P12、真实位置坐标等敏感信息。
