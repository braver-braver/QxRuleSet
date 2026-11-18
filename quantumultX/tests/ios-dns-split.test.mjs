// Offline structural checks for iOS split DNS. They do not test live DNS reachability.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const config = readFileSync(new URL('../qx-ios.conf', import.meta.url), 'utf8')
const part = config.match(/^\[dns\]([\s\S]*?)(?=^\[[^\]]+\]|$)/m)
assert.ok(part, 'missing [dns]')
const dns = part[1].split(/\r?\n/)
  .map(s => s.trim()).filter(s => s && !s.startsWith('#'))
const doh = dns.filter(s => s.startsWith('doh-server = '))

test('global default resolvers use Google and Quad9 concurrently, not AliDNS', () => {
  const globals = doh.filter(s => /^doh-server = https:\/\//.test(s))
  assert.deepEqual(globals, [
    'doh-server = https://dns.google/dns-query, https://dns.quad9.net/dns-query'
  ])
  assert.ok(dns.includes('no-system'))
  assert.ok(dns.includes('no-ipv6'))
  assert.ok(dns.includes('prefer-doh3'))
})

test('CN top-level domain is bound to AliDNS without changing global DNS', () => {
  assert.ok(doh.includes('doh-server = /*.cn/https://dns.alidns.com/dns-query'))
  assert.ok(!dns.some(s => /^server\s*=/.test(s)), 'plain unscoped DNS cannot be a DoH fallback')
})

test('curated domestic services retain root and wildcard DoH bindings', () => {
  const providers = new Map([
    ['qq.com', 'doh.pub'], ['tencent.com', 'doh.pub'],
    ['weixin.com', 'doh.pub'], ['jd.com', 'doh.pub'],
    ['bilibili.com', 'doh.pub'], ['hdslb.com', 'doh.pub'],
    ['163.com', 'doh.pub'], ['netease.com', 'doh.pub'],
    ['icloud.com.cn', 'doh.pub'], ['alicdn.com', 'dns.alidns.com'],
    ['aliyun.com', 'dns.alidns.com'], ['taobao.com', 'dns.alidns.com'],
    ['tmall.com', 'dns.alidns.com']
  ])
  for (const [domain, host] of providers) {
    for (const pattern of [domain, '*.' + domain]) {
      assert.ok(doh.includes('doh-server = /' + pattern +
        '/https://' + host + '/dns-query'), pattern)
    }
  }
  assert.equal(doh.length, 1 + 1 + 2 * providers.size)
})

test('iOS routing remains direct-first and AI policy remains independent of DNS', () => {
  assert.match(config, /^final, direct$/m)
  assert.match(config, /^geoip, cn, direct$/m)
  assert.match(config, /^static=海外AI, 🛡 AI联合安全节点, reject,/m)
  assert.match(config, /ai-node-sifter\.js#provider=all/)
})
