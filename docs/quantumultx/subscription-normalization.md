# 订阅节点规范化

模板：`quantumultX/templates/subscription-normalization.conf.example`

## 什么时候需要

默认情况下，不需要修改机场节点名称。

本仓库的地区策略和 AI 安全节点池已经能够识别常见标签，例如：

- 香港 / HK / HKG / Hong Kong
- 台湾 / TW / Taiwan
- 日本 / JP / Japan
- 新加坡 / SG / Singapore
- 韩国 / KR / Korea
- 美国 / US / United States
- 英国 / UK / GB / United Kingdom

只有当机场使用无法识别的自定义名称时，才建议使用订阅规范化。

例如：

```text
Premium 洛杉矶 A
IEPL 圣何塞 02
高级 东京 B
```

可以在资源解析阶段将地名统一成稳定 token：

```text
Premium US A
IEPL US 02
高级 JP B
```

这样地区策略组和 AI 安全节点池都更容易匹配。

## 依赖

规范化使用当前配置中的 KOP-XIAO resource parser：

```text
resource_parser_url=https://raw.githubusercontent.com/KOP-XIAO/QuantumultX/master/Scripts/resource-parser.js
```

订阅行必须使用：

```text
opt-parser=true
```

如果机场已经直接提供 Quantumult X 原生节点，并且不需要解析器，不建议为了规范化强行开启复杂处理。

## `out`

KOP-XIAO parser 的 `out` 用于按节点名称删除整条节点，多关键词使用 `+` 连接。

例如：

```text
#out=剩余+套餐+流量+到期+官网+注册+重置
```

适合过滤机场订阅里常见的非代理节点：剩余流量、套餐到期、官网、注册提示等。

### `delreg` 与 `out` 的区别

`delreg=<regex>` 是从**节点名称内部删除匹配字段**，并不会删除整条节点。

因此对“剩余流量”“套餐到期”这类伪节点，优先使用 `out=`；只有确实需要清理节点名称中的装饰字段时才使用 `delreg`。

## `rename`

parser 的节点重命名格式为：

```text
rename=旧名@新名+旧名@新名+...
```

多个替换使用 `+` 连接。

例如：

```text
rename=洛杉矶@US+圣何塞@US+西雅图@US+东京@JP+大阪@JP+新加坡@SG+伦敦@UK
```

结合订阅：

```text
https://YOUR_SUBSCRIPTION_URL#rename=洛杉矶@US+圣何塞@US+西雅图@US+东京@JP+大阪@JP+新加坡@SG+伦敦@UK, tag=Normalized Subscription, opt-parser=true, update-interval=86400, enabled=true
```

也可以同时使用 `out` 过滤非节点条目：

```text
https://YOUR_SUBSCRIPTION_URL#out=剩余+套餐+流量+到期+官网+注册+重置&rename=洛杉矶@US+圣何塞@US+西雅图@US+东京@JP+大阪@JP+新加坡@SG+伦敦@UK, tag=Normalized Subscription, opt-parser=true, update-interval=86400, enabled=true
```

## 与 AI 安全节点的关系

规范化只是帮助 `server-tag-regex` 发现候选节点。

它不会替代 AI 安全检查。AI 节点仍然会经过：

```text
节点名称预筛
    ↓
真实出口地区检测
    ↓
OpenAI / Claude / Gemini Web 检测
    ↓
API 可达性检测
    ↓
PASS / FAIL / UNCERTAIN
```

因此即使把 `洛杉矶` 改成 `US`，脚本仍然以实际出口和服务响应为准。

## 不要猜测不透明节点

例如机场只有：

```text
Premium-A
Premium-B
IEPL-03
```

而没有任何地区信息时，不应该人为猜测 `Premium-A -> US`。

这种情况有两个更合适的处理办法：

1. 根据机场明确提供的地区对应关系写专属 `rename` 映射。
2. 根据实际节点命名规则调整本地 `server-tag-regex`。

AI 安全脚本最终仍会检查真实出口，因此不要把名称规范化当成安全判断。

## 推荐原则

1. 能不改名就不改名。
2. 只规范化确定含义的地区标签。
3. 优先统一为短 token：`US / GB / JP / SG / HK / TW / KR`。
4. `out` 用于过滤明确的非节点条目；`delreg` 仅用于清理节点名称内部字段。
5. 修改后先检查地区策略组是否正确出现节点，再运行 AI 安全节点任务。
