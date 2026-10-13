// Build non-secret synthetic configs for validating the generated config with Mihomo.
// Usage: node mihomo/tests/build-smoke-config.mjs /tmp/mihomo-test
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";

const destination = process.argv[2];
if (!destination) throw new Error("expected output directory");
mkdirSync(destination, { recursive: true });
const script = readFileSync(new URL("../clash-party-override.js", import.meta.url), "utf8");
const main = runInNewContext(script + "\nmain", {});

function node(name) {
  return {
    name,
    type: "ss",
    server: "127.0.0.1",
    port: 8388,
    cipher: "aes-128-gcm",
    password: "dummy-test-only-not-a-real-subscription"
  };
}

const fixtures = [
  ["inline", {
    proxies: [node("US-smoke")],
    "proxy-groups": []
  }],
  ["provider", {
    "proxy-providers": {
      Airport: {
        type: "inline",
        payload: [node("JP-smoke")]
      }
    },
    "proxy-groups": [
      { name: "🚀 默认代理", type: "select", proxies: ["DIRECT"] },
      { name: "🤖 OpenAI", type: "select", proxies: ["DIRECT"] }
    ],
    "rule-providers": {
      qxr_openai: {
        type: "inline",
        behavior: "classical",
        payload: ["DOMAIN,custom.airport.invalid"]
      }
    }
  }]
];

for (const [name, source] of fixtures) {
  // JSON is a YAML-compatible format and deliberately needs no npm dependency.
  const generated = main(source);
  const filename = join(destination, name + ".yaml");
  writeFileSync(filename, JSON.stringify(generated, null, 2) + "\n");
  console.log("Fixture ready:", filename);
}
