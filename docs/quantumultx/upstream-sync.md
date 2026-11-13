# Quantumult X 上游规则自动同步（定时 GitHub Actions）

## 目标与默认行为

该功能每 **12 小时**审计一次明确选定的 blackmatrix7/ios_rule_script Quantumult X 上游规则。它负责抓取、去重、限定域名归属、比对上次上游摘要、运行本地规则校验，并在有实际变化时更新一个 **待人工审核的 PR**。

- 工作流：[`.github/workflows/qx-upstream-sync.yml`](../../.github/workflows/qx-upstream-sync.yml)
- 维护脚本：[`scripts/sync-qx-upstreams.mjs`](../../scripts/sync-qx-upstreams.mjs)
- 映射与允许域名：[`quantumultX/upstreams.json`](../../quantumultX/upstreams.json)
- 上游摘要（生成文件）：`quantumultX/upstream-state.json`
- 托管规则块：每份被维护的规则集文件尾部 `BEGIN/END QX-UPSTREAM-AUTO` 区域。

**默认不自动合并 PR，不覆写自维护的手写规则，不直接更新用户设备的私人 Profile。** 合并后，需要在 Quantumult X 客户端刷新对应远程规则资源。

## 调度和操作

```yaml
schedule:
  - cron: '23 3,15 * * *'
workflow_dispatch:
```

上述时间为 UTC，每天 03:23 和 15:23；中国标准时间为每天 11:23 和 23:23。GitHub 可能延迟运行，不能把 cron 视为严格实时 SLA。也可到仓库 **Actions → Quantumult X upstream rule sync → Run workflow** 立即触发一次（需选择 main）。

任务顺序：

1. 从官方 `raw.githubusercontent.com/blackmatrix7/ios_rule_script` 获取指定的上游文件，限制 HTTPS、仓库路径、文件大小及最少规则数量；请求失败则整次运行失败，不提交部分结果。
2. 只采纳 `HOST` / `HOST-SUFFIX`，且必须在该服务专属的 `allowSuffixes` 内。拒绝关键词、固定 IP、ASN、User-Agent、通配符、未知域名以及其他策略已占用的域名范围。
3. 原有人工规则始终原样保留；脚本只重新生成自己标记的托管块，避免覆盖自维护的端点、优先级和特例。
4. 更新上游 SHA-256 内容摘要。即使监控类上游只有内部内容变化，也能在变更 PR 中提醒维护者审查。
5. 在创建 PR 之前先运行 `node --test quantumultX/tests/*.test.mjs`；失败直接终止、不提交。
6. 对变更只使用机器人分支 `automation/qx-upstream-sync` 创建或更新一个 PR。分支有人工提交时拒绝覆盖；对同一棵文件树不重复推送；只有手动审核后才能合并。

## 覆盖范围

| 服务 | 自动处理策略 |
| --- | --- |
| GitHub | 只纳入 GitHub / GitHub Pages / ghcr / Dependabot 等可归属域名 |
| Bilibili | 只纳入 Bilibili 自有域名；不擅自扩大 PCDN/IP/第三方 CDN 范围 |
| YouTube | YouTube、ytimg、googlevideo 等已明确归属的域名；不自动添加通用 Google CDN |
| Spotify | 只纳入 Spotify 自有域名；共享 CDN 需单独审查 |
| OpenAI / Claude / Gemini | 保持三个服务的策略隔离；不自动代理共享 Cloudflare/Auth0/Stripe/Google 基础设施 |
| Apple / Google / Microsoft | **仅记录上游 SHA-256 和域名规则数量变化**，不自动复制上千条跨产品域名 |

当前自维护的 Apple 更新、Apple TV、AI 应用更新、GitHub Pages 优先、Bilibili 视频 CDN、可选 PCDN、广告及纠错规则继续人工维护。**不要把大体积上游合集直接当作自己的单一全局规则集。**

## PR 审核检查

PR 中首先查看：

1. `quantumultX/rules/**` 里 **新增/移除的托管块**，确认确属本服务，且不会改变 GitHub Pages、Bilibili 直播/视频或 AI 登录的既有策略。
2. `quantumultX/upstream-state.json` 是否只有可信上游的内容摘要与计数变化；SHA 变化是「源文件变了」，**不等于需要全部采用**。
3. 上游规则是否带有广泛 `HOST-KEYWORD`、IP 段、共享 CDN；这些会被忽略，如确有需求应独立评估后手工维护。
4. CI 是否通过，并按需在 iOS/macOS Quantumult X 上用真实节点进行请求日志和播放 A/B 验证。

如果上游内容异常、文件地址不存在、规则量骤降，维护工作流应失败并保留原文件；到 Actions 查看失败步骤后处理，**不要放宽安全阈值来强行绿灯**。

## 仓库所有者首次启用

此工作流只使用 GitHub 内置的 `GITHUB_TOKEN`，**不需要创建 PAT，也不需要存储机场订阅链接**。

但机器人要自动建 PR，需要在仓库 **Settings → Actions → General → Workflow permissions** 中开启 **Allow GitHub Actions to create and approve pull requests**。如果该选项未开启，规则巡检和测试仍可以运行，但最后建 PR 会因权限受限而失败。工作流声明了最低所需的 `contents: write` 与 `pull-requests: write`。

由 `GITHUB_TOKEN` 创建或更新的 PR，GitHub 可能要求仓库管理员手动 **Approve workflows to run** 才执行相关 PR CI；不过同步工作流在创建 PR 之前，已经独立执行一遍完整规则测试。不要把审批提示当成规则测试失败。

新工作流合入 `main` 时，其受路径限制的 `push` 触发器会先执行一次**端到端上游同步**；后续按计划定时执行，也可手动 `workflow_dispatch`。GitHub 的定时任务仅在工作流文件进入默认分支后才会触发；公共仓库若连续 60 天无活动，GitHub 可能自动停用 schedule，需要重新启用。

## 手动复现

```bash
node --test quantumultX/tests/*.test.mjs
node scripts/sync-qx-upstreams.mjs                       # 只预览，不写文件
node scripts/sync-qx-upstreams.mjs --apply                # 写入本地托管块与 SHA 状态
```

手动 `--apply` 在你自己的工作目录会修改规则文件，请确认没有未提交的私人改动后再运行。**不要把自己的完整节点订阅或 MITM 私钥提交到公共仓库。**
