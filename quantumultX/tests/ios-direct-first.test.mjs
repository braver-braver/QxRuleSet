// iOS blacklist-style routing safety contract: only explicit overseas services
// may proxy; unmatched and important mainland-specific domains stay direct.
// Static tests cannot prove actual Quantumult X priority/network behavior.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const config = name => readFileSync(new URL('qx-' + name + '.conf', root), 'utf8')
const iOS = config('ios')
const macOS = config('macos')

const section = (conf, name) => {
  const marker = '[' + name + ']'
  const i = conf.indexOf(marker + '\n')
  assert.ok(i >= 0, 'missing ' + marker)
  const tail = conf.slice(i + marker.length + 1)
  return tail.split(/\r?\n\[/)[0].split(/\r?\n/)
    .map(s => s.trim()).filter(s => s && !/^[#;]/.test(s))
}
const local = section(iOS, 'filter_local')
const remote = section(iOS, 'filter_remote')
const policies = section(iOS, 'policy')
const normalize = line => line.split(',').map(s => s.trim().toLowerCase())
const rules = local.map(normalize)
const mainlandCritical = [
  'google.cn', 'google.com.cn', 'googleapis.cn', 'gstatic.cn',
  'bing.com.cn', 'apple.com.cn', 'apple.cn',
  'icloud.com.cn', 'icloud.cn', 'icloud-content.com.cn'
]
const matchesHost = (rule, host) => {
  if (rule[0] === 'host') return host === rule[1]
  if (rule[0] === 'host-suffix') return host === rule[1] || host.endsWith('.' + rule[1])
  return false
}

test('iOS filter has exactly one last rule: final,direct (never default proxy)', () => {
  const finals = rules.filter(rule => rule[0] === 'final')
  assert.deepEqual(finals, [['final', 'direct']])
  assert.deepEqual(rules.at(-1), ['final', 'direct'])
  assert.ok(!iOS.match(/^[ \t]*running_mode_trigger\s*=\s*.*all_proxy/im),
    'network switch must not silently activate full proxy mode')
  assert.ok(rules.some(r => r[0] === 'geoip' && r[1] === 'cn' && r[2] === 'direct'),
    'keep CN IP direct rule for apps dialing an IP directly')
})

test('mainland-specific domains match explicit direct rules before the iOS GEOIP/final', () => {
  const geoip = rules.findIndex(r => r[0] === 'geoip' && r[1] === 'cn')
  assert.ok(geoip >= 0)
  for (const host of mainlandCritical) {
    const matched = rules.slice(0, geoip).find(r => matchesHost(r, host))
    assert.ok(matched, 'mainland override missing: ' + host)
    assert.equal(matched[2], 'direct', 'CN service routed by exception: ' + host)
    assert.ok(rules.some(r => r[0] === 'host-suffix' && r[1] === host && r[2] === 'direct'),
      'expect an exact-suffix direct override, not an overbroad .cn rule: ' + host)
  }
  assert.ok(!rules.some(r => r[0] === 'host-suffix' && r[1] === 'cn'),
    'do not hijack all .cn properties (some domains need explicit overseas treatment)')
})

test('blacklist still routes explicit overseas services via their policy groups', () => {
  const required = new Map([
    ['github-pages.list', 'GitHub服务'],
    ['github.list', 'GitHub服务'],
    ['openai.list', '海外AI'],
    ['claude.list', '海外AI'],
    ['gemini.list', '海外AI'],
    ['youtube.list', '油管服务'],
    ['social.list', '社交媒体'],
    ['bilibili-video.list', 'BiliBili视频']
  ])
  for (const [file, policy] of required) {
    const lines = remote.filter(s => s.includes('/' + file + ','))
    assert.equal(lines.length, 1, 'missing or duplicated remote ' + file)
    assert.match(lines[0], new RegExp('force-policy=' + policy + '(?:,|$)'))
    assert.match(lines[0], /enabled=true(?:,|$)/)
  }
  assert.ok(policies.some(p => p.startsWith('static=BiliBili, direct,')),
    'domestic Bilibili keeps direct as its default candidate')
  assert.ok(policies.some(p => p.startsWith('static=苹果服务, direct,')),
    'domestic Apple uses a direct-first group')
  for (const keyword of ['github.com', 'chatgpt.com', 'youtube.com', 'claude.ai']) {
    assert.ok(!rules.some(r => matchesHost(r, keyword) && r[2] === 'direct'),
      'explicit overseas target should not be force-direct: ' + keyword)
  }
})

test('macOS remains on its existing final-proxy policy; UDP fallback is unrelated', () => {
  const macLocal = section(macOS, 'filter_local').map(normalize)
  assert.deepEqual(macLocal.at(-1), ['final', 'proxy'])
  assert.match(iOS, /^fallback_udp_policy=reject$/m)
  assert.ok(!iOS.includes('fallback_udp_policy=direct'),
    'UDP relay fallback is not a direct-connection retry mechanism')
})
