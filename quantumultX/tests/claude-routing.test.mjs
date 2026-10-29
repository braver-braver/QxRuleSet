// Offline QX Claude routing scope and priority checks.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const file = path => readFileSync(new URL(path, root), 'utf8')
const parse = content => content.split(/\r?\n/)
  .map(line => line.trim()).filter(line => line && !line.startsWith('#'))
  .map(line => line.split(',').map(part => part.trim()))
function hits([type, domain], host) {
  if (type === 'HOST-SUFFIX') return host === domain || host.endsWith('.' + domain)
  return type === 'HOST' && host === domain
}
const core = parse(file('rules/ai/claude.list'))
const telemetry = parse(file('rules/ai/claude-telemetry.list'))

test('official Claude Code API, OAuth, SSO, MCP, artifacts and downloads are covered', () => {
  for (const host of [
    'api.anthropic.com', 'platform.claude.com', 'sso.claude.com',
    'downloads.claude.ai', 'mcp-proxy.anthropic.com',
    'bridge.claudeusercontent.com', 'abc.frame.claudeusercontent.com',
    'assets-proxy.anthropic.com', 'widget.claudemcpcontent.com',
    'claudemcpclient.com', 'claude.com', 'clau.de'
  ]) {
    assert.ok(core.some(r => hits(r, host)), 'missing Claude host ' + host)
  }
  assert.ok(core.every(r => r.length === 3 && r[2] === 'ClaudeAi服务'))
})

test('default Claude list does not hijack shared third-party hosts or NTP', () => {
  for (const host of [
    'www.sentry.io', 'events.statsigapi.net', 'registry.npmjs.org',
    'raw.githubusercontent.com', 'storage.googleapis.com',
    'browser-intake-us5-datadoghq.com',
    'http-intake.logs.us5.datadoghq.com', 'cdn.usefathom.com',
    'abc.intercom.io', 'ntp.org', 'claude.ai.evil.example'
  ]) {
    assert.ok(!core.some(r => hits(r, host)), 'overbroad default: ' + host)
  }
  assert.ok(!core.some(r => r[0] === 'HOST-KEYWORD' || r[0].startsWith('IP-')))
})

test('optional telemetry includes only the two exact Datadog collectors', () => {
  assert.deepEqual(telemetry, [
    ['HOST', 'http-intake.logs.us5.datadoghq.com', 'ClaudeAi服务'],
    ['HOST', 'browser-intake-us5-datadoghq.com', 'ClaudeAi服务']
  ])
  for (const host of ['sub.http-intake.logs.us5.datadoghq.com',
    'browser-intake-us3-datadoghq.com', 'datadoghq.com', 'sentry.io']) {
    assert.ok(!telemetry.some(r => hits(r, host)), host)
  }
})

for (const platform of ['ios', 'macos']) {
  test(platform + ': Claude rules enabled and optional telemetry remains unloaded', () => {
    const text = file('qx-' + platform + '.conf')
    const remote = text.split('[filter_remote]')[1]?.split(/\n\[/)[0]
    assert.ok(remote)
    const lines = remote.split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'))
    const claude = lines.findIndex(s => s.includes('/rules/ai/claude.list,'))
    assert.ok(claude >= 0)
    assert.match(lines[claude], /force-policy=ClaudeAi服务/)
    assert.match(lines[claude], /enabled=true/)
    assert.ok(!lines.some(s => s.includes('/rules/ai/claude-telemetry.list,')))
    if (platform === 'macos') {
      const updates = lines.findIndex(s => s.includes('/rules/ai/updates.list,'))
      assert.ok(updates >= 0 && updates < claude)
    }
  })
}
