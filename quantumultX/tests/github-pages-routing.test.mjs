// Offline QX GitHub Pages ruleset priority and scope checks.
// A matching hostname and the remote insertion flag do not prove real QX network access.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const get = path => readFileSync(new URL(path, root), 'utf8')
const parse = text => text.split(/\r?\n/)
  .map(s => s.trim()).filter(s => s && !/^[#;]/.test(s))
  .map(s => s.split(',').map(x => x.trim()))
const matches = (rule, host) => rule[0].toLowerCase() === 'host-suffix'
  ? host === rule[1] || host.endsWith('.' + rule[1])
  : rule[0].toLowerCase() === 'host' && host === rule[1]
const pages = parse(get('rules/services/github-pages.list'))
const github = parse(get('rules/services/github.list'))

test('GitHub Pages exception matches github.io and its subdomains only', () => {
  assert.deepEqual(pages, [['HOST-SUFFIX', 'github.io', 'GitHub服务']])
  for (const host of ['github.io', 'user.github.io', 'project.user.github.io']) {
    assert.ok(pages.some(r => matches(r, host)), host)
  }
  for (const host of [
    'github.com', 'api.github.com', 'raw.githubusercontent.com',
    'github.io.evil.example', 'fakegithub.io', 'example.io',
    'assets.githubassets.com', 'registry.npmjs.org'
  ]) {
    assert.ok(!pages.some(r => matches(r, host)), host)
  }
  assert.ok(github.some(r => matches(r, 'user.github.io')),
    'keep legacy github.io coverage for existing private Profiles')
  assert.ok(pages.every(r => r[0] === 'HOST-SUFFIX' && r[2] === 'GitHub服务'))
})

for (const platform of ['ios', 'macos']) {
  test(platform + ': Pages resource is inserted, enabled and precedes local rules', () => {
    const conf = get('qx-' + platform + '.conf')
    const remote = conf.split('[filter_remote]')[1]?.split(/\n\[/)[0]
    assert.ok(remote, 'filter_remote missing')
    const entries = remote.split(/\r?\n/)
      .map(s => s.trim()).filter(s => s && !/^[#;]/.test(s))
    const pagesLines = entries.filter(s => s.includes('/rules/services/github-pages.list,'))
    assert.equal(pagesLines.length, 1)
    const line = pagesLines[0]
    assert.equal(entries[0], line, 'Pages inserted rule should be first remote rule')
    assert.match(line, /,\s*force-policy=GitHub服务(?:,|$)/)
    assert.match(line, /,\s*inserted-resource=true(?:,|$)/)
    assert.match(line, /,\s*enabled=true(?:,|$)/)
    assert.match(line, /,\s*opt-parser=false(?:,|$)/)
    assert.ok(entries.some(s => s.includes('/rules/services/github.list,') &&
      /force-policy=GitHub服务/.test(s)), 'preserve generic GitHub remote rules')
    const local = conf.split('[filter_local]')[1]?.split(/\n\[/)[0]
    assert.ok(local, 'filter_local missing')
    assert.ok(/geoip,\s*cn,\s*direct/i.test(local), 'existing China direct rule kept')
    assert.ok(/final,\s*proxy/i.test(local), 'existing fallback kept')
    const localDomainRules = parse(local).filter(r =>
      ['host', 'host-suffix'].includes(r[0].toLowerCase()))
    for (const host of ['github.io', 'user.github.io', 'project.user.github.io']) {
      assert.ok(!localDomainRules.some(r => matches(r, host)),
        'local host rule may shadow inserted Pages rule: ' + host)
    }
    assert.match(conf, /QxRuleSet-Template-Version: 2026\.11\.04\.1/)
  })
}

test('Pages rules do not alter other GitHub, Apple, AI or CDN policies', () => {
  assert.ok(!pages.some(r => matches(r, 'github.com')))
  assert.ok(!pages.some(r => matches(r, 'api.anthropic.com')))
  assert.ok(!pages.some(r => matches(r, 'gdmf.apple.com')))
  assert.ok(!pages.some(r => matches(r, 'downloads.claude.ai')))
  assert.ok(!pages.some(r => matches(r, 'cdn.jsdelivr.net')))
  assert.ok(!pages.some(r => matches(r, 'example.cloudfront.net')))
})
