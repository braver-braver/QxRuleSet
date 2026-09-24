# QxRuleSet

个人使用的网络分流覆盖仓库，主要维护 **Quantumult X for macOS** 配置、直连规则和交互脚本，同时保留 HomeProxy 的少量自定义规则。

## 目录

```text
QxRuleSet/
├── quantumultX/
│   ├── qx-macos.conf
│   ├── cn.list
│   └── scripts/
│       └── streaming-ui-check.js
├── homeproxy/
│   ├── customip.json
│   └── customsite.json
└── README.md
```

## Quantumult X

### `quantumultX/qx-macos.conf`

macOS 主配置，包含：

- DNS / DoH
- 策略组与地区节点筛选
- 本地与远程分流
- Rewrite
- event-interaction 脚本

节点订阅、账号、证书和其他敏感信息不放在仓库中。

### `quantumultX/cn.list`

个人 **直连覆盖列表**，用于修正部分博客、开发文档、镜像站等被通用规则错误代理的问题。

该文件在 `qx-macos.conf` 中通过：

```text
force-policy=direct
```

加载，因此这里 **只能维护 direct 规则**。即使在文件内写成 `proxy` 或其他策略，也会被 `force-policy=direct` 覆盖。

需要强制代理的域名应放在 `[filter_local]` 或独立的代理规则资源中。

### `quantumultX/scripts/streaming-ui-check.js`

Quantumult X `event-interaction` 脚本，目前检测：

- Claude Web / API
- ChatGPT Web / OpenAI API
- Gemini Web / API
- Google 网络区域异常
- Netflix
- YouTube Premium
- Disney+

配置入口已写入 `qx-macos.conf` 的 `[task_local]`。

## HomeProxy

`homeproxy/` 保存路由器侧的少量自定义 domain / CIDR 规则。

当前文件：

- `customsite.json`
- `customip.json`

## 维护约定

1. **明确直连的域名**：加入 `quantumultX/cn.list`。
2. **明确代理的域名**：加入 `qx-macos.conf` 的 `[filter_local]`，不要加入 `cn.list`。
3. host / host-suffix 的显式规则应放在 `geoip, cn` 与 `final` 之前。
4. 修改地区策略组时，优先检查 `server-tag-regex`，避免把 JavaScript 风格的 `/i` 修饰符写进 Quantumult X 正则。
5. 修改远程规则后，检查 `force-policy` 是否与文件用途一致。
6. 不提交机场订阅、Token、Cookie、MITM 密码或私钥。

## 上游参考

- Quantumult X 官方示例：`crossutility/Quantumult-X`
- 流媒体检测脚本原始实现：`KOP-XIAO/QuantumultX`

本仓库以个人网络环境为准，不作为通用规则集发布。
