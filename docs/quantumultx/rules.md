# Quantumult X 规则维护

规则文件：[`quantumultX/cn.list`](../../quantumultX/cn.list)

## 定位

`cn.list` 是个人 **直连覆盖规则**，用于修正部分博客、开发文档、镜像站等被通用规则错误代理的问题。

当前由 `qx-macos.conf` 通过以下方式加载：

```text
force-policy=direct
```

因此该文件只维护 `direct` 规则。

## 规则约定

允许：

```text
HOST,example.com,direct
HOST-SUFFIX,example.com,direct
```

不应加入：

```text
HOST-SUFFIX,example.com,proxy
HOST-SUFFIX,example.com,reject
```

因为 `force-policy=direct` 会覆盖文件内指定的策略。

## 代理覆盖

明确需要代理的域名，应放到：

[`quantumultX/qx-macos.conf`](../../quantumultX/qx-macos.conf)

的 `[filter_local]` 中，或者拆成独立的代理规则资源。

## 维护检查

新增规则前至少确认：

1. 规则确实存在错误分流。
2. `HOST` 与 `HOST-SUFFIX` 粒度是否合适。
3. 是否已存在重复规则。
4. 是否会覆盖已有的 AI、GitHub、Google 等专用策略。
5. 是否真的应该长期直连，而不是暂时性排障规则。
