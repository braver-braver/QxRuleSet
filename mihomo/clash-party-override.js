// QxRuleSet - Clash Party / Mihomo override
// version: 0.2.0
// updated: 2026-10-09
//
// Intended for Clash Party on Windows using the regular Mihomo core.
// Subscription URLs and proxy nodes remain managed by Clash Party.
// This override replaces proxy groups/rules, but keeps the subscription's
// actual proxies intact.

const RULE_BASE =
  "https://raw.githubusercontent.com/braver-braver/QxRuleSet/refs/heads/main/mihomo/rules";

const HEALTH_URL = "https://www.gstatic.com/generate_204";
const NODE_EXCLUDE =
  "(?i)(NeteaseMusic|网易云|免费|白嫖|官网|剩余|套餐|流量|到期|注册|重置|刷新|付费|网址|群|帐户|账户|Traffic|Expire|Expiry|Subscription)";

const REGION = {
  HK: "(?i)(🇭🇰|香港|Hong Kong|\\bHKG\\b|\\bHK\\b)",
  TW: "(?i)(🇹🇼|台湾|台灣|Taiwan|\\bTPE\\b|\\bTW\\b)",
  JP: "(?i)(🇯🇵|日本|Japan|\\b(?:NRT|HND|KIX|JP)\\b)",
  SG: "(?i)(🇸🇬|新加坡|狮城|獅城|Singapore|\\bSIN\\b|\\bSG\\b)",
  KR: "(?i)(🇰🇷|韩国|韓國|首尔|首爾|Korea|Seoul|\\bKOR\\b|\\bKR\\b)",
  US: "(?i)(🇺🇸|美国|美國|United States|\\bUSA\\b|\\b(?:LAX|SJC|SFO|SEA|JFK|IAD|US)\\b)",
  GB: "(?i)(🇬🇧|英国|英國|United Kingdom|Britain|London|伦敦|倫敦|\\bUK\\b|\\bGB\\b)",
};

// Keep AI region qualification consistent with the individual region groups.
const AI_REGION =
  "(?i)(?:" +
  ["US", "GB", "JP", "SG"]
    .map((region) => REGION[region].replace(/^\(\?i\)/, ""))
    .join("|") +
  ")";

function urlTest(name, filter, extra = {}) {
  return Object.assign(
    {
      name,
      type: "url-test",
      "include-all": true,
      filter,
      "exclude-filter": NODE_EXCLUDE,
      "exclude-type": "Direct|Reject|Compatible",
      url: HEALTH_URL,
      interval: 300,
      lazy: true,
      tolerance: 80,
      timeout: 5000,
      "max-failed-times": 2,
      "expected-status": 204,
      "empty-fallback": "REJECT",
    },
    extra,
  );
}

function select(name, proxies, extra = {}) {
  return Object.assign(
    {
      name,
      type: "select",
      proxies,
      "empty-fallback": "REJECT",
    },
    extra,
  );
}

function customRuleProvider(file, bootstrapGroup) {
  return {
    type: "http",
    behavior: "classical",
    format: "yaml",
    path: `./ruleset/qxr-${file}.yaml`,
    url: `${RULE_BASE}/${file}.yaml`,
    interval: 86400,
    proxy: bootstrapGroup,
  };
}

function main(config) {
  if (!config || typeof config !== "object") return config;

  // Never shadow a subscription's PROXY group: it can back chained nodes.
  const originalGroups = Array.isArray(config["proxy-groups"])
    ? config["proxy-groups"]
    : [];
  const occupied = new Set(originalGroups.filter((g) => g && typeof g.name === "string").map((g) => g.name));
  const bootstrapBase = "__QXR_BOOTSTRAP__";
  let bootstrapGroup = bootstrapBase;
  for (let n = 1; occupied.has(bootstrapGroup); n += 1) {
    bootstrapGroup = `__QXR_BOOTSTRAP_${n}__`;
  }

  // Core behavior. Do not set ports or TUN enable state here; Clash Party owns them.
  config.mode = "rule";
  config.ipv6 = false;
  config["unified-delay"] = true;
  config["tcp-concurrent"] = true;
  config.profile = Object.assign({}, config.profile || {}, {
    "store-selected": true,
    "store-fake-ip": true,
  });

  // Recommended Windows TUN parameters. The GUI may override these because
  // Clash Party applies its controlled/common settings after normal overrides.
  config.tun = Object.assign({}, config.tun || {}, {
    stack: "mixed",
    "dns-hijack": ["any:53", "tcp://any:53"],
    "auto-route": true,
    "auto-detect-interface": true,
    "strict-route": false,
  });

  // Sniff domain names from HTTP/TLS/QUIC while avoiding known Apple/LAN cases.
  config.sniffer = {
    enable: true,
    sniff: {
      HTTP: {
        ports: [80, "8080-8880"],
        "override-destination": true,
      },
      TLS: {
        ports: [443, 8443],
      },
      QUIC: {
        ports: [443, 8443],
      },
    },
    "skip-domain": ["Mijia Cloud", "+.push.apple.com"],
  };

  const domesticDns = [
    "https://dns.alidns.com/dns-query",
    "https://doh.pub/dns-query",
  ];
  const foreignDns = [
    `https://cloudflare-dns.com/dns-query#${bootstrapGroup}`,
    `https://dns.google/dns-query#${bootstrapGroup}`,
  ];

  // Baseline DNS. If Clash Party's DNS takeover/override is enabled, its
  // application-level DNS settings have higher priority than this section.
  config.dns = {
    enable: true,
    listen: "0.0.0.0:1053",
    ipv6: false,
    "cache-algorithm": "arc",
    "enhanced-mode": "fake-ip",
    "fake-ip-range": "198.18.0.1/16",
    "fake-ip-filter-mode": "rule",
    "fake-ip-filter": [
      "GEOSITE,private,real-ip",
      "DOMAIN-SUFFIX,lan,real-ip",
      "DOMAIN-SUFFIX,local,real-ip",
      "DOMAIN,time.windows.com,real-ip",
      "DOMAIN,time.nist.gov,real-ip",
      "DOMAIN,dns.msftncsi.com,real-ip",
      "DOMAIN,www.msftconnecttest.com,real-ip",
      "MATCH,fake-ip",
    ],
    "use-hosts": true,
    "use-system-hosts": true,
    "respect-rules": false,
    "default-nameserver": ["223.5.5.5", "119.29.29.29"],
    nameserver: domesticDns,
    "proxy-server-nameserver": domesticDns,
    "direct-nameserver": domesticDns,
    "direct-nameserver-follow-policy": true,
    "nameserver-policy": {
      "geosite:private": ["system"],
      "geosite:cn": domesticDns,

      "rule-set:qxr_openai": foreignDns,
      "rule-set:qxr_claude": foreignDns,
      "rule-set:qxr_gemini": foreignDns,
      "rule-set:qxr_media": foreignDns,

      "geosite:github": foreignDns,
      "geosite:youtube": foreignDns,
      "geosite:google": foreignDns,
      "geosite:telegram": foreignDns,
      "geosite:twitter": foreignDns,
      "geosite:reddit": foreignDns,
      "geosite:facebook": foreignDns,
      "geosite:discord": foreignDns,
      "geosite:spotify": foreignDns,
    },
  };

  // ASCII helper group for rule-provider and foreign DoH bootstrap.
  // Hidden from compatible dashboards.
  const groups = [
    select(bootstrapGroup, ["🚀 默认代理"], { hidden: true }),

    select("🚀 默认代理", [
      "⚡ 自动选择",
      "🇸🇬 新加坡",
      "🇯🇵 日本",
      "🇭🇰 香港",
      "🇹🇼 台湾",
      "🇰🇷 韩国",
      "🇺🇸 美国",
      "🇬🇧 英国",
      "🌐 全部节点",
      "DIRECT",
    ]),

    urlTest("⚡ 自动选择", ".*"),

    urlTest("🇭🇰 香港", REGION.HK),
    urlTest("🇹🇼 台湾", REGION.TW),
    urlTest("🇯🇵 日本", REGION.JP),
    urlTest("🇸🇬 新加坡", REGION.SG),
    urlTest("🇰🇷 韩国", REGION.KR),
    urlTest("🇺🇸 美国", REGION.US),
    urlTest("🇬🇧 英国", REGION.GB),

    {
      name: "🌐 全部节点",
      type: "select",
      "include-all": true,
      "exclude-filter": NODE_EXCLUDE,
      "exclude-type": "Direct|Reject|Compatible",
      "empty-fallback": "REJECT",
    },

    // Service-aware AI checks. This is stricter than a generic latency test,
    // but it is not equivalent to the QX ai-node-sifter's real-egress checks.
    urlTest("🤖 OpenAI 自动", AI_REGION, {
      url: "https://chatgpt.com/cdn-cgi/trace",
      interval: 600,
      tolerance: 100,
      "expected-status": 200,
    }),
    select("🤖 OpenAI", [
      "🤖 OpenAI 自动",
      "🇺🇸 美国",
      "🇬🇧 英国",
      "🇯🇵 日本",
      "🇸🇬 新加坡",
      "REJECT",
    ]),

    urlTest("🧠 Claude 自动", AI_REGION, {
      url: "https://claude.ai/cdn-cgi/trace",
      interval: 600,
      tolerance: 100,
      "expected-status": 200,
    }),
    select("🧠 Claude", [
      "🧠 Claude 自动",
      "🇺🇸 美国",
      "🇬🇧 英国",
      "🇯🇵 日本",
      "🇸🇬 新加坡",
      "REJECT",
    ]),

    urlTest("✨ Gemini 自动", AI_REGION, {
      url: "https://gemini.google.com/",
      interval: 600,
      tolerance: 100,
      "expected-status": "200-399",
    }),
    select("✨ Gemini", [
      "✨ Gemini 自动",
      "🇺🇸 美国",
      "🇯🇵 日本",
      "🇸🇬 新加坡",
      "🇬🇧 英国",
      "REJECT",
    ]),

    select("📰 国际媒体", [
      "🇸🇬 新加坡",
      "🇯🇵 日本",
      "🇬🇧 英国",
      "🇺🇸 美国",
      "🇭🇰 香港",
      "🇹🇼 台湾",
      "🚀 默认代理",
      "DIRECT",
    ]),
    select("💬 社交媒体", [
      "🇸🇬 新加坡",
      "🇺🇸 美国",
      "🇯🇵 日本",
      "🇭🇰 香港",
      "🚀 默认代理",
    ]),
    select("🐙 GitHub", [
      "🇸🇬 新加坡",
      "🇺🇸 美国",
      "🇯🇵 日本",
      "🇭🇰 香港",
      "🚀 默认代理",
      "DIRECT",
    ]),
    select("🔎 Bing", [
      "🇺🇸 美国",
      "🇬🇧 英国",
      "🇯🇵 日本",
      "🇸🇬 新加坡",
      "🚀 默认代理",
      "DIRECT",
    ]),
    select("🪟 Microsoft", [
      "DIRECT",
      "🚀 默认代理",
      "🇺🇸 美国",
      "🇬🇧 英国",
      "🇯🇵 日本",
      "🇸🇬 新加坡",
    ]),
    select("▶️ YouTube", [
      "🇯🇵 日本",
      "🇸🇬 新加坡",
      "🇺🇸 美国",
      "🇭🇰 香港",
      "🚀 默认代理",
    ]),
    select("🔎 Google", [
      "🚀 默认代理",
      "🇸🇬 新加坡",
      "🇯🇵 日本",
      "🇺🇸 美国",
      "🇭🇰 香港",
      "🇹🇼 台湾",
    ]),
    select("🎵 Spotify", [
      "DIRECT",
      "🚀 默认代理",
      "🇸🇬 新加坡",
      "🇺🇸 美国",
      "🇯🇵 日本",
      "🇭🇰 香港",
    ]),
    select("🍎 Apple", [
      "DIRECT",
      "🚀 默认代理",
      "🇭🇰 香港",
      "🇹🇼 台湾",
      "🇯🇵 日本",
      "🇺🇸 美国",
    ]),
    select("📺 BiliBili", [
      "DIRECT",
      "🚀 默认代理",
      "🇭🇰 香港",
      "🇹🇼 台湾",
    ]),
  ];

  // Preserve provider-defined groups that do not collide with our group names.
  // This keeps uncommon dialer-proxy / relay-style subscription dependencies intact.
  const managedGroupNames = new Set(groups.map((group) => group.name));
  config["proxy-groups"] = groups.concat(
    originalGroups.filter(
      (group) => group && group.name && !managedGroupNames.has(group.name),
    ),
  );

  config["rule-providers"] = Object.assign({}, config["rule-providers"] || {}, {
    qxr_openai: customRuleProvider("openai", bootstrapGroup),
    qxr_claude: customRuleProvider("claude", bootstrapGroup),
    qxr_gemini: customRuleProvider("gemini", bootstrapGroup),
    qxr_media: customRuleProvider("media", bootstrapGroup),
    qxr_direct_custom: customRuleProvider("direct", bootstrapGroup),
  });

  // Own the routing order so provider-supplied MATCH/GEOIP rules cannot
  // shadow service-specific policies.
  config.rules = [
    // LAN / private
    "IP-CIDR,127.0.0.0/8,DIRECT,no-resolve",
    "IP-CIDR,10.0.0.0/8,DIRECT,no-resolve",
    "IP-CIDR,172.16.0.0/12,DIRECT,no-resolve",
    "IP-CIDR,192.168.0.0/16,DIRECT,no-resolve",
    "IP-CIDR,100.64.0.0/10,DIRECT,no-resolve",
    "GEOSITE,private,DIRECT",

    // Conservative direct corrections before broad service/ads rules.
    "RULE-SET,qxr_direct_custom,DIRECT",

    // AI must precede Google and other shared infrastructure.
    "RULE-SET,qxr_openai,🤖 OpenAI",
    "RULE-SET,qxr_claude,🧠 Claude",
    "RULE-SET,qxr_gemini,✨ Gemini",

    // Advertising before media/general services.
    "GEOSITE,category-ads-all,REJECT",

    // Social / media.
    "GEOSITE,telegram,💬 社交媒体",
    "GEOIP,telegram,💬 社交媒体,no-resolve",
    "GEOSITE,twitter,💬 社交媒体",
    "GEOSITE,reddit,💬 社交媒体",
    "GEOSITE,facebook,💬 社交媒体",
    "GEOSITE,instagram,💬 社交媒体",
    "GEOSITE,discord,💬 社交媒体",
    "RULE-SET,qxr_media,📰 国际媒体",

    // Developer / platform services.
    "GEOSITE,github,🐙 GitHub",

    // Specific services before their parent platform rules.
    "GEOSITE,bing,🔎 Bing",
    "GEOSITE,microsoft,🪟 Microsoft",
    "GEOSITE,youtube,▶️ YouTube",
    "GEOSITE,google,🔎 Google",
    "GEOSITE,spotify,🎵 Spotify",
    "GEOSITE,bilibili,📺 BiliBili",
    "GEOSITE,apple,🍎 Apple",

    // WeChat is covered by direct_custom; mainland traffic stays direct.
    "GEOSITE,cn,DIRECT",
    "GEOIP,CN,DIRECT,no-resolve",

    "MATCH,🚀 默认代理",
  ];

  return config;
}
