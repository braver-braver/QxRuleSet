# 维护约定

## Quantumult X

- 直连覆盖：维护在 [`quantumultX/cn.list`](../quantumultX/cn.list)。
- 显式代理覆盖：维护在 [`quantumultX/qx-macos.conf`](../quantumultX/qx-macos.conf) 的 `[filter_local]`。
- 远程规则：检查 `force-policy` 是否与规则用途一致。
- 地区节点：修改 `server-tag-regex` 后检查大小写修饰符和排除表达式。
- 脚本：修改后至少做 JavaScript 语法检查。

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
