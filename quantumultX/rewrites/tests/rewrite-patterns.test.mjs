import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cases = [
  {
    file: "bilibili-splash.conf",
    hostname: ["app.bilibili.com"],
    hits: [
      "https://app.bilibili.com/x/v2/splash/show",
      "https://app.bilibili.com/x/v2/splash/show?device=iphone",
    ],
    misses: [
      "https://app.bilibili.com/x/v2/splash/showcase",
      "https://app.bilibili.com/x/v2/feed/index",
      "https://api.bilibili.com/x/v2/splash/show",
      "https://app.bilibili.com.evil.example/x/v2/splash/show",
    ],
  },
  {
    file: "weibo-ad-preload.conf",
    hostname: ["api.weibo.cn"],
    hits: [
      "https://api.weibo.cn/2/ad/preload",
      "https://api.weibo.cn/12/ad/preload?device=iphone",
    ],
    misses: [
      "https://api.weibo.cn/2/statuses/home",
      "https://api.weibo.cn/2/ad/preloading",
      "https://api.weibo.com/2/ad/preload",
      "https://api.weibo.cn.evil.example/2/ad/preload",
    ],
  },
  {
    file: "amap-splash.conf",
    hostname: ["m5.amap.com", "m5-zb.amap.com"],
    hits: [
      "https://m5.amap.com/ws/aos/alimama/splash_screen",
      "https://m5-zb.amap.com/ws/valueadded/alimama/splash_screen?v=1",
    ],
    misses: [
      "https://m5.amap.com/ws/navigation/route",
      "https://m5.amap.com/ws/aos/alimama/splash_screens",
      "https://ai.amap.com/ws/aos/alimama/splash_screen",
      "https://m5.amap.com.evil.example/ws/aos/alimama/splash_screen",
    ],
  },
];

for (const fixture of cases) {
  test(fixture.file + " is isolated to expected advertisement URLs", () => {
    const source = readFileSync(new URL("../apps/" + fixture.file, import.meta.url), "utf8");
    const header = source.match(/^hostname\s*=\s*(.+)$/m);
    assert.ok(header, "missing explicit hostname restriction");
    assert.deepEqual(header[1].split(",").map((s) => s.trim()), fixture.hostname);
    const rules = source.split(/\r?\n/).filter((line) => line.startsWith("^") && line.includes(" url "));
    assert.equal(rules.length, 1, "one narrowly scoped rule per app");
    const [pattern, action] = rules[0].split(" url ");
    assert.equal(action, "reject-dict", "no body scripts or broad actions");
    const expression = new RegExp(pattern);
    for (const url of fixture.hits) assert.match(url, expression);
    for (const url of fixture.misses) assert.doesNotMatch(url, expression);
    assert.ok(!source.includes("script-response-body"));
  });
}

test("iOS template leaves every optional HTTPS Rewrite disabled", () => {
  const cfg = readFileSync(new URL("../../qx-ios.conf", import.meta.url), "utf8");
  const section = cfg.split("[rewrite_remote]\n")[1]?.split(/\n\[/)[0];
  assert.ok(section, "rewrite_remote section missing");
  const urls = section.split(/\r?\n/).filter((line) => line.startsWith("https://"));
  assert.equal(urls.length, 6);
  assert.ok(urls.every((line) => line.trimEnd().endsWith("enabled=false")));
  assert.ok(!/^\s*(?:p12|passphrase)\s*=\s*\S/m.test(cfg), "public template contains private MITM materials");
});
