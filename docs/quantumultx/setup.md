# 从模板到可用配置

## 选择模板

macOS：

```text
quantumultX/qx-macos.conf
```

iPhone / iOS：

```text
quantumultX/qx-ios.conf
```

两份配置共用同一套 ruleset，但有明确的端侧差异。

### macOS

macOS 版本会加载：

```text
rules/ai/updates.list
```

用于 ChatGPT / Codex / Claude Desktop 等桌面应用的更新检查和安装包下载。

### iPhone

iPhone 版本不加载桌面更新 ruleset。

iOS App 更新由 App Store / Apple 服务处理，因此没有必要让手机访问 ChatGPT/Codex Desktop 的 Sparkle appcast。

## 创建私有配置

不要直接把订阅地址或 MITM 私钥写进 Git 跟踪的模板。

macOS 可以复制：

```bash
cp quantumultX/qx-macos.conf quantumultX/qx-macos.private.conf
```

iPhone 配置可以复制为：

```text
quantumultX/qx-ios.private.conf
```

`.gitignore` 已忽略：

```text
quantumultX/*.private.conf
quantumultX/private/
```

## 1. 填写节点订阅

找到：

```text
[server_remote]
```

模板中已经预留：

```text
# https://YOUR_SUBSCRIPTION_URL, tag=Main Subscription, opt-parser=true, update-interval=86400, enabled=true
```

替换 URL，并去掉开头的 `#`：

```text
https://example.com/your-subscription, tag=Main Subscription, opt-parser=true, update-interval=86400, enabled=true
```

如果有第二个订阅，可以继续增加一行。

`opt-parser=true` 依赖主配置中的 `resource_parser_url`，适合常见机场订阅格式。

## 2. MITM

只有启用了需要 HTTPS MITM 的 rewrite/script 时才需要填写。

找到：

```text
[mitm]
```

按 Quantumult X 导出的实际证书信息填写，例如：

```text
passphrase = YOUR_P12_PASSWORD
p12 = YOUR_BASE64_P12
hostname = YOUR_MITM_HOSTNAMES
```

如果当前只使用分流规则、策略组和 event-interaction，不需要 MITM，可以保持注释状态。

## 3. 导入 Quantumult X

最终实际使用的是私有副本，例如：

```text
qx-macos.private.conf
qx-ios.private.conf
```

导入后检查：

1. 节点订阅是否能成功更新。
2. `地区优选·延迟` 等正则策略组是否能识别你的节点命名。
3. OpenAI / Claude / Gemini 是否进入对应策略。
4. macOS 下 ChatGPT / Codex 更新是否命中 `AI应用更新`。
5. iPhone 下 App Store 和 Apple 服务是否正常。
6. YouTube 是否命中 `油管服务`，而不是被通用 Google 规则提前匹配。

## 节点命名兼容性

配置不再依赖：

```text
美国 01
香港 01
新加坡 02
```

这类固定节点名。

地区策略通过 `server-tag-regex` 匹配常见命名：

- 香港 / HK / Hong Kong
- 台湾 / TW / Taiwan
- 日本 / JP / Japan
- 新加坡 / SG / Singapore
- 韩国 / KR / Korea
- 美国 / US / States
- 英国 / UK / Britain

因此更换机场时通常只需要替换订阅 URL。

如果机场采用完全不同的节点命名，只需要调整地区策略组的 `server-tag-regex`，不需要修改 ruleset。

## 私密信息原则

不要提交：

- 机场订阅 URL
- 订阅 Token
- P12
- P12 passphrase
- MITM 私钥
- Cookie
- API Key
- 个人设备专用凭据
