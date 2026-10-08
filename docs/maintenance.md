# 维护约定

## Quantumult X

- 直连覆盖：维护在 [`quantumultX/cn.list`](../quantumultX/cn.list)。
- 显式代理覆盖：维护在 [`quantumultX/qx-macos.conf`](../quantumultX/qx-macos.conf) 的 `[filter_local]`。
- 远程规则：检查 `force-policy` 是否与规则用途一致。
- 地区节点：修改 `server-tag-regex` 后检查大小写修饰符和排除表达式。
- 脚本：修改后至少做 JavaScript 语法检查。

## 模板版本标记

`quantumultX/qx-macos.conf` 与 `quantumultX/qx-ios.conf` 顶部必须同步保留**仅作为注释**的三个字段：

```text
# QxRuleSet-Template-Version: YYYY.MM.DD.N
# QxRuleSet-Template-Updated-At: YYYY-MM-DDTHH:mm:ss+08:00
# QxRuleSet-Template-Platform: macOS / iOS
```

- 版本使用 CalVer；同一日期发生多次独立模板维护时递增最后一位。
- 任何影响路由/策略/DNS/任务的模板变更都应同步更新版本号与更新时间；仅文档改动不需要修改模板标记。
- 时间戳统一使用 ISO 8601 UTC+08:00，不得用未注明时区的本地时间。
- iOS 与 macOS 分别维护版本；不要将版本标记误写成 QX App 本身的版本号。
- 旧文件未含这些字段时标注为 legacy/unversioned；**不要根据用户估计日期反填不准确的版本**。
- 只在完成新版块升级后更新用户本地私有配置顶部的版本信息，不能仅修改注释就声明已经升级。
- 详细步骤参阅 [版本定位与增量升级](quantumultx/upgrade.md)。

## 不主动改动的本地行为

以下设置可能与具体网络环境有关，审计时不能仅因为“看起来不常见”就直接修改：

- `excluded_routes`
- `dns_exclusion_list`
- `udp_whitelist`
- `fallback_udp_policy`
- SSID 触发策略
- 本机专用网段或节点命名规则

## 提交约定

优先：

1. 从 `main` 创建维护分支。
2. 将规则修复、脚本修复和文档变更拆成可读提交。
3. 通过 PR 合入。
4. 不在未验证时做大规模规则重排。

## 安全

禁止提交：

- 节点订阅地址中的私密凭据
- Token / API Key
- Cookie
- MITM 密码
- 私钥
- 账号口令
