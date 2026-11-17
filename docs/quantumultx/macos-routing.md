# macOS QxRuleSet：独立固定 AI 出口与 Homebrew 分流

适用模板：`quantumultX/qx-macos.conf` **2026.11.17.2**。仓库模板不会自动修改已经导入的私人 Profile。

## 默认分流

macOS 保留 `final, proxy`，区别于 iOS 的 `final, direct`。继续保留国内 GEOIP/远端直连规则，以及 Google、Bing、Apple/iCloud 的大陆域名直连例外。

`formulae.brew.sh` 使用 `Homebrew服务`，默认 `direct`，可手动选择新加坡、美国健康组或 `proxy`。直连失败不自动重放请求；`ghcr.io` 仍使用 GitHub 分流。

## AI：三个独立出口，人工选择

```text
openai.list → OpenAi服务   → 🤖 OpenAI安全节点 → 手动指定节点
claude.list → ClaudeAi服务 → 🧠 Claude安全节点 → 手动指定节点
gemini.list → Gemini      → ✨ Gemini安全节点 → 手动指定节点
```

各候选池使用 `server-tag-regex` 匹配 US / GB / JP / SG / TW（美国、英国、日本、新加坡、台湾），仅按节点标签预筛，不代表实际地区或账号权限已通过验证。首次导入可能默认选到 `reject`，需要手动选择真实节点；以后不会由定时或网络变化事件改写 AI 节点。三个服务可选不同出口；服务异常时由用户手动切换。普通服务的 `available` 健康故障切换机制不受影响。

`[task_local]` 只保留地理位置检测、节点纯净度查询、策略流量查询、服务解锁查询四个手动 `event-interaction`，不调用 `ai-node-sifter.js`。仓库中的筛选脚本仍供 iOS 和既有其他配置使用，macOS 模板不会删除它。独立 `AI应用更新` 不跟随账号出口。

## 更新与验收

1. 备份私人 Profile；将新版模板作为独立测试配置，勿提交私人节点、订阅 Token 或 MITM 凭据。
2. 同步三组 AI 服务父策略、三组候选池、对应三条 `force-policy`，以及四条手动诊断任务；删除 macOS 旧 AI 自动任务和联合安全组。确保无悬空策略引用。
3. 刷新远程规则，手动给三个 AI 池选择实际节点。检查 `chatgpt.com`、`claude.ai`、`gemini.google.com` 分别命中对应策略；确认休眠重连不触发自动 AI 筛选。
4. 验证 `formulae.brew.sh` 的请求命中 `Homebrew服务`。如直连失败，手动切换到新加坡或美国后重试；`brew update` 的其他下载域名可能走其他规则。
5. 确认大陆域名直连、GitHub 故障切换、未知海外站点 `final, proxy` 正常。出现问题可切回备份 Profile。

CI 仅验证配置文本、策略引用与模拟行为，不能代替真实 Quantumult X macOS 的网络/节点测试。