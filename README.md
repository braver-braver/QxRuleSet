# QxRuleSet

## Repository

```text
QxRuleSet/
├── docs/
│   ├── homeproxy.md
│   ├── maintenance.md
│   ├── mihomo/
│   │   └── setup.md
│   └── quantumultx/
│       ├── ai-node-sifter.md
│       ├── ai-rules.md
│       ├── configuration.md
│       ├── dependencies.md
│       ├── openai.md
│       ├── rules.md
│       ├── setup.md
│       ├── service-rules.md
│       ├── streaming-ui-check.md
│       └── subscription-normalization.md
├── homeproxy/
│   ├── customip.json
│   └── customsite.json
├── mihomo/
│   ├── clash-party-override.js
│   └── rules/
│       ├── claude.yaml
│       ├── direct.yaml
│       ├── gemini.yaml
│       ├── media.yaml
│       └── openai.yaml
└── quantumultX/
    ├── cn.list
    ├── qx-ios.conf
    ├── qx-macos.conf
    ├── rules/
    │   ├── ai/
    │   │   ├── claude.list
    │   │   ├── gemini.list
    │   │   ├── openai.list
    │   │   └── updates.list
    │   ├── corrections/
    │   │   └── direct.list
    │   └── services/
    │       ├── apple.list
    │       ├── appletv.list
    │       ├── bilibili.list
    │       ├── bing.list
    │       ├── github.list
    │       ├── google.list
    │       ├── microsoft.list
    │       ├── social.list
    │       ├── spotify.list
    │       ├── wechat.list
    │       └── youtube.list
    ├── scripts/
    │   ├── ai-node-sifter.js
    │   └── streaming-ui-check.js
    └── templates/
        └── subscription-normalization.conf.example
```

## Documentation

- [Quantumult X 配置](docs/quantumultx/configuration.md)
- [从模板到可用配置](docs/quantumultx/setup.md)
- [外部依赖策略](docs/quantumultx/dependencies.md)
- [Quantumult X 规则维护](docs/quantumultx/rules.md)
- [AI 分流规则集](docs/quantumultx/ai-rules.md)
- [AI 安全节点筛选](docs/quantumultx/ai-node-sifter.md)
- [通用服务分流规则集](docs/quantumultx/service-rules.md)
- [OpenAI / ChatGPT 分流与更新链路](docs/quantumultx/openai.md)
- [服务解锁检测脚本](docs/quantumultx/streaming-ui-check.md)
- [订阅节点规范化](docs/quantumultx/subscription-normalization.md)
- [Mihomo / Clash Party（Windows）](docs/mihomo/setup.md)
- [HomeProxy](docs/homeproxy.md)
- [维护约定](docs/maintenance.md)
