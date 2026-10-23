# Quantumult X 节点故障恢复：第一阶段

**上线基线：2026-10-23（iOS/macOS 模板 `2026.10.23.1`）**

目标：节点频繁掉线时，常见服务不要长时间依赖旧的地区手选节点。此阶段只调整 QX 原生策略，不运行自动修改策略的后台 JS，不接触私人订阅凭据，不改变 AI 安全节点池。

## 策略层次与行为

```text
常见服务规则（原 force-policy 保持不变）
  ├── 国际媒体 / 社交媒体 / GitHub / 油管 / Bing（static 父组）
  │    └── 🌍 跨区顺选·健康（available，默认项）
  │         └── 按订阅节点顺序挑选首个通用测速可用的地区节点
  │
  ├── 谷歌服务 / 全球策略（static 父组）
  │    ├── 原有地区优选·延迟（url-latency-benchmark，默认项）
  │    └── 🌍 跨区顺选·健康（新增手动备选）
  │
  └── OpenAI / Claude / Gemini（安全节点 + reject）不变
```

- **available**：根据 `[general]` 中的 `server_check_url=http://www.gstatic.com/generate_204` 和 `server_check_timeout=3000`，选择第一个能够完成通用检测的节点。当已选择的出口失效并且该组有实际连接请求时，QX 会检测其他候选节点；它**不支持**将 `check-interval` / `tolerance` 当成测速组参数使用，因此模板移除了这类无效参数。
- **url-latency-benchmark**：9 个已有优选组改为 `check-interval=300, tolerance=100, alive-checking=false`。只有策略处于活跃状态时才进行周期测速；空闲时不主动后台轮询，避免手机耗电和高频请求。
- **static 父组**：保留各地区选项及 `proxy` / `direct` 等原有手动备选。**不同 static 选项之间不会因为网络失败而自动往后跳**；自动故障切换发生在所选 `available` / `url-latency-benchmark` 子组内部。

QX 官方语义参考：[crossutility/Quantumult-X sample.conf](https://github.com/crossutility/Quantumult-X/blob/master/sample.conf)。

### 跨区候选筛选

`🌍 跨区顺选·健康` 只匹配常见香港、台湾、日本、新加坡、韩国、美国、英国等地区的节点名称，过滤 `NeteaseMusic`、`剩余`、`套餐`、`官网`、`到期` 等常见伪节点文字，以降低误选套餐信息的风险。

- 地区英文名称和缩写不区分大小写，例如 `🇯🇵 日本-01`、`US-01`、`sg-02`、`singapore-01`、`JaPaN-01`；非节点排除规则保持原样。
- **对于仅有 `Premium-001` 这种无地区标签的订阅，此池可能为空。** 可以先在 QX 手动选择 `🚇 全部优选·延迟` 或 `proxy`，待确认机场实际命名后再调整归属正则。
- `🚇 全部优选·延迟` 仍允许不带地区名称的普通节点，只加强套餐/流量等非节点标签过滤；这是通用连通性备选，而非 AI 地区安全池。

### 不能解决的情形

- BBC / Netflix / YouTube 等服务可能在通用 `generate_204` 正常时拒绝当前 IP。第一阶段**不等于服务级解锁检测**，第二阶段才处理服务健康与隔离。
- 高延迟、IP 风控、同一节点名称背后变更出口 IP、机场全线路故障，无法保证被自动切换消除。
- 不会主动断开、重建现有 TCP/QUIC 会话。切换后，原本出错的网页或 App 可能需要重新连接。
- AI 身份验证/地区安全不能只根据 Google 连通性判定；`🤖 OpenAI安全节点`、`🧠 Claude安全节点`、`✨ Gemini安全节点` 和 `reject` 均保持原样。

## iOS / macOS 迁移与验证

`main` 上的配置模板**不会自动替换你已经导入 QX 的私人 Profile**。

1. 在 iOS/macOS QX 内先备份当前 Profile，单独建立测试 Profile；不要覆盖现有订阅 URL、证书和私有规则。
2. 从仓库新的 `qx-ios.conf` / `qx-macos.conf` 迁移 `[policy]` 中修改的策略行，保留你个人的 `[server_remote]` 等设置；检查模板版本为 `2026.10.23.1`。
3. 刷新远程订阅和节点测速，确认至少一个节点被 `🌍 跨区顺选·健康` 识别。
4. **手动检查父策略的实际选中项**：QX 可能记住旧选择，必须分别确认 `国际媒体`、`社交媒体`、`GitHub服务`、`油管服务`、`Bing服务` 使用新 `🌍 跨区顺选·健康`；仅调整 `static=` 候选顺序不能覆盖持久化的旧选择。
5. 用一个正常节点验证 BBC News、YouTube、GitHub；再在测试订阅中模拟一个常规连接不可用的节点并重试，观察该池是否选到其他可用节点。**避免通过关闭整个订阅来测试**，那会使全部候选一同消失。
6. 确认 `OpenAi服务`、`ClaudeAi服务`、`Gemini` 仍指向对应安全节点池，`reject` 行为未变化；不要在这些组中加入跨区兜底。
7. 若自动节点池误判，暂时在对应父组中选择一个已验证的地区节点，或者回滚到之前备份的 Profile。

此阶段 CI 使用纯 Node.js 测试验证：策略分组唯一性、节点正则样例、无效 `available` 选项清理、300 秒活跃测速、服务父组默认项、显式手动退路以及 AI fail-closed 约束。**CI 无法替代 QX 设备端的节点连通性验证。**

## 第二阶段（不在本 PR）

在独立 PR 中改造 `ai-node-sifter.js`，以连续失败确认、故障隔离、冷却期、最近成功节点及优先同地区恢复避免旧 sticky 模式长期保留失效出口。服务级 BBC 等探测需要单独定义目标与证据等级。
