// iOS-only unified AI node selection. All probes are mocked; no real keys/network.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const script = readFileSync(new URL('../ai-node-sifter.js', import.meta.url), 'utf8')
const entry = '\n;(async () => {'
assert.equal(script.split(entry).length, 2, 'test helpers without mutating QX policies')
const definitions = script.split(entry)[0]
const ios = readFileSync(new URL('../../qx-ios.conf', import.meta.url), 'utf8')
const mac = readFileSync(new URL('../../qx-macos.conf', import.meta.url), 'utf8')

const invalidGemini = JSON.stringify({
  error: {
    code: 400, status: 'INVALID_ARGUMENT',
    details: [{
      '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
      reason: 'API_KEY_INVALID',
      domain: 'googleapis.com',
      metadata: { service: 'generativelanguage.googleapis.com' }
    }]
  }
})

function mockNetwork(overrides = {}) {
  const calls = []
  const defaultResponses = {
    'chatgpt.com/cdn-cgi/trace': { statusCode: 200, body: 'fl=1\nloc=US\n' },
    'claude.ai/cdn-cgi/trace': { statusCode: 200, body: 'loc=US\n' },
    'ipapi.co/json/': { statusCode: 200, body: '{"country_code":"US"}' },
    'chatgpt.com/': { statusCode: 200, body: '<html><title>ChatGPT</title></html>' },
    'claude.ai/': { statusCode: 200, body: '<html><title>Claude</title></html>' },
    'gemini.google.com/app': { statusCode: 200, body: '<html><title>Gemini</title></html>' },
    'api.openai.com/v1/models': {
      statusCode: 401, body: '{"error":{"message":"Invalid API key","code":"invalid_api_key"}}'
    },
    'api.anthropic.com/v1/models': {
      statusCode: 401,
      body: '{"type":"error","error":{"type":"authentication_error","message":"Invalid key"}}'
    },
    'generativelanguage.googleapis.com/v1beta/models': {
      statusCode: 400, body: invalidGemini
    }
  }
  const context = {
    $task: {
      fetch(req) {
        calls.push(req)
        const key = Object.keys(defaultResponses).find(candidate =>
          new URL(req.url).href.startsWith('https://' + candidate))
        assert.ok(key, 'unexpected URL: ' + req.url)
        return Promise.resolve(overrides[key] ?? defaultResponses[key])
      }
    },
    setTimeout, clearTimeout
  }
  runInNewContext(definitions, context, { timeout: 2000 })
  return { context, calls }
}

test('one iOS AI policy is used for all 3 first-party rules, with direct-first fallback', () => {
  assert.match(ios, /^static=海外AI, 🛡 AI联合安全节点, reject,/m)
  assert.match(ios, /^static=🛡 AI联合安全节点, reject, server-tag-regex=/m)
  for (const name of ['openai', 'claude', 'gemini']) {
    const row = ios.split('\n').find(s => s.includes('/rules/ai/' + name + '.list,'))
    assert.ok(row, name)
    assert.match(row, /force-policy=海外AI(?:,|$)/)
    assert.match(row, /enabled=true(?:,|$)/)
  }
  assert.equal((ios.match(/event-interaction [^\n]*ai-node-sifter\.js#provider=all(?:,|&)/g) || []).length, 1)
  assert.equal((ios.match(/^[0-9, *]+ https:[^\n]*ai-node-sifter\.js#provider=all(?:,|&)/gm) || []).length, 1)
  assert.doesNotMatch(ios, /ai-node-sifter\.js#provider=(?:openai|claude|gemini)/)
  for (const name of ['OpenAi服务', 'ClaudeAi服务', 'Gemini']) {
    assert.ok(!ios.includes('static=' + name + ','), 'legacy iOS policy clutter: ' + name)
  }
  assert.match(ios, /^final, direct$/m)
})

test('macOS retains original independent AI policies, tasks and routing', () => {
  for (const name of ['OpenAi服务', 'ClaudeAi服务', 'Gemini']) {
    assert.ok(mac.includes('static=' + name + ','))
  }
  for (const name of ['openai', 'claude', 'gemini']) {
    assert.match(mac, new RegExp('ai-node-sifter\\.js#provider=' + name + '&mode=sticky'))
    const row = mac.split('\n').find(s => s.includes('/rules/ai/' + name + '.list,'))
    assert.ok(row && !row.includes('force-policy=海外AI'), name)
  }
  assert.ok(!mac.includes('static=海外AI,'))
  assert.match(mac, /^final, proxy$/m)
})

test('a single concrete node must pass OpenAI, Claude and Gemini probes', async () => {
  const { context, calls } = mockNetwork()
  const result = await context.testNode('all', 'US-01')
  assert.equal(result.status, 'pass')
  assert.equal(result.node, 'US-01')
  assert.equal(result.region, 'US')
  const endpointNames = ['api.openai.com', 'api.anthropic.com', 'generativelanguage.googleapis.com']
  for (const host of endpointNames) {
    assert.ok(calls.some(c => new URL(c.url).hostname === host), host)
  }
  assert.ok(calls.length >= 9, 'all 3 providers are genuinely probed')
  assert.ok(calls.every(c => c.opts?.policy === 'US-01'), 'all checks must use the same node')
})

test('a confirmed unsupported region on any AI provider rejects the common node', async () => {
  const { context } = mockNetwork({
    'claude.ai/': { statusCode: 451, body: '<html><title>Country not supported</title></html>' }
  })
  const result = await context.testNode('all', 'US-01')
  assert.equal(result.status, 'fail')
  assert.match(result.reason, /Claude/i)
})

test('generic API gateway HTTP errors must not count as common AI PASS', async () => {
  const cases = [
    ['api.openai.com/v1/models', 401, '<html>Gateway Unauthorized</html>'],
    ['api.openai.com/v1/models', 429, '{"error":"rate limited"}'],
    ['generativelanguage.googleapis.com/v1beta/models', 400, '<html>invalid key</html>'],
    ['generativelanguage.googleapis.com/v1beta/models', 200, '<html>hello</html>']
  ]
  for (const [key, statusCode, body] of cases) {
    const { context } = mockNetwork({ [key]: { statusCode, body } })
    const result = await context.testNode('all', 'US-01')
    assert.equal(result.status, 'uncertain', key + ':' + statusCode)
  }
})

test('inconsistent exit region observations are inconclusive, not fully verified', async () => {
  const { context } = mockNetwork({
    'ipapi.co/json/': { statusCode: 200, body: '{"country_code":"JP"}' }
  })
  const result = await context.testNode('all', 'US-01')
  assert.equal(result.status, 'uncertain')
  assert.match(result.reason, /region|地区/i)
})

test('invalid openai models response and Gemini models response remain inconclusive', async () => {
  const { context } = mockNetwork({
    'api.openai.com/v1/models': { statusCode: 200, body: '{"hello":"world"}' }
  })
  assert.equal((await context.testNode('all', 'US-01')).status, 'uncertain')
})

test('untrusted Web redirects and 204 cannot falsely validate the common node', async () => {
  const cases = [
    ['chatgpt.com/', { statusCode: 302, headers: { location: 'https://portal.example/login' }, body: '' }],
    ['chatgpt.com/', { statusCode: 204, body: '' }],
    ['gemini.google.com/app', { statusCode: 302, headers: { location: 'https://accounts.google.com.evil.example/login' }, body: '' }],
    ['gemini.google.com/app', { statusCode: 204, body: '' }]
  ]
  for (const [key, response] of cases) {
    const { context } = mockNetwork({ [key]: response })
    const result = await context.testNode('all', 'US-01')
    assert.equal(result.status, 'uncertain', key + ' ' + response.statusCode)
  }
})

test('trusted first-party HTTPS login redirects remain viable common-node evidence', async () => {
  const { context } = mockNetwork({
    'chatgpt.com/': { statusCode: 302, headers: { Location: 'https://auth.openai.com/login' }, body: '' },
    'gemini.google.com/app': { statusCode: 302, headers: { Location: 'https://accounts.google.com/ServiceLogin' }, body: '' }
  })
  assert.equal((await context.testNode('all', 'US-01')).status, 'pass')
})

async function runFullSifter(overrides = {}) {
  const mock = mockNetwork(overrides)
  const actions = []
  const responses = []
  const context = {
    $environment: {
      sourcePath: 'https://example.test/ai-node-sifter.js#provider=all',
      params: '', executeType: '1'
    },
    $task: mock.context.$task,
    $prefs: { valueForKey: () => '', setValueForKey: () => true },
    $configuration: {
      async sendMessage(message) {
        actions.push(message)
        if (message.action === 'get_customized_policy') {
          return { ret: { '🛡 AI联合安全节点': { candidates: ['reject', 'US-01'] } } }
        }
        if (message.action === 'get_policy_state') {
          return { ret: { '🛡 AI联合安全节点': ['reject'] } }
        }
        if (message.action === 'url_latency_benchmark') {
          return { ret: { 'US-01': [true, 35] } }
        }
        if (message.action === 'set_policy_state') return { ret: {} }
        throw new Error('unexpected QX config action: ' + message.action)
      }
    },
    $done(value) { responses.push(value) },
    $notify() { throw new Error('manual task should not notify') },
    setTimeout, clearTimeout
  }
  await runInNewContext(script, context, { timeout: 2000 })
  return { actions, responses, calls: mock.calls }
}

test('full provider=all task selects only the jointly verified leaf policy', async () => {
  const out = await runFullSifter()
  const writes = out.actions.filter(a => a.action === 'set_policy_state')
  assert.equal(writes.length, 1)
  assert.equal(writes[0].content['🛡 AI联合安全节点'], 'US-01')
  assert.equal(out.responses.length, 1)
  assert.match(out.responses[0].title, /海外AI/)
  assert.ok(out.calls.every(c => c.opts?.policy === 'US-01'))
})

test('full provider=all task fails closed when any one provider is unverified', async () => {
  const out = await runFullSifter({
    'generativelanguage.googleapis.com/v1beta/models': {
      statusCode: 400, body: '{"error":"Gateway Bad Request"}'
    }
  })
  const writes = out.actions.filter(a => a.action === 'set_policy_state')
  assert.equal(writes.length, 1)
  assert.equal(writes[0].content['🛡 AI联合安全节点'], 'reject')
  assert.equal(out.responses.length, 1)
  assert.match(out.responses[0].htmlMessage, /reject/)
})
