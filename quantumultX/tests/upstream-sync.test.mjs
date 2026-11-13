import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  BEGIN, END, validHostname, parseDomainRule, parseDomainRules,
  stripManaged, covers, overlaps, reconcileTarget, syncUpstreams
} from '../../scripts/sync-qx-upstreams.mjs'

const url = name => 'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/' +
  'rule/QuantumultX/' + name + '/' + name + '.list'
const config = {
  name: 'GitHub', mode: 'sync', target: 'quantumultX/rules/services/github.list',
  url: url('GitHub'), policy: 'GitHub服务',
  allowSuffixes: ['github.com', 'github.io', 'dependabot.com', 'ghcr.io'],
  minRules: 2
}
const manual = '## GitHub\nHOST-SUFFIX,github.com,GitHub服务\n'

test('accepts normal domains and rejects IP, wildcard, URL and malformed hostnames', () => {
  for (const host of ['github.com', 'my-repo.github.io', 'ghcr.io', 'xn--example.test']) {
    assert.ok(validHostname(host), host)
  }
  for (const host of [
    '*.github.com', '192.168.1.1', 'https://github.com', 'github.com/evil',
    'github.com.evil.', '-foo.com', 'foo..bar.com', 'foo.com:443', 'foo'
  ]) assert.ok(!validHostname(host), host)
})

test('only exact native HOST/HOST-SUFFIX matchers can enter managed list', () => {
  const text = [
    'HOST-SUFFIX,dependabot.com,GitHub', 'HOST,sub.github.com,GitHub',
    'HOST-KEYWORD,github,GitHub', 'IP-CIDR,1.2.3.0/24,GitHub',
    'USER-AGENT,GitHub*,GitHub', 'DOMAIN-SUFFIX,github.net,GitHub',
    'HOST-SUFFIX,github.com.evil.example,GitHub',
    'HOST-SUFFIX,*.github.com,GitHub',
    'HOST-SUFFIX,dependabot.com,GitHub'
  ].join('\n')
  const rules = parseDomainRules(text)
  assert.deepEqual(rules.map(r => r.kind + ':' + r.domain), [
    'HOST-SUFFIX:dependabot.com',
    'HOST:sub.github.com',
    'HOST-SUFFIX:github.com.evil.example'
  ])
  assert.equal(parseDomainRule('HOST-SUFFIX,github.io,GitHub')?.domain, 'github.io')
})

test('suffix coverage and overlap respect domain-label boundaries', () => {
  const suffix = { kind: 'HOST-SUFFIX', domain: 'github.com' }
  assert.ok(covers(suffix, { kind: 'HOST', domain: 'api.github.com' }))
  assert.ok(overlaps(suffix, { kind: 'HOST-SUFFIX', domain: 'raw.github.com' }))
  assert.ok(!covers(suffix, { kind: 'HOST', domain: 'fakegithub.com' }))
  assert.ok(!overlaps(suffix, { kind: 'HOST-SUFFIX', domain: 'github.com.evil.example' }))
  assert.ok(!covers({ kind: 'HOST', domain: 'api.github.com' },
    { kind: 'HOST-SUFFIX', domain: 'github.com' }))
})

test('only allowlisted first-party domain additions are appended, without replacing manual rules', () => {
  const upstream = parseDomainRules([
    'HOST-SUFFIX,github.com,GitHub', 'HOST,api.github.com,GitHub',
    'HOST-SUFFIX,dependabot.com,GitHub',
    'HOST-SUFFIX,github.com.evil.example,GitHub',
    'HOST-KEYWORD,github,GitHub', 'HOST-SUFFIX,shared-cdn.net,GitHub'
  ].join('\n'))
  const result = reconcileTarget(manual, upstream, config)
  assert.match(result.content, /HOST-SUFFIX,github.com,GitHub服务/)
  assert.match(result.content, /HOST-SUFFIX,dependabot.com,GitHub服务/)
  assert.doesNotMatch(result.content, /github.com.evil.example|shared-cdn.net|HOST-KEYWORD/)
  assert.equal(result.managed.length, 1)
  assert.ok(result.content.includes(BEGIN) && result.content.includes(END))
  assert.equal(reconcileTarget(result.content, upstream, config).content, result.content)
})

test('different policy or PCDN/CDN overlapping targets are never silently remapped', () => {
  const rules = parseDomainRules('HOST-SUFFIX,ghcr.io,GitHub')
  const out = reconcileTarget(manual, rules, config, [
    { kind: 'HOST-SUFFIX', domain: 'ghcr.io', policy: '其他服务' }
  ])
  assert.deepEqual(out.skippedConflict, ['HOST-SUFFIX,ghcr.io'])
  assert.equal(out.managed.length, 0)
})

test('a disappearing upstream-managed rule is removable without deleting manual rules', () => {
  const first = reconcileTarget(manual,
    parseDomainRules('HOST-SUFFIX,dependabot.com,GitHub'), config)
  const next = reconcileTarget(first.content,
    parseDomainRules('HOST-SUFFIX,github.com,GitHub'), config)
  assert.equal(next.content, manual)
  assert.ok(!next.content.includes(BEGIN))
})

test('unbalanced or duplicate managed block markers fail closed', () => {
  assert.throws(() => stripManaged(manual + BEGIN), /Malformed/)
  assert.throws(() => stripManaged(manual + END), /Malformed/)
  assert.throws(() => stripManaged(manual + BEGIN + '\n' + END + BEGIN + END), /Malformed/)
})

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'qx-upstreams-'))
  await mkdir(join(root, 'quantumultX/rules/ai'), { recursive: true })
  await mkdir(join(root, 'quantumultX/rules/services'), { recursive: true })
  await writeFile(join(root, config.target), manual)
  const manifest = {
    schema: 1,
    sources: [config, {
      name: 'Apple', mode: 'audit',
      url: url('Apple'), minRules: 2
    }]
  }
  await writeFile(join(root, 'quantumultX/upstreams.json'),
    JSON.stringify(manifest, null, 2) + '\n')
  const payload = {
    GitHub: 'HOST-SUFFIX,github.com,GitHub\nHOST-SUFFIX,dependabot.com,GitHub\n',
    Apple: 'HOST-SUFFIX,apple.com,Apple\nHOST-SUFFIX,apple.co,Apple\n'
  }
  const getSource = async upstream => {
    const name = upstream.match(/\/([A-Za-z]+)\/\1\.list$/)?.[1]
    if (!name || !payload[name]) throw new Error('no mock for ' + upstream)
    return payload[name]
  }
  return { root, payload, getSource }
}

test('offline plan, apply, and second run are deterministic and audit-only does not rewrite Apple', async () => {
  const f = await fixture()
  try {
    const plan = await syncUpstreams({ root: f.root, getSource: f.getSource })
    assert.deepEqual(plan.changes.map(x => x.path).sort(), [
      config.target, 'quantumultX/upstream-state.json'
    ].sort())
    assert.equal(await readFile(join(f.root, config.target), 'utf8'), manual)
    const applied = await syncUpstreams({ root: f.root, getSource: f.getSource, apply: true })
    assert.equal(applied.changes.length, 2)
    assert.match(await readFile(join(f.root, config.target), 'utf8'), /dependabot.com/)
    const state = JSON.parse(await readFile(join(f.root, 'quantumultX/upstream-state.json')))
    assert.equal(state.sources.Apple.mode, 'audit')
    assert.equal(state.sources.GitHub.managed, 1)
    const repeat = await syncUpstreams({ root: f.root, getSource: f.getSource, apply: true })
    assert.equal(repeat.changes.length, 0)
    assert.ok(repeat.summaries.every(x => !x.sourceChanged))
  } finally { await rm(f.root, { recursive: true, force: true }) }
})

test('an upstream audit-only change updates fingerprint without touching service rules', async () => {
  const f = await fixture()
  try {
    await syncUpstreams({ root: f.root, getSource: f.getSource, apply: true })
    f.payload.Apple = 'HOST-SUFFIX,apple.com,Apple\nHOST-SUFFIX,apple.org,Apple\n'
    const result = await syncUpstreams({ root: f.root, getSource: f.getSource, apply: true })
    assert.deepEqual(result.changes.map(x => x.path), ['quantumultX/upstream-state.json'])
    assert.ok(result.summaries.find(x => x.name === 'Apple').sourceChanged)
  } finally { await rm(f.root, { recursive: true, force: true }) }
})

test('truncated or HTML upstream aborts before any files are modified', async () => {
  const f = await fixture()
  try {
    for (const bad of ['<html>429 error</html>', 'HOST,github.com,GitHub\n']) {
      await assert.rejects(() => syncUpstreams({
        root: f.root, apply: true,
        getSource: async upstream => upstream.includes('/GitHub/') ?
          bad : f.payload.Apple
      }), /upstream|Non-text/i)
      assert.equal(await readFile(join(f.root, config.target), 'utf8'), manual)
      await assert.rejects(readFile(join(f.root, 'quantumultX/upstream-state.json')), {
        code: 'ENOENT'
      })
    }
  } finally { await rm(f.root, { recursive: true, force: true }) }
})

test('untrusted upstream URL is rejected without fetching', async () => {
  const f = await fixture()
  try {
    const path = join(f.root, 'quantumultX/upstreams.json')
    const manifest = JSON.parse(await readFile(path))
    manifest.sources[0].url = 'https://evil.example/rules?token=abc'
    await writeFile(path, JSON.stringify(manifest))
    await assert.rejects(() => syncUpstreams({
      root: f.root, getSource: async () => { throw new Error('should never fetch') }
    }), /outside approved/)
  } finally { await rm(f.root, { recursive: true, force: true }) }
})

test('all real manifest targets have unique paths, trusted sources and explicit allowed suffixes', async () => {
  const path = new URL('../upstreams.json', import.meta.url)
  const manifest = JSON.parse(await readFile(path, 'utf8'))
  const names = new Set()
  const paths = new Set()
  for (const entry of manifest.sources) {
    assert.ok(!names.has(entry.name), entry.name)
    names.add(entry.name)
    assert.ok(entry.url.startsWith(
      'https://raw.githubusercontent.com/blackmatrix7/ios_rule_script/master/'))
    if (entry.mode === 'sync') {
      assert.ok(!paths.has(entry.target), entry.target)
      paths.add(entry.target)
      assert.ok(entry.allowSuffixes.length)
      for (const suffix of entry.allowSuffixes) assert.ok(validHostname(suffix), suffix)
      assert.ok(entry.minRules >= 2)
    }
  }
  assert.ok(paths.size >= 7, 'not enough maintained service sources')
})
