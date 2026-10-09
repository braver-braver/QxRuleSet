import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = (name) => readFileSync(new URL("../" + name, import.meta.url), "utf8");
const sample = {
  success: true, ip: "203.0.113.9", country_code: "TW", country: "Taiwan",
  region: "Taipei City", city: "Taipei",
  connection: { asn: 64501, isp: "Example ISP <script>", org: "Test Net" },
  timezone: { id: "Asia/Taipei" },
};

function geoChecker(response) {
  const calls = [];
  runInNewContext(source("geo-location-checker.js"), {
    $response: response, $done: (payload) => calls.push(payload),
  });
  return calls;
}

function run(name, options = {}) {
  const calls = [], requests = [];
  const policy = options.policy === undefined ? "Node <b>1</b>" : options.policy;
  return new Promise((resolve, reject) => {
    let finished = false, doneTimer;
    const watchdog = setTimeout(() => {
      if (!finished) reject(new Error("Timed out: " + name));
    }, 1800);
    const context = {
      console: { log() {} }, setTimeout, clearTimeout,
      $environment: { params: policy },
      $done: (payload) => {
        calls.push(payload);
        if (!doneTimer) doneTimer = setTimeout(() => {
          finished = true; clearTimeout(watchdog);
          resolve({ calls, requests });
        }, 15);
      },
      $task: { fetch: (request) => {
        requests.push(request);
        return Promise.resolve().then(() => {
          if (options.fetch) return options.fetch(request);
          if (request.url.startsWith("https://ipwho.is/"))
            return { statusCode: 200, body: JSON.stringify(sample), headers: {} };
          if (request.url.startsWith("https://api.ip2location.io/"))
            return { statusCode: 200, body: JSON.stringify({ is_proxy: false }), headers: {} };
          if (request.url.includes("/cdn-cgi/trace"))
            return { statusCode: 200, body: "ip=203.0.113.9\nloc=TW\n", headers: {} };
          return { statusCode: 200, body: "", headers: {} };
        });
      }},
      $configuration: { sendMessage: (msg) => Promise.resolve(
        options.message ? options.message(msg) : { ret: { "Node <b>1</b>": ["Node <b>1</b>", "TestLeaf"] } }
      ) },
    };
    try { runInNewContext(source(name), context); }
    catch (e) { finished = true; clearTimeout(watchdog); reject(e); }
  });
}

test("GEO checker parses ipwho.is response and preserves Taiwan ISO flag", () => {
  const calls = geoChecker({ statusCode: 200, body: JSON.stringify(sample) });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].ip, "203.0.113.9");
  assert.ok(calls[0].title.startsWith("🇹🇼"));
  assert.match(calls[0].description, /AS64501/);
  assert.doesNotMatch(calls[0].description, /经度/);
});

test("GEO checker does not invent data when provider fails or rate-limits", () => {
  for (const response of [
    { statusCode: 429, body: JSON.stringify(sample) },
    { statusCode: 200, body: "not JSON" },
    { statusCode: 200, body: JSON.stringify({ success: false }) },
  ]) {
    const calls = geoChecker(response);
    assert.equal(calls.length, 1);
    assert.equal(calls[0], null);
  }
});

test("manual GEO query uses the selected policy and escapes user data", async () => {
  const out = await run("geo-query.js");
  assert.equal(out.calls.length, 1);
  assert.match(out.calls[0].htmlMessage, /🇹🇼/);
  assert.match(out.calls[0].htmlMessage, /&lt;b&gt;1&lt;\/b&gt;/);
  assert.match(out.calls[0].htmlMessage, /&lt;script&gt;/);
  assert.ok(out.requests.every((x) => x.opts.policy === "Node <b>1</b>"));
});

test("manual GEO query falls back to Cloudflare with IP and country only", async () => {
  const out = await run("geo-query.js", { fetch: (req) =>
    req.url.includes("ipwho.is")
      ? { statusCode: 429, body: "{}" }
      : { statusCode: 200, body: "ip=203.0.113.7\nloc=HK\n" }
  });
  assert.equal(out.calls.length, 1);
  assert.match(out.calls[0].htmlMessage, /Cloudflare/);
  assert.doesNotMatch(out.calls[0].htmlMessage, /<b>ASN：/);
});

test("node reputation reports only a limited open-proxy clue, not purity score", async () => {
  const out = await run("node-reputation.js");
  assert.equal(out.calls.length, 1);
  assert.match(out.calls[0].htmlMessage, /不代表纯净或住宅/);
  assert.doesNotMatch(out.calls[0].htmlMessage, /100%/);
  assert.match(out.requests[1].url, /\?ip=203\.0\.113\.9$/);
  assert.ok(out.requests.every((x) => x.opts.policy === "Node <b>1</b>"));
});

test("node reputation handles second provider rate limit as unknown", async () => {
  const out = await run("node-reputation.js", { fetch: (req) =>
    req.url.includes("ipwho.is")
      ? { statusCode: 200, body: JSON.stringify(sample) }
      : { statusCode: 429, body: "{}" }
  });
  assert.equal(out.calls.length, 1);
  assert.match(out.calls[0].htmlMessage, /暂不可用/);
  assert.doesNotMatch(out.calls[0].htmlMessage, /检测到开放代理/);
});

test("traffic check groups by candidate and keeps sorted names attached to amounts", async () => {
  const out = await run("traffic-check.js", { message: (msg) => {
    if (msg.action === "get_customized_policy")
      return { ret: { "Node <b>1</b>": { candidates: ["A", "B<script>"] } } };
    if (msg.action === "get_traffic_statistics") return { ret: {
      a: { name: "A", type: "tcp", rx_transfer: 1048576, tx_transfer: 0 },
      b: { name: "B<script>", type: "udp", rx_transfer: 2097152, tx_transfer: 0 },
      c: { name: "A", type: "udp", rx_transfer: 0, tx_transfer: 524288 },
      other: { name: "unselected", type: "tcp", rx_transfer: 9000000, tx_transfer: 0 },
    }};
    return { error: "unknown" };
  }});
  assert.equal(out.calls.length, 1);
  const html = out.calls[0].htmlMessage;
  assert.match(html, /3\.5 MiB/);
  assert.match(html, /1\. B&lt;script&gt;： 2\.0 MiB/);
  assert.match(html, /2\. A： 1\.5 MiB/);
  assert.doesNotMatch(html, /B<script>/);
});

test("traffic check reports QX unsupported stats explicitly", async () => {
  const out = await run("traffic-check.js", { message: (msg) =>
    msg.action === "get_traffic_statistics" ? { error: "unsupported" } : { ret: {} }
  });
  assert.equal(out.calls.length, 1);
  assert.match(out.calls[0].htmlMessage, /未提供流量统计/);
});

test("service checker treats unauthenticated/rate-limited responses as unverified", async () => {
  const out = await run("streaming-ui-check.js", { fetch: (req) => {
    if (req.url.includes("/cdn-cgi/trace"))
      return { statusCode: 200, body: "loc=TW\n", headers: {} };
    if (req.url.includes("api.anthropic.com"))
      return { statusCode: 401, body: "invalid", headers: {} };
    if (req.url.includes("api.openai.com"))
      return { statusCode: 429, body: "rate limit", headers: {} };
    if (req.url.includes("generativelanguage.googleapis.com"))
      return { statusCode: 400, body: "invalid", headers: {} };
    if (req.url === "https://www.google.com/")
      return { statusCode: 302, body: "", headers: { location: "https://www.google.com.hk/" } };
    if (req.url.includes("disney.api.edge.bamgrid.com"))
      return { statusCode: 401, body: "", headers: {} };
    return { statusCode: 200, body: "<html lang='en'></html>", headers: {} };
  }});
  assert.equal(out.calls.length, 1);
  const html = out.calls[0].htmlMessage;
  assert.match(html, /Claude API: <\/b>端点可达（未鉴权）/);
  assert.match(html, /OpenAI API: <\/b>已限流/);
  assert.match(html, /Gemini API: <\/b>端点可达（未鉴权）/);
  assert.match(html, /香港跳转（不是大陆证据）/);
  assert.match(html, /🇹🇼/);
  assert.doesNotMatch(html, /Google 送中: <\/b>是/);
});
