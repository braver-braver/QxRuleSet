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

test('macOS AI services use one strict shared exit with distinct first-party rule files', () => {
  assert.ok(policy.some(x => x.startsWith('static=海外AI, 🛡 AI联合安全节点, reject,')))
  assert.ok(policy.some(x => x.startsWith('static=🛡 AI联合安全节点, reject, server-tag-regex=')))
  for (const service of ['openai', 'claude', 'gemini']) {
    const r = remote.filter(x => x.includes('/rules/ai/' + service + '.list,'))
    assert.equal(r.length, 1, 'one resource required for ' + service)
    assert.match(r[0], /force-policy=海外AI(?:,|$)/)
    assert.match(r[0], /enabled=true(?:,|$)/)
  }
  for (const name of ['OpenAi服务', 'ClaudeAi服务', 'Gemini',
                      '🤖 OpenAI安全节点', '🧠 Claude安全节点', '✨ Gemini安全节点']) {
    assert.ok(!policy.some(x => x.startsWith('static=' + name + ',')), 'obsolete group: ' + name)
  }
  assert.ok(local.includes('host-suffix, manus.im, 全球策略'),
    'Manus is not a three-provider AI unlock dependency')
})

test('macOS retains updater exceptions and sticky only on the single shared AI provider', () => {
  assert.ok(policy.some(x => x.startsWith('static=AI应用更新,')))
  const updaterIndex = remote.findIndex(x => x.includes('/rules/ai/updates.list,'))
  const aiIndex = remote.findIndex(x => x.includes('/rules/ai/openai.list,'))
  assert.ok(updaterIndex >= 0 && updaterIndex < aiIndex)
  assert.match(remote[updaterIndex], /force-policy=AI应用更新(?:,|$)/)
  const sifterTasks = tasks.filter(x => x.includes('/ai-node-sifter.js#'))
  assert.equal(sifterTasks.length, 3, 'manual, cron and one network event only')
  assert.equal(sifterTasks.filter(x => x.startsWith('event-interaction ')).length, 1)
  assert.equal(sifterTasks.filter(x => x.startsWith('event-network ')).length, 1)
  assert.equal(sifterTasks.filter(x => /^[0-9]/.test(x)).length, 1)
  assert.ok(sifterTasks.every(x => x.includes('#provider=all&mode=sticky')))
  assert.ok(sifterTasks.some(x => x.includes('&trigger=network&delay=7')),
    'coalesce wake/reconnect checks after network stabilization')
  assert.doesNotMatch(mac, /ai-node-sifter\.js#provider=(?:openai|claude|gemini)/)
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
