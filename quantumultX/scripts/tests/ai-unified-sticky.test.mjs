// macOS shared-AI sticky safety: mock QX runtime with no real network/keys.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const full = readFileSync(new URL('../ai-node-sifter.js', import.meta.url), 'utf8')
const geminiInvalidKey = JSON.stringify({
  error: { code: 400, status: 'INVALID_ARGUMENT',
    details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
      reason: 'API_KEY_INVALID', domain: 'googleapis.com',
      metadata: { service: 'generativelanguage.googleapis.com' } }] }
})
const valid = {
  'chatgpt.com/cdn-cgi/trace': { statusCode: 200, body: 'loc=US\n' },
  'claude.ai/cdn-cgi/trace': { statusCode: 200, body: 'loc=US\n' },
  'ipapi.co/json/': { statusCode: 200, body: '{"country_code":"US"}' },
  'chatgpt.com/': { statusCode: 200, body: '<html><title>ChatGPT</title></html>' },
  'claude.ai/': { statusCode: 200, body: '<html><title>Claude</title></html>' },
  'gemini.google.com/app': { statusCode: 200, body: '<html><title>Gemini</title></html>' },
  'api.openai.com/v1/models': { statusCode: 401,
    body: '{"error":{"code":"invalid_api_key","message":"Bad key"}}' },
  'api.anthropic.com/v1/models': { statusCode: 401,
    body: '{"type":"error","error":{"type":"authentication_error","message":"Bad key"}}' },
  'generativelanguage.googleapis.com/v1beta/models': { statusCode: 400, body: geminiInvalidKey }
}

async function runSticky({
  responses = {}, selected = 'US-01', candidates = ['US-01'],
  remembered = null, network = false
} = {}) {
  const calls = [], results = [], notifications = [], prefs = new Map()
  const events = []
  if (remembered) prefs.set('qxrule.ai-node-sifter.all.last-good',
    JSON.stringify({ node: remembered, region: 'US', verifiedAt: Date.now() }))
  let current = selected
  const ctx = {
    $environment: { sourcePath: 'https://example.test/ai-node-sifter.js#provider=all&mode=sticky' +
      (network ? '&trigger=network&delay=1' : ''), executeType: network ? '0' : '1' },
    $prefs: {
      valueForKey: key => prefs.get(key) || '',
      setValueForKey: (value, key) => { prefs.set(key, value); return true }
    },
    $task: {
      fetch(request) {
        calls.push(request)
        const key = Object.keys(valid).find(x =>
          new URL(request.url).href.startsWith('https://' + x))
        assert.ok(key, request.url)
        return Promise.resolve(responses[key] ?? valid[key])
      }
    },
    $configuration: {
      async sendMessage(message) {
        events.push(message)
        if (message.action === 'get_customized_policy') return {
          ret: { '🛡 AI联合安全节点': { candidates: ['reject', ...candidates] } }
        }
        if (message.action === 'get_policy_state') return {
          ret: { '🛡 AI联合安全节点': [current] }
        }
        if (message.action === 'set_policy_state') {
          current = message.content['🛡 AI联合安全节点']
          return { ret: {} }
        }
        if (message.action === 'url_latency_benchmark') return {
          ret: Object.fromEntries(candidates.map(x => [x, [true, 36]]))
        }
        throw new Error('unknown QX message ' + message.action)
      }
    },
    $notify: (...values) => notifications.push(values),
    $done: x => results.push(x),
    setTimeout: (fn, ms) => ms === 1000 ? setTimeout(fn, 0) : setTimeout(fn, ms),
    clearTimeout
  }
  await runInNewContext(full, ctx, { timeout: 2500 })
  return { current, events, calls, results, notifications, prefs }
}

test('sticky joint verification holds a previously validated current node on transient 429', async () => {
  const r = await runSticky({ responses: {
    'generativelanguage.googleapis.com/v1beta/models': {
      statusCode: 429, body: '{"error":"too many requests"}'
    } } })
  assert.equal(r.current, 'US-01')
  assert.equal(r.events.filter(e => e.action === 'set_policy_state').length, 0)
  assert.equal(r.results.length, 1)
  assert.ok(r.calls.every(x => x.opts?.policy === 'US-01'))
})

test('sticky joint validation does NOT retain a confirmed unsupported exit if no fallback passes', async () => {
  const r = await runSticky({ responses: {
    'claude.ai/': { statusCode: 451, body: '<html><title>Region unsupported</title></html>' }
  } })
  assert.equal(r.current, 'reject', 'known region block must never retain current AI node')
  assert.deepEqual(r.events.filter(x => x.action === 'set_policy_state')
    .map(x => x.content['🛡 AI联合安全节点']), ['reject'])
})

test('sticky restore from reject requires a freshly verified joint node', async () => {
  const r = await runSticky({ selected: 'reject', remembered: 'US-01' })
  assert.equal(r.current, 'US-01')
  assert.equal(r.events.filter(x => x.action === 'set_policy_state').length, 1)
  assert.match(JSON.stringify(r.prefs.get('qxrule.ai-node-sifter.all.last-good')),
    /US-01/)
})

test('sticky restore does not resurrect remembered exit on inconclusive AI response', async () => {
  const r = await runSticky({ selected: 'reject', remembered: 'US-01', responses: {
    'api.openai.com/v1/models': { statusCode: 401, body: '<html>Gateway Unauthorized</html>' }
  } })
  assert.equal(r.current, 'reject')
  assert.equal(r.events.filter(x => x.action === 'set_policy_state').length, 0)
})

test('on network event, the shared AI task rechecks after a delay and stays quiet if healthy', async () => {
  const r = await runSticky({ network: true, selected: 'US-01' })
  assert.equal(r.current, 'US-01')
  assert.equal(r.results.length, 1)
  assert.equal(r.notifications.length, 0)
  assert.ok(r.prefs.has('qxrule.ai-node-sifter.all.network-event'))
  assert.ok(r.calls.length >= 9)
})
