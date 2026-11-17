// macOS Quantumult X routing regression: shared AI + targeted developer downloads.
// Static assertions are not proof of real QX request priority or connectivity.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const mac = readFileSync(new URL('../qx-macos.conf', import.meta.url), 'utf8')
const ios = readFileSync(new URL('../qx-ios.conf', import.meta.url), 'utf8')
function section(text, name) {
  const start = text.indexOf('[' + name + ']\n')
  assert.ok(start >= 0, 'missing section ' + name)
  return text.slice(start + name.length + 3).split(/\r?\n\[/)[0].split(/\r?\n/)
    .map(x => x.trim()).filter(x => x && !x.startsWith('#'))
}
const policy = section(mac, 'policy')
const local = section(mac, 'filter_local')
const remote = section(mac, 'filter_remote')
const tasks = section(mac, 'task_local')

test('macOS AI providers have independent sticky exits and only manual diagnostics', () => {
  for (const [service, policyName, pool] of [
    ['openai', 'OpenAi服务', '🤖 OpenAI安全节点'],
    ['claude', 'ClaudeAi服务', '🧠 Claude安全节点'],
    ['gemini', 'Gemini', '✨ Gemini安全节点']
  ]) {
    assert.ok(policy.some(x => x.startsWith('static=' + policyName + ', ' + pool + ', reject,')))
    const rule = remote.find(x => x.includes('/rules/ai/' + service + '.list,'))
    assert.ok(rule && rule.includes('force-policy=' + policyName + ','), service)
    const candidate = policy.find(x => x.startsWith('static=' + pool + ', reject, server-tag-regex='))
    assert.ok(candidate && /台湾|台灣|🇹🇼/.test(candidate))
  }
  assert.ok(!policy.some(x => x.startsWith('static=海外AI,')))
  assert.equal(tasks.length, 4)
  assert.ok(tasks.every(x => x.startsWith('event-interaction ')))
  assert.ok(!tasks.some(x => x.includes('ai-node-sifter.js')))
  for (const filename of ['geo-query.js','node-reputation.js','traffic-check.js','streaming-ui-check.js']) {
    assert.ok(tasks.some(x => x.includes(filename)), filename)
  }
})

test('updater stays independent of AI fixed exits', () => {
  assert.ok(policy.some(x => x.startsWith('static=AI应用更新,')))
  const updaterIndex = remote.findIndex(x => x.includes('/rules/ai/updates.list,'))
  const aiIndex = remote.findIndex(x => x.includes('/rules/ai/openai.list,'))
  assert.ok(updaterIndex >= 0 && updaterIndex < aiIndex)
  assert.match(remote[updaterIndex], /force-policy=AI应用更新(?:,|$)/)
  assert.ok(local.includes('host-suffix, manus.im, 全球策略'))
})

test('formulae.brew.sh routes to a direct-first, user-switchable Homebrew policy', () => {
  assert.ok(local.includes('host-suffix, formulae.brew.sh, Homebrew服务'))
  const homebrew = policy.find(x => x.startsWith('static=Homebrew服务, '))
  assert.ok(homebrew, 'missing Homebrew service group')
  const choices = homebrew.split(',').map(x => x.trim())
  assert.deepEqual(choices.slice(1, 4), ['direct', '🇸🇬 新加坡顺选·健康', '🇺🇸 美国顺选·健康'])
  assert.ok(choices.includes('proxy'), 'manual proxy fallback should remain available')
  assert.ok(!local.some(x => x.includes('formulae.brew.sh') && x.includes('🇨🇳 台湾')))
  // ghcr.io / GitHub sources still belong to GitHub service rules, not to Homebrew.
  assert.ok(remote.some(x => x.includes('/rules/services/github.list,') &&
                               x.includes('force-policy=GitHub服务')))
})

test('mainland-specific Google/Bing/Apple domains are explicit direct, not broad CN capture', () => {
  const mainland = ['google.cn', 'google.com.cn', 'googleapis.cn', 'gstatic.cn',
    'bing.com.cn', 'apple.cn', 'apple.com.cn', 'icloud.cn',
    'icloud.com.cn', 'icloud-content.com.cn']
  for (const host of mainland) {
    assert.ok(local.includes('host-suffix, ' + host + ', direct'),
      'missing mainland direct override: ' + host)
  }
  assert.ok(!local.includes('host-suffix, cn, direct'),
    'do not hijack the entire .cn suffix')
  assert.deepEqual(local.slice(-2), ['geoip, cn, direct', 'final, proxy'])
})

test('macOS changes do not rewrite iOS policies or private profile sections', () => {
  assert.match(ios, /^final, direct$/m)
  assert.match(ios, /^static=海外AI, 🛡 AI联合安全节点, reject,/m)
  assert.match(mac, /^fallback_udp_policy=reject$/m)
  assert.ok(!mac.includes('host-suffix, formulae.brew.sh, reject'))
})
