# macOS QxRuleSet：AI 联合策略与 Homebrew 分流

适用模板：`quantumultX/qx-macos.conf` **2026.11.17.1**。仓库模板不会自动修改已经导入的私人 Profile。

## 默认分流

macOS **暂时保留 `final, proxy`**（不同于 iPhone 的 `final, direct`），因为桌面开发工具经常访问未列入现有规则的海外站点。继续保留 `geoip, cn, direct`、`cn.list`、微信等国内直连规则，并添加 Google、Bing、Apple/iCloud 大陆域名的精确直连例外，不覆盖整个 `.cn` 顶级域名。

Homebrew 的 `formulae.brew.sh` 单独匹配 `Homebrew服务` 策略组，选项顺序为 **direct → 新加坡健康节点 → 美国健康节点 → proxy**。默认为直连；**直连失败时不会自动透明重试代理**，需要在 QX 策略面板手动切换到新加坡或美国节点。

`ghcr.io`、GitHub 原始资源与下载仍归 `GitHub服务` 管理。本次不调整私人节点、DNS、MITM、`excluded_routes`、`fallback_udp_policy`。

## AI 联合出口与网络恢复

OpenAI、Claude、Gemini 的三个远端规则文件仍独立维护，但在 macOS 模板中统一使用 `force-policy=海外AI`，其安全出口为 `🛡 AI联合安全节点`。不将 Auth0、Cloudflare、Stripe 或通用 Google CDN 整域代理到 AI 组。

```ini
[policy]
static=海外AI, 🛡 AI联合安全节点, reject
# 实际 server-tag-regex 以 qx-macos.conf 为准
```

macOS 只保留一个联合检测入口，使用 `#provider=all&mode=sticky`；每天复核两次。开盖、Wi-Fi 重连时运行一次 `#provider=all&mode=sticky&trigger=network&delay=7`，等待七秒再检查。

- **首次导入：** 联合安全节点默认 `reject`。手动运行「海外 AI 联合安全节点」，只在同一节点对三家全部通过时切入该节点。
- **短暂超时：** 已经过三重验证、且仍是当前所选节点的出口可暂时保留并通知；从未通过验证的任意手动选中节点不得因 sticky 而继续使用。
- **明确地区受限：** 任一服务确认失败，立即切 `reject`，尝试其他候选；无新候选通过则保持 `reject`。
- **睡眠后历史恢复：** 当前为 `reject` 时，只能在历史节点重新通过三家检查后恢复。暂时无法确认时不直接恢复。
- **请求上限：** 单次最多扫描 9 个新候选，避免大量三平台并发测试。

`AI应用更新`（桌面软件更新下载）仍使用原来独立策略，不依赖 AI 登录地区验证；`manus.im` 改为普通 `全球策略`，不进入三家联合解锁池。

## macOS 部署与验收

1. **备份现有私人 Profile**，另建测试配置。不要把私人机场订阅、MITM 凭据上传至 GitHub。
2. 以新版 `qx-macos.conf` 为准同步：`[policy]` 两个联合 AI 组和 Homebrew 组；`[task_local]` 三条联合任务（手动、定时、网络变化）；`[filter_remote]` 三条 `force-policy=海外AI`；`[filter_local]` 的 Homebrew 与大陆域名例外。不能只复制规则而不定义策略组。
3. 在 QX 中保持 **filter 分流模式**，刷新远端规则和 `ai-node-sifter.js` 缓存，手动运行联合安全节点查询。
4. 用 QX 请求记录确认 `chatgpt.com`、`claude.ai`、`gemini.google.com` 命中 `海外AI`。睡眠/开盖后观察是否只触发一次联合网络恢复任务。
5. 测试 Homebrew 的文件下载，并在 QX 日志查看命中策略：

   ```bash
   url='https://formulae.brew.sh/api/internal/packages.arm64_golden_gate.jws.json'
   curl -fL --connect-timeout 10 --max-time 45 -o /dev/null \
     -w 'HTTP=%{http_code} IP=%{remote_ip} bytes=%{size_download}\n' "$url"
   ```

   直连超时后，**手动**将 `Homebrew服务` 改选新加坡或美国，再重试同一 URL，最后运行 `brew update`。若 curl 成功而 brew 失败，还需检查 Homebrew 的 API 缓存/条件请求，不能直接归咎 QX。
6. 验证 `google.cn`、`bing.com.cn`、`apple.com.cn` 等中国大陆站点走 `direct`；未知域名仍按 macOS 原来的 `final, proxy`。发现异常可直接切回备份 Profile。

CI 能验证规则结构、模拟响应和脚本分支，但**不能证明真实节点、运营商网络、Homebrew API 或账号权限**。参阅 [AI 安全节点筛选](ai-node-sifter.md)和[升级说明](upgrade.md)。
