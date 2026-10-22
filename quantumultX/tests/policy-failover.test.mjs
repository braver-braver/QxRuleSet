// Static regression checks for the iOS/macOS Quantumult X policy templates.
// Run: node --test quantumultX/tests/policy-failover.test.mjs
// These tests validate structure and intended defaults, not real node reachability.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const names = ["iOS", "macOS"];
const files = [
  new URL("../qx-ios.conf", import.meta.url),
  new URL("../qx-macos.conf", import.meta.url)
];
const BACKUP = "🌍 跨区顺选·健康";
const AUTOMATIC = ["社交媒体", "国际媒体", "GitHub服务", "油管服务", "Bing服务"];
const MANUAL_BACKUP = ["全球策略", "谷歌服务"];
const AI_POLICY_DEFAULTS = new Map([
  ["OpenAi服务", ["🤖 OpenAI安全节点", "reject"]],
  ["ClaudeAi服务", ["🧠 Claude安全节点", "reject"]],
  ["Gemini", ["✨ Gemini安全节点", "reject"]],
  ["🤖 OpenAI安全节点", ["reject"]],
  ["🧠 Claude安全节点", ["reject"]],
  ["✨ Gemini安全节点", ["reject"]]
]);

function loadPolicies(file) {
  const content = readFileSync(file, "utf8");
  const start = content.indexOf("\n[policy]\n");
  const end = content.indexOf("\n[filter_local]\n", start);
  assert.ok(start !== -1 && end > start, "expected unique policy section");
  const section = content.slice(start, end);
  const groups = new Map();
  for (const line of section.split("\n")) {
    const match = /^(static|available|url-latency-benchmark)=([^,]+), (.*)$/.exec(line);
    if (!match) continue;
    const [, type, name, rest] = match;
    assert.ok(!groups.has(name), "duplicate group: " + name);
    groups.set(name, { type, line, parts: rest.split(", ").map(x => x.trim()) });
  }
  return { content, groups };
}

function groupOf(model, name, type) {
  const group = model.groups.get(name);
  assert.ok(group, "policy missing: " + name);
  if (type) assert.equal(group.type, type, name);
  return group;
}

function candidates(group) {
  return group.parts.filter(part =>
    !/^(server-tag-regex|resource-tag-regex|img-url|check-interval|alive-checking|tolerance)=/.test(part)
  );
}

function policyRegex(group) {
  const key = "server-tag-regex=";
  const regex = group.parts.find(x => x.startsWith(key));
  assert.ok(regex, group.line);
  return new RegExp(regex.slice(key.length));
}

for (let i = 0; i < files.length; i++) {
  const platform = names[i];
  const model = loadPolicies(files[i]);

  test(platform + ": cross-region pool is a valid, constrained available group", () => {
    const pool = groupOf(model, BACKUP, "available");
    assert.ok(pool.parts.some(x => x.startsWith("server-tag-regex=")));
    assert.ok(!pool.parts.some(x => /^(check-interval|tolerance|alive-checking)=/.test(x)),
      "available is event-driven, not an interval benchmark");
    assert.ok(model.content.includes("server_check_url=http://www.gstatic.com/generate_204"));
    assert.ok(model.content.includes("server_check_timeout=3000"));

    const pattern = policyRegex(pool);
    const positives = [
      "🇭🇰 香港 01", "🇹🇼 台湾01", "JP-Tokyo-03",
      "🇸🇬 新加坡-02", "KR-Seoul-01", "US-01", "🇬🇧 UK-London"
    ];
    for (const node of positives) assert.ok(pattern.test(node), "missing valid region: " + node);
    const negatives = [
      "US-剩余流量", "到期重置套餐JP", "官网US注册",
      "NeteaseMusic-JP", "Premium-001", "BUSINESS Plan", "免费-HK"
    ];
    for (const node of negatives) assert.ok(!pattern.test(node), "invalid fallback node: " + node);
  });

  test(platform + ": active benchmarks update every five minutes without idle polling", () => {
    const groups = [...model.groups.entries()].filter(([, v]) => v.type === "url-latency-benchmark");
    assert.equal(groups.length, 9, "expected nine existing benchmark groups");
    for (const [name, group] of groups) {
      assert.ok(group.parts.includes("check-interval=300"), name);
      assert.ok(group.parts.includes("tolerance=100"), name);
      assert.ok(group.parts.includes("alive-checking=false"), name);
    }
    const all = groupOf(model, "🚇 全部优选·延迟", "url-latency-benchmark");
    const allPattern = policyRegex(all);
    assert.ok(allPattern.test("Premium-001"), "unlabeled nodes stay in the latency-only pool");
    assert.ok(!allPattern.test("剩余 30GB"), "subscription metadata must not be a candidate");
  });

  test(platform + ": ordinary service groups use failover by default", () => {
    for (const name of AUTOMATIC) {
      const candidatesList = candidates(groupOf(model, name, "static"));
      assert.equal(candidatesList[0], BACKUP, "first candidate: " + name);
      assert.ok(candidatesList.includes("proxy"), "manual proxy exit: " + name);
      assert.ok(candidatesList.some(x => x.includes("顺选·健康") && x !== BACKUP),
        "manual region choice remains: " + name);
    }
    const directExpected = ["国际媒体", "社交媒体", "GitHub服务", "Bing服务"];
    for (const name of directExpected) {
      assert.ok(candidates(groupOf(model, name)).includes("direct"), name);
    }
    for (const name of MANUAL_BACKUP) {
      const choices = candidates(groupOf(model, name, "static"));
      assert.equal(choices[1], BACKUP, "fallback is manual, do not replace first benchmark: " + name);
    }
  });

  test(platform + ": explicit regional and account-sensitive choices remain", () => {
    assert.equal(candidates(groupOf(model, "Spotify", "static"))[0], "direct");
    assert.equal(candidates(groupOf(model, "BiliBili", "static"))[0], "direct");
    assert.equal(candidates(groupOf(model, "苹果服务", "static"))[0], "direct");
    assert.equal(candidates(groupOf(model, "AppleTV服务", "static"))[0], "🇺🇸 美国顺选·健康");
    for (const [name, expected] of AI_POLICY_DEFAULTS) {
      assert.deepEqual(candidates(groupOf(model, name, "static")).slice(0, expected.length),
        expected, "AI fail-closed policy modified: " + name);
    }
  });

  test(platform + ": all policy references resolve and do not form cycles", () => {
    const done = new Set();
    const visiting = new Set();
    function visit(name) {
      if (done.has(name)) return;
      assert.ok(!visiting.has(name), "cycle in policy tree at " + name);
      visiting.add(name);
      const policy = groupOf(model, name);
      if (policy.type === "static") {
        for (const target of candidates(policy)) {
          assert.notEqual(target, name, "policy references itself: " + name);
          if (model.groups.has(target)) visit(target);
        }
      }
      visiting.delete(name);
      done.add(name);
    }
    for (const name of model.groups.keys()) visit(name);
    assert.ok(model.groups.size >= 25, "policy definitions unexpectedly removed");
  });

  test(platform + ": all regional available groups omit benchmark-only options", () => {
    const groups = [...model.groups.values()].filter(x => x.type === "available");
    assert.ok(groups.length >= 8, "cross region + seven countries expected");
    for (const group of groups) {
      assert.ok(!group.parts.some(x => /^(tolerance|check-interval|alive-checking)=/.test(x)), group.line);
    }
    assert.ok(!model.content.includes("https://YOUR_SUBSCRIPTION_URL, enabled=true"),
      "test must not invent or activate private subscription credentials");
  });
}

test("both templates keep consistent cross-region failover definitions", () => {
  const [ios, mac] = files.map(loadPolicies);
  const sharedNames = [BACKUP, ...AUTOMATIC, ...MANUAL_BACKUP];
  for (const name of sharedNames) {
    assert.equal(groupOf(ios, name).line, groupOf(mac, name).line, name);
  }
  assert.ok(!ios.groups.has("AI应用更新"), "iOS should not inherit macOS app updater group");
  assert.ok(mac.groups.has("AI应用更新"), "macOS updater must remain available");
});
