# Quantumult X 版本定位与增量升级

## 2026-10-11 上游变化与本地同步

**上游客户端（不同于本仓库模板）**：

- iOS **App Store 1.8.1** 于 2026-10-07 发布；可选的 **TestFlight 1.9.0 (952)** 于 2026-10-08 公告，适用于 iOS/tvOS/macOS。未安装测试版也无需改变当前基础分流。
- KOP-XIAO 的 `resource-parser.js` 于 2026-10-09 更新至 `29ef748`；两份 QX 模板均已使用其 `master` 原始 URL，**无需替换 URL**，但必须在客户端刷新解析器缓存。
- build 950+ 支持分流/Rewrite 行首 `{# note #}` 说明；build 951+ 支持本地/iCloud 资源路径附加 `#` 参数；build 952 提供 `reflected_routes`。本仓库没有默认加入这些可能影响旧版兼容的可选配置。
- 自维护的服务解锁脚本仍为 **v3.2.0**；其来源 `KOP-XIAO/Scripts/streaming-ui-check.js` 最后提交于 2023-06-30，没有需要复制的新版代码。

**把 GitHub 仓库改动同步到你自己的工作目录**（前提是目录是 Git clone，且已处理本地未提交修改）：

```bash
cd /path/to/QxRuleSet
git status --short
git fetch origin main
git log --oneline HEAD..origin/main
git pull --ff-only origin main
```

`git pull` 只更新该 Git 工作目录，**不会更新 Quantumult X 当前已导入的 Profile**。若工作目录有未提交的自用配置，应先手工备份并比对；不要使用 `git reset --hard` 或直接覆盖 `quantumultX.conf`。

**在 iPhone / Mac 的 QX 客户端完成更新**：

1. 先检查 QX App 版本；是否升级 TestFlight 由你自行决定，稳定配置不要求 952。
2. 在 QX 配置/资源管理中，**刷新自定义资源解析器**（`resource_parser_url`）及所需远程资源；如果使用的是旧缓存，GitHub 的 `master` 更新不会立即反映。
3. 重新获取远程 `streaming-ui-check.js`，手动运行「服务解锁查询」确认 v3.2.0 输出；同时核查任务选择的实际策略出口。
4. 对比仓库的 `qx-ios.conf` / `qx-macos.conf` 与你自己的私有 Profile，**只迁移需要的 section**，不要覆盖订阅 URL、MITM 配置或个人策略。
5. 如果不使用本地/iCloud 资源路径或自定义注释，**新解析器功能无需修改现有规则**。

源代码：[KOP-XIAO parser commit](https://github.com/KOP-XIAO/QuantumultX/commit/29ef7480402d145396c84082a6f9316fe12931d4)；客户端公告：[@QuanXNews](https://t.me/QuanXNews)。


## 如何查看正在使用的配置版本

从 2026-10-08 起，macOS 和 iOS 模板在文件开头统一写入：

```ini
# QxRuleSet-Template-Version: 2026.10.08.1
# QxRuleSet-Template-Updated-At: 2026-10-08T15:45:03+08:00
# QxRuleSet-Template-Platform: macOS
```

iOS 的最后一行是 `iOS`。

- **Template-Version** 使用 `YYYY.MM.DD.N`（同日迭代递增 N）。
- **Updated-At** 使用 ISO 8601，时区为北京时间（UTC+08:00）；它表示模板维护时间，不是配置导入时间。
- 两个平台可以共享同一天的发布批次号，但各自内容独立。
- 版本只记录在模板的**注释**中，不会改变 Quantumult X 的解析行为。
- `main` 更新 **不会自动升级**已经复制、导入或编辑的私人 `quantumultX.conf`。

macOS 本地检查（按你的实际目录调整）：

```bash
grep -E '^# QxRuleSet-Template-(Version|Updated-At|Platform):' quantumultX/quantumultX.conf
```

如果没有输出，它是**未加版本标记的旧文件**，不能仅凭“约两周前”准确确定 commit。请对照下面的功能签名，或对比实际文件与 Git 历史版本。

## 旧配置快速定位

| 功能签名 | 能判断什么 |
| --- | --- |
| `server_check_url=http://captive.apple.com/` | 常见于 2026-09-24 版本，尚未切换 `generate_204` |
| 没有 `static=🤖 OpenAI安全节点` | 尚未启用 2026-09-30 的独立 AI 安全节点池 |
| 有 `ai-node-sifter.js#provider=openai`，但没有 `&mode=sticky` | 已经有安全池，但没有 2026-10-08 的 macOS 恢复策略 |
| 有 `&mode=sticky`，但没有 `event-network` | 缺少开盖/切换网络后的即时复核任务 |
| 没有 `rules/services/media.list` | 国际媒体分流未启用 |
| 文件开头有 `QxRuleSet-Template-Version` | 可直接用版本号定位后续维护变更 |

## 只修复 macOS 开盖后 AI 落回 reject

**适用前提**：你的本地配置已经包含下面全部定义：

- `static=🤖 OpenAI安全节点`、`static=🧠 Claude安全节点`、`static=✨ Gemini安全节点`
- `static=OpenAi服务, 🤖 OpenAI安全节点, reject` 等父策略
- `[filter_remote]` 中已经加载 `rules/ai/openai.list` / `claude.list` / `gemini.list`
- `[task_local]` 已经指向本仓库的 `ai-node-sifter.js`

如果上述条件成立，**只需修改 `[task_local]`，不需要重新导入整个模板**。

将原来 OpenAI / Claude / Gemini 的三条手动 `event-interaction` 和三条定时任务中的 `#provider=...` 改成 `#provider=...&mode=sticky`，再新增以下网络事件任务（请放入已有 `[task_local]`，不要再加第二个同名 section）：

```ini
event-network https://raw.githubusercontent.com/braver-braver/QxRuleSet/refs/heads/main/quantumultX/scripts/ai-node-sifter.js#provider=openai&mode=sticky&trigger=network&delay=4, tag=OpenAI 网络恢复复核, enabled=true
event-network https://raw.githubusercontent.com/braver-braver/QxRuleSet/refs/heads/main/quantumultX/scripts/ai-node-sifter.js#provider=claude&mode=sticky&trigger=network&delay=7, tag=Claude 网络恢复复核, enabled=true
event-network https://raw.githubusercontent.com/braver-braver/QxRuleSet/refs/heads/main/quantumultX/scripts/ai-node-sifter.js#provider=gemini&mode=sticky&trigger=network&delay=10, tag=Gemini 网络恢复复核, enabled=true
```

脚本地址本来就是仓库 `main` 的远程 JS：无需把整个 JS 源码复制进本地；**确保 QX 实际加载的是最新版脚本**（如需更新，请在 QX 重新执行/刷新对应任务）。

首次升级后分别手动执行三项“安全节点”任务，验证 `PASS` 并建立 `last-known-good`。否则首次开盖时可能没有历史节点可恢复。

遇到明确不受支持的出口或所有候选均不可用时，可能仍无法恢复可用节点；`sticky` 只避免**瞬时不确定状态**误导致策略重置，不保证自动解锁。

## 如果你的版本是约 2026-09-24 的 macOS 配置

**不能仅粘贴上面三条 `event-network` 就完成升级**：当时尚未具备完整的 AI 安全池和自维护服务规则。

至少检查这些现有 section 的改动：

| section | 必须做的事情 |
| --- | --- |
| 文件开头 | 添加新的版本标记（迁移完成时使用实际采用的模板版本） |
| `[general]` | `server_check_url` 改为 `http://www.gstatic.com/generate_204`；检查是否仍主动限定 `udp_whitelist`；评估旧的 GitHub DNS 例外和 `17.0.0.0/8` 排除路由 |
| `[task_local]` | 加入三个 AI 手动任务、三条定时任务和三条 `event-network`，全部 macOS AI 任务启用 `mode=sticky` |
| `[policy]` | 将旧 `OpenAi服务/ClaudeAi服务/Gemini` 父策略改成对应独立安全池，并加入三个 `server-tag-regex` 候选池；可增加 `国际媒体` |
| `[filter_remote]` | 加载 `rules/ai/updates.list`、三个 AI provider ruleset 以及各类自维护服务规则；媒体使用 `rules/services/media.list` |
| `[filter_local]` | 检查旧的重复/抢优先级规则（社交、AI 更新、通用 Google 等），迁移时必须删掉或修正，不是直接把新版远程规则追加到底部 |
| `[rewrite_remote]` | 如不准备启用 MITM，确保 HTTPS Rewrite 资源默认关闭 |

尤其要**替换旧策略定义**，不能同时留两个同名 `static=OpenAi服务` 或在未创建安全池前直接引用它。

### 安全完整迁移（推荐给 9 月下旬的旧配置）

1. **保留**现有 `quantumultX/quantumultX.conf`，先另行备份；**不要直接执行** `cp qx-macos.conf quantumultX.conf` 覆盖正在使用的文件。
2. 以最新版 `qx-macos.conf` 为基础创建一个*新的私有测试配置*，不要编辑原文件。
3. 从旧配置手工迁移 `[server_remote]` 订阅、必要的 `[server_local]` 节点、`[mitm]` 自用配置及真实存在的本地特殊规则；不要覆盖新版 `[policy]`、`[filter_remote]`。
4. 导入为 QX 的另一个测试 Profile，检查地区组、AI 服务、国际媒体和 App 更新。
5. 测试后再决定是否切换长期使用的 Profile。

运行 `git diff --no-index` 对比旧文件和新模板时会看到私人订阅 URL；**请只在本机执行，不要将完整 diff 上传到公开仓库或 PR**。

## 国际媒体补丁（若仅缺这一项）

在 `[policy]` 中追加 `static=国际媒体`，优先选择新加坡，保留英国、日本、美国等地区选项。

在 `[filter_remote]` 的广告过滤资源之后加入：

```ini
https://raw.githubusercontent.com/braver-braver/QxRuleSet/refs/heads/main/quantumultX/rules/services/media.list, tag=国际媒体, force-policy=国际媒体, update-interval=86400, opt-parser=false, enabled=true
```

注意：`force-policy=国际媒体` 所引用的策略组必须事先存在。完整 `static=国际媒体` 行可直接从当前 `qx-macos.conf` 对应 `[policy]` 中复制，避免名称或候选项拼写不一致。

## 验证清单

1. 在**当前实际导入**的 Profile 中查看版本标记（仅更新 Git 仓库模板并不会更新私有 Profile）。
2. 刷新节点订阅和远程过滤资源，检查 `generate_204` 响应。
3. 手动运行 AI 安全节点任务，确认选中实际节点而非 `reject`。
4. 合盖/断开 Wi-Fi/开盖恢复，观察 `event-network` 是否触发、原节点是否保持；若当前节点不可用，检查 QX 通知。
5. 测试 BBC、Zaobao 命中 `国际媒体`，ChatGPT/Claude/Gemini 命中各自服务策略。
6. 测试 Mac 的 ChatGPT/Codex/Claude 更新流量是否命中 `AI应用更新`。
