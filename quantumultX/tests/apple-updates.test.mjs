// Offline rule/precedence checks; no claim about CDN speed or QX runtime.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const resource = "rules/services/apple-updates.list";
// Apple enterprise network requirements, Software updates (checked 2026-10-29; only hosts with explicit update/install purpose).
const updateHosts = [
  "appldnld.apple.com", "configuration.apple.com", "fcs-keys-pub-prod.cdn-apple.com",
  "gdmf-ados.apple.com", "gdmf.apple.com", "gg.apple.com",
  "gs.apple.com", "gsra.apple.com", "ig.apple.com",
  "mesu.apple.com", "oscdn.apple.com", "osrecovery.apple.com",
  "skl.apple.com", "swcdn.apple.com", "swdist.apple.com",
  "swdownload.apple.com", "swscan.apple.com", "updates-http.cdn-apple.com",
  "updates.cdn-apple.com", "wkms-public.apple.com"
];

function rules(path) {
  return readFileSync(new URL(path, root), "utf8").split(/\r?\n/)
    .map(line => line.trim()).filter(line => line && !/^[#;]/.test(line))
    .map(line => line.split(",").map(part => part.trim()));
}

function matches(rule, host) {
  const [type, value] = rule;
  if (type.toLowerCase() === "host") return host === value;
  if (type.toLowerCase() === "host-suffix") return host === value || host.endsWith("." + value);
  return false;
}

for (const platform of ["ios", "macos"]) {
  const text = readFileSync(new URL(`qx-${platform}.conf`, root), "utf8");
  test(platform + ": update resource is direct, enabled and precedes generic filters", () => {
    const section = text.split("[filter_remote]")[1]?.split(/\n\[/)[0];
    assert.ok(section, "filter_remote missing");
    const lines = section.split(/\r?\n/).map(line => line.trim())
      .filter(line => line && !/^[#;]/.test(line));
    const entries = lines.filter(line => line.includes("/" + resource + ","));
    assert.equal(entries.length, 1, "load update exceptions exactly once");
    assert.equal(lines[0], entries[0], "updates must precede ad-block and broad Apple filters");
    assert.match(entries[0], /,\s*force-policy=direct(?:,|$)/);
    assert.match(entries[0], /,\s*enabled=true(?:,|$)/);
    assert.match(entries[0], /,\s*opt-parser=false(?:,|$)/);
    assert.match(entries[0], /\/refs\/heads\/main\/quantumultX\//);
  });


  test(platform + ": no local domain rule intercepts update hosts", () => {
    // Static conflict guard: a [filter_local] HOST/HOST-SUFFIX may take precedence.
    const section = text.split("[filter_local]")[1]?.split(/\n\[/)[0];
    assert.ok(section, "filter_local missing");
    const localDomainRules = section.split(/\r?\n/)
      .map(line => line.trim()).filter(line => line && !/^[#;]/.test(line))
      .map(line => line.split(",").map(part => part.trim()))
      .filter(rule => ["host", "host-suffix"].includes(rule[0].toLowerCase()));
    for (const host of updateHosts) {
      assert.ok(!localDomainRules.some(rule => matches(rule, host)),
        "local domain rule could override update resource: " + host);
    }
  });

  test(platform + ": switching Apple service group cannot redirect updates or Apple TV", () => {
    // Model the ordered domain resources under both manual Apple selections.
    const section = text.split("[filter_remote]")[1]?.split(/\n\[/)[0] || "";
    const resources = section.split(/\r?\n/).filter(line =>
      /\/services\/apple(?:-updates|tv)?\.list,/.test(line) && /enabled=true/.test(line));
    assert.equal(resources.length, 3);
    for (const appleChoice of ["direct", "proxy"]) {
      const ordered = resources.flatMap(line => {
        const path = line.match(/quantumultX\/(rules\/services\/[^,]+)/)[1];
        const forced = line.match(/force-policy=([^,\s]+)/)[1];
        return rules(path).map(rule => [rule[0], rule[1], forced]);
      });
      function route(host) {
        const group = ordered.find(rule => matches(rule, host))?.[2];
        return group === "苹果服务" ? appleChoice : group;
      }
      for (const host of updateHosts) assert.equal(route(host), "direct", host);
      assert.equal(route("www.apple.com"), appleChoice);
      assert.equal(route("apps.apple.com"), appleChoice, "App Store remains on Apple services");
      assert.equal(route("itunes.apple.com"), appleChoice, "iTunes/App Store remains selectable");
      assert.equal(route("is1-ssl.mzstatic.com"), appleChoice, "App Store assets remain selectable");
      assert.equal(route("xp.apple.com"), appleChoice, "update telemetry is not forced direct");
      assert.equal(route("gateway.icloud.com.cn"), appleChoice);
      assert.equal(route("tv.apple.com"), "AppleTV服务");
      assert.equal(route("play-edge.itunes.apple.com"), "AppleTV服务");
    }
  });
}

test("update exceptions are exact Apple hosts, not shared CDN or service suffixes", () => {
  const updates = rules(resource);
  assert.equal(updates.length, updateHosts.length);
  assert.deepEqual(updates.map(rule => rule[1]).sort(), [...updateHosts].sort());
  for (const rule of updates) {
    assert.equal(rule.length, 3);
    assert.equal(rule[0], "HOST");
    assert.equal(rule[2], "direct");
  }
  for (const host of ["apple.com", "tv.apple.com", "icloud.com", "apps.apple.com",
    "xp.apple.com", "sub.gdmf-ados.apple.com", "wkms-public.apple.com.evil.example",
    "example.fcs-keys-pub-prod.cdn-apple.com",
    "appleid.cdn-apple.com", "example.cdn-apple.com", "updates.cdn-apple.com.evil.example",
    "fake-updates.cdn-apple.com", "sub.updates.cdn-apple.com", "gdmf.apple.com.evil.example"]) {
    assert.ok(!updates.some(rule => matches(rule, host)), "overbroad direct exception: " + host);
  }
});
