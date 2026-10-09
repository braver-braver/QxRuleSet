import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../clash-party-override.js", import.meta.url), "utf8");
const override = runInNewContext(source + "\n({ main, REGION, AI_REGION })", {});
const plain = (value) => JSON.parse(JSON.stringify(value));
const group = (cfg, name) => cfg["proxy-groups"].find((entry) => entry.name === name);
const matches = (pattern, name) => {
  assert.ok(pattern.startsWith("(?i)"), "expected Go/RE2 case-insensitive regex");
  return new RegExp(pattern.slice(4), "i").test(name);
};

test("provider-backed and inline proxy nodes are included in managed groups", () => {
  const cfg = plain(override.main({
    proxies: [{ name: "🇺🇸 US-01", type: "ss", server: "node.invalid", port: 443 }],
    "proxy-providers": { Airport: { type: "http", url: "https://example.invalid/sub.yaml" } },
    "proxy-groups": [],
  }));
  assert.deepEqual(Object.keys(cfg["proxy-providers"]), ["Airport"]);
  for (const item of cfg["proxy-groups"]) {
    if (item.type === "url-test" || item.name === "🌐 全部节点") {
      assert.equal(item["include-all"], true, item.name);
      assert.notEqual(item["include-all-proxies"], true);
    }
  }
  assert.equal(group(cfg, "⚡ 自动选择")["include-all"], true);
  assert.equal(group(cfg, "🌐 全部节点")["include-all"], true);
});

test("original PROXY and similarly named groups survive internal bootstrap", () => {
  const old = [
    { name: "PROXY", type: "select", proxies: ["DIRECT"] },
    { name: "__QXR_BOOTSTRAP__", type: "select", proxies: ["PROXY"] },
    { name: "CustomChain", type: "select", proxies: ["PROXY"] },
  ];
  const cfg = plain(override.main({ "proxy-groups": old }));
  for (const entry of old) assert.deepEqual(group(cfg, entry.name), entry);
  const internal = cfg["proxy-groups"].filter((x) => x.name.startsWith("__QXR_BOOTSTRAP_"));
  assert.equal(internal.length, 1);
  const bootstrap = internal[0].name;
  assert.equal(bootstrap, "__QXR_BOOTSTRAP_1__");
  assert.equal(internal[0].hidden, true);
  assert.deepEqual(internal[0].proxies, ["🚀 默认代理"]);
  for (const key of ["openai", "claude", "gemini", "media", "direct_custom"]) {
    assert.equal(cfg["rule-providers"]["qxr_" + key].proxy, bootstrap);
  }
  for (const server of cfg.dns["nameserver-policy"]["rule-set:qxr_openai"]) {
    assert.ok(server.endsWith("#" + bootstrap));
  }
});

test("custom rule providers cannot overwrite airport-defined rule provider names", () => {
  const original = { type: "http", url: "https://example.invalid/custom-rules.yaml" };
  const cfg = plain(override.main({ "rule-providers": { openai: original } }));
  assert.deepEqual(cfg["rule-providers"].openai, original);
  for (const suffix of ["openai", "claude", "gemini", "media", "direct_custom"]) {
    const name = "qxr_" + suffix;
    assert.ok(cfg["rule-providers"][name], name + " missing");
    assert.ok(cfg.rules.some((item) => item.startsWith("RULE-SET," + name + ",")));
  }
});

test("US and AI regions require real country / airport-code tokens", () => {
  for (const name of ["Overseas-HK", "Wholesale-HK", "HK Node", "🇨🇳 上海", "BUSINESS"]) {
    assert.equal(matches(override.REGION.US, name), false, name);
    assert.equal(matches(override.AI_REGION, name), false, name);
  }
  for (const name of ["US-01", "SEA-02", "SFO-03", "USA Premium", "🇺🇸 Premium"]) {
    assert.equal(matches(override.REGION.US, name), true, name);
    assert.equal(matches(override.AI_REGION, name), true, name);
  }
  assert.equal(matches(override.AI_REGION, "SG-01"), true);
  assert.equal(matches(override.AI_REGION, "🇯🇵 东京"), true);
});

test("Taiwan group excludes CN flags and admits only explicit Taiwan labels", () => {
  assert.equal(matches(override.REGION.TW, "🇨🇳 上海"), false);
  for (const name of ["🇹🇼 台北", "Taiwan Premium", "TW-02", "TPE-03"]) {
    assert.equal(matches(override.REGION.TW, name), true, name);
  }
});

test("core routing refers only to namespaced QxRuleSet providers", () => {
  const cfg = plain(override.main({}));
  assert.ok(cfg.rules.includes("RULE-SET,qxr_openai,🤖 OpenAI"));
  assert.ok(cfg.rules.includes("RULE-SET,qxr_media,📰 国际媒体"));
  assert.ok(cfg.rules.includes("RULE-SET,qxr_direct_custom,DIRECT"));
  assert.equal(cfg.rules.at(-1), "MATCH,🚀 默认代理");
  for (const name of ["qxr_openai", "qxr_claude", "qxr_gemini", "qxr_media"]) {
    assert.ok(Object.hasOwn(cfg.dns["nameserver-policy"], "rule-set:" + name));
  }
});
