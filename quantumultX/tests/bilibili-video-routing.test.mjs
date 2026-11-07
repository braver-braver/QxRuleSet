// Offline regression: separate Bilibili video CDN routing without changing Bilibili API.
 // This cannot establish QX runtime rule hits, region licensing, or network throughput.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const file = path => readFileSync(new URL(path, root), 'utf8')
const parseRules = source => source.split(/\r?\n/)
  .map(s => s.trim()).filter(s => s && !/^[#;]/.test(s))
  .map(s => s.split(',').map(x => x.trim()))
const matches = (rule, host) => rule[0].toUpperCase() === 'HOST'
  ? host === rule[1]
  : rule[0].toUpperCase() === 'HOST-SUFFIX' &&
    (host === rule[1] || host.endsWith('.' + rule[1]))

const source = parseRules(file('rules/services/bilibili.list'))
const video = parseRules(file('rules/services/bilibili-video.list'))
const pcdn = parseRules(file('rules/services/bilibili-pcdn.list'))
const hosts = [
  'upos-sz-mirrorcos.bilivideo.com',
  'upos-sz-mirroraliov.bilivideo.com',
  'xy1.mcdn.bilivideo.cn',
  'cn-jxnc-cmcc-bcache-06.bilivideo.com',
  'upos-hz-mirrorakam.akamaized.net',
  'upos-bstar-mirrorakam.akamaized.net',
  'upos-sz-mirrorasiaov.bilibilivideo.com',
  'v1d.szbdyd.com',
  'edge.v1d.szbdyd.com'
]
const unrelated = [
  'api.bilibili.com', 'www.bilibili.com', 'apiintl.biliapi.net',
  'tv.bilibili.com', 'hdslb.com', 'i0.hdslb.com', 'b23.tv',
  'other.akamaized.net', 'unrelated.bilibilivideo.com',
  'szbdyd.com', 'mountaintoys.cn', 'cdn.jsdelivr.net',
  'upos-hz-mirrorakam.akamaized.net.evil.example',
  'evil-mcdn.bilivideo.net'
]

test('video rules cover observed Bilibili player delivery hosts only', () => {
  for (const host of hosts) assert.ok(video.some(r => matches(r, host)), host)
  for (const host of unrelated) assert.ok(!video.some(r => matches(r, host)), host)
  assert.ok(video.every(r => r.length === 3 &&
    ['HOST', 'HOST-SUFFIX'].includes(r[0]) && r[2] === 'BiliBili视频'))
  assert.equal(video.length, 6, 'only six narrow CDN patterns')
})

test('legacy Bilibili service/API rules remain available and direct by default', () => {
  for (const host of [
    'api.bilibili.com', 'www.bilibili.com',
    'i0.hdslb.com', 'mcdn.bilivideo.cn', 'apiintl.biliapi.net'
  ]) assert.ok(source.some(r => matches(r, host)), 'lost service host ' + host)
  assert.ok(source.every(r => r[2] === 'BiliBili'))
})

test('optional PCDN policy covers only known problematic hostname families', () => {
  assert.deepEqual(pcdn, [
    ['HOST-SUFFIX', 'mcdn.bilivideo.cn', 'reject'],
    ['HOST-SUFFIX', 'mcdn.bilivideo.com', 'reject'],
    ['HOST-SUFFIX', 'v1d.szbdyd.com', 'reject']
  ])
  for (const host of ['mcdn.bilivideo.cn', 'xx.mcdn.bilivideo.com', 'v1d.szbdyd.com']) {
    assert.ok(pcdn.some(r => matches(r, host)), host)
    assert.ok(video.some(r => matches(r, host)), 'opt-in rule must override a video-route match')
  }
  for (const host of ['upos-sz-mirrorali.bilivideo.com', 'cn-jxnc-cmcc-bcache-06.bilivideo.com',
    'www.bilibili.com', 'pcdn.biliapi.net', 'mountaintoys.cn',
    'bad.v1d.szbdyd.com.evil.example']) {
    assert.ok(!pcdn.some(r => matches(r, host)), host)
  }
})

for (const platform of ['ios', 'macos']) {
  test(platform + ': video has independent policy inheriting the existing BiliBili choice', () => {
    const conf = file('qx-' + platform + '.conf')
    const policies = conf.split('[policy]')[1]?.split(/\n\[/)[0]
    assert.ok(policies, 'policy section missing')
    const group = policies.split(/\r?\n/).find(s => s.startsWith('static=BiliBili视频,'))
    const original = policies.split(/\r?\n/).find(s => s.startsWith('static=BiliBili,'))
    assert.ok(group && original, 'both video and BiliBili groups required')
    assert.match(original, /^static=BiliBili, direct, proxy, reject,/)
    assert.ok(group.startsWith('static=BiliBili视频, BiliBili, direct,'),
      'video should inherit BiliBili region selection by default')
    for (const name of ['🇭🇰 香港顺选·健康', '🇨🇳 台湾顺选·健康', 'proxy']) {
      assert.ok(group.includes(', ' + name + ','), 'missing manual video A/B choice ' + name)
    }
  })

  test(platform + ': PCDN opt-in precedes video routes; both beat local GEOIP', () => {
    const conf = file('qx-' + platform + '.conf')
    const remote = conf.split('[filter_remote]')[1]?.split(/\n\[/)[0]
    const local = conf.split('[filter_local]')[1]?.split(/\n\[/)[0]
    assert.ok(remote && local, 'filter sections missing')
    const lines = remote.split(/\r?\n/)
      .map(x => x.trim()).filter(x => x && !/^[#;]/.test(x))
    const pcdnI = lines.findIndex(x => x.includes('/rules/services/bilibili-pcdn.list,'))
    const videoI = lines.findIndex(x => x.includes('/rules/services/bilibili-video.list,'))
    const serviceI = lines.findIndex(x => x.includes('/rules/services/bilibili.list,'))
    assert.ok(pcdnI >= 0 && videoI > pcdnI && serviceI > videoI)
    const pcdnEntry = lines[pcdnI]
    const videoEntry = lines[videoI]
    const normalEntry = lines[serviceI]
    assert.match(pcdnEntry, /, *force-policy=reject(?:,|$)/)
    assert.match(pcdnEntry, /, *inserted-resource=true(?:,|$)/)
    assert.match(pcdnEntry, /, *enabled=false(?:,|$)/)
    assert.match(videoEntry, /, *force-policy=BiliBili视频(?:,|$)/)
    assert.match(videoEntry, /, *inserted-resource=true(?:,|$)/)
    assert.match(videoEntry, /, *enabled=true(?:,|$)/)
    assert.match(normalEntry, /, *force-policy=BiliBili(?:,|$)/)
    assert.match(normalEntry, /, *enabled=true(?:,|$)/)
    assert.match(local, /geoip, *cn, *direct/i)
    const localHosts = parseRules(local)
      .filter(r => ['HOST', 'HOST-SUFFIX'].includes(r[0].toUpperCase()))
    for (const host of hosts) {
      assert.ok(!localHosts.some(r => matches(r, host)),
        'explicit local domain rule could intercept CDN: ' + host)
    }
    const appleUpdateI = lines.findIndex(x => x.includes('/rules/services/apple-updates.list,'))
    assert.ok(appleUpdateI >= 0 && appleUpdateI < pcdnI,
      'retain Apple update resource priority among ordinary rules')
  })

  test(platform + ': default PCDN opt-in cannot reject unrelated Apple, AI or web domains', () => {
    const conf = file('qx-' + platform + '.conf')
    const remote = conf.split('[filter_remote]')[1]?.split(/\n\[/)[0]
    const pcdnLine = remote.split(/\r?\n/).find(s => s.includes('/rules/services/bilibili-pcdn.list,'))
    assert.match(pcdnLine, /enabled=false(?:,|$)/)
    for (const host of ['apple.com', 'tv.apple.com', 'api.anthropic.com',
      'github.io', 'www.bilibili.com', 'cdn.jsdelivr.net', 'example.cloudfront.net']) {
      assert.ok(!pcdn.some(r => matches(r, host)), host)
    }
  })
}
