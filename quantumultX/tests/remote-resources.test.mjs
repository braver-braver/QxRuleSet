// Static audit of all remote Quantumult X rules and their parser contract.
// This checks tracked paths/syntax, not QX network fetch or live URL availability.
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const upstreamFilter =
  'https://raw.githubusercontent.com/limbopro/Adblock4limbo/main/QuantumultX/rule/Adblock4limbo.list'
const upstreamRewrite =
  'https://raw.githubusercontent.com/limbopro/Adblock4limbo/main/QuantumultX/rewrite/Adblock4limbo.conf'
const nativeKinds = new Set([
  'HOST', 'HOST-SUFFIX', 'HOST-KEYWORD', 'HOST-WILDCARD', 'IP-CIDR',
  'IP6-CIDR', 'GEOIP', 'IP-ASN', 'USER-AGENT'
])

function section(text, name) {
  const block = text.split('[' + name + ']')[1]?.split(/\r?\n\[/)[0]
  assert.ok(block, 'missing [' + name + ']')
  return block.split(/\r?\n/)
    .map(line => line.trim()).filter(line => line && !/^[#;]/.test(line))
}

function resources(conf, name) {
  return section(conf, name)
    .filter(line => /^https?:\/\//.test(line))
    .map(line => {
      const [url, ...args] = line.split(',').map(x => x.trim())
      const fields = new Map(args.map(x => {
        const index = x.indexOf('=')
        return [x.slice(0, index), x.slice(index + 1)]
      }))
      return { url, fields }
    })
}

function localPath(url) {
  const base = 'https://raw.githubusercontent.com/braver-braver/QxRuleSet/refs/heads/main/'
  return url.startsWith(base) ? url.slice(base.length) : null
}

for (const platform of ['ios', 'macos']) {
  const conf = readFileSync(new URL('qx-' + platform + '.conf', root), 'utf8')

  test(platform + ': all self-maintained remote resources have existing nonempty files', () => {
    const local = [...resources(conf, 'filter_remote'), ...resources(conf, 'rewrite_remote')]
      .filter(item => localPath(item.url) !== null)
    assert.ok(local.length >= 20, 'unexpectedly empty remote-resource inventory')
    for (const { url } of local) {
      const rel = localPath(url)
      assert.ok(rel.startsWith('quantumultX/'), 'unexpected raw source: ' + rel)
      const file = new URL(rel.slice('quantumultX/'.length), root)
      assert.ok(existsSync(file), 'missing remote file: ' + rel)
      assert.ok(readFileSync(file, 'utf8').trim().length > 30, 'empty remote file: ' + rel)
    }
  })

  test(platform + ': all first-party filter files use native QX rule types', () => {
    const remotes = resources(conf, 'filter_remote').filter(r => localPath(r.url) !== null)
    assert.ok(remotes.length >= 18, 'must check nonempty rule inventory')
    for (const remote of remotes) {
      assert.equal(remote.fields.get('opt-parser'), 'false',
        'first-party QX rules must remain native: ' + remote.url)
      const path = localPath(remote.url).slice('quantumultX/'.length)
      const rules = sectionText(readFileSync(new URL(path, root), 'utf8'))
      assert.ok(rules.length > 0, 'empty rule list: ' + path)
      const seen = new Set()
      for (const rule of rules) {
        const parts = rule.split(',').map(p => p.trim())
        assert.ok(nativeKinds.has(parts[0]), 'not a native QX rule: ' + path + ' ' + rule)
        assert.ok(parts.length === 3 ||
          (parts.length === 4 && parts[3] === 'no-resolve'),
          'invalid rule field count: ' + path + ' ' + rule)
        assert.ok(parts[1] && parts[2], 'empty match/policy: ' + path + ' ' + rule)
        const key = parts[0] + ',' + parts[1]
        assert.ok(!seen.has(key), 'duplicate QX match in ' + path + ': ' + key)
        seen.add(key)
      }
    }
  })

  test(platform + ': imported Adblock4limbo has a real parser for DOMAIN-* rules', () => {
    const confRemote = resources(conf, 'filter_remote')
    const thirdParty = confRemote.filter(item => localPath(item.url) === null)
    assert.equal(thirdParty.length, 1, 'unexpected external filter URL')
    const adblock = thirdParty[0]
    assert.equal(adblock.url, upstreamFilter)
    assert.equal(adblock.fields.get('enabled'), 'true')
    assert.equal(adblock.fields.get('force-policy'), '广告拦截')
    assert.equal(adblock.fields.get('opt-parser'), 'true',
      'upstream uses DOMAIN/DOMAIN-SUFFIX/DOMAIN-KEYWORD, not native HOST syntax')
    assert.match(conf, /^resource_parser_url=https:\/\/raw\.githubusercontent\.com\/KOP-XIAO\/QuantumultX\/master\/Scripts\/resource-parser\.js$/m)
    const groups = section(conf, 'policy').filter(line => /^(static|available|url-latency-benchmark)=/.test(line))
    assert.ok(groups.some(line => line.startsWith('static=广告拦截, reject, ')))
  })

  test(platform + ': optional Adblock4limbo rewrite uses the upstream QX format', () => {
    const rewrites = resources(conf, 'rewrite_remote')
    const adblocks = rewrites.filter(x => x.fields.get('tag') === 'Adblock4limbo Rewrite')
    assert.equal(adblocks.length, 1)
    assert.equal(adblocks[0].url, upstreamRewrite)
    assert.equal(adblocks[0].fields.get('enabled'), 'false')
    assert.equal(adblocks[0].fields.get('opt-parser'), 'false')
  })

  test(platform + ': no duplicated remote resources or unknown forced policies', () => {
    const entries = resources(conf, 'filter_remote')
    const urls = entries.map(x => x.url)
    assert.equal(new Set(urls).size, urls.length, 'duplicated filter resource')
    const groups = new Set(section(conf, 'policy')
      .filter(x => /^(static|available|url-latency-benchmark|ssid)=/.test(x))
      .map(x => x.split('=')[1].split(',')[0].trim()))
    for (const item of entries) {
      assert.ok(['true', 'false'].includes(item.fields.get('enabled')),
        'resource enabled is missing: ' + item.url)
      const policy = item.fields.get('force-policy')
      assert.ok(['direct', 'proxy', 'reject'].includes(policy) || groups.has(policy),
        'unresolved force-policy=' + policy + ': ' + item.url)
    }
  })
}

function sectionText(text) {
  return text.split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !/^[#;]/.test(line))
}
