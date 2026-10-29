// Offline Claude node-sifter cases; never contact Anthropic or use real keys.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const full = readFileSync(new URL('../ai-node-sifter.js', import.meta.url), 'utf8')
const entryPoint = '\n;(async () => {'
assert.equal(full.split(entryPoint).length, 2, 'test pure helpers without invoking policy mutation')
const definitions = full.split(entryPoint)[0]

async function probe(api, web = { statusCode: 200, body: '<html>Claude</html>' }) {
  const requests = []
  const context = {
    $task: {
      fetch(req) {
        requests.push(req)
        return Promise.resolve(req.url.includes('api.anthropic.com') ? api : web)
      }
    },
    setTimeout, clearTimeout
  }
  runInNewContext(definitions, context, { timeout: 1500 })
  const result = await context.testClaude('TEST-CLAUDE-NODE', 'US')
  assert.ok(requests.every(req => req.opts && req.opts.policy === 'TEST-CLAUDE-NODE'))
  return { result, requests }
}

test('read-only Claude API GET returns PASS only for structured authentication rejection', async () => {
  const { result, requests } = await probe({
    statusCode: 401,
    body: '{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}'
  })
  assert.equal(result.status, 'pass')
  assert.match(result.reason, /reachability only/)
  assert.equal(requests.length, 2)
  const api = requests.find(req => req.url.includes('api.anthropic.com'))
  assert.equal(api.url, 'https://api.anthropic.com/v1/models')
  assert.equal(api.method, 'GET')
  assert.equal(api.body, undefined, 'probe must not send a Messages request')
  assert.equal(api.headers['x-api-key'], 'invalid-key-for-reachability-test')
})

test('structured 400 invalid_request_error may prove reachability but not account entitlement', async () => {
  const { result } = await probe({
    statusCode: 400,
    body: '{"type":"error","error":{"type":"invalid_request_error","message":"Bad input"}}'
  })
  assert.equal(result.status, 'pass')
})

test('generic 400/401/200 must not automatically select a node', async () => {
  for (const statusCode of [400, 401, 200]) {
    const { result } = await probe({ statusCode, body: '<html>Proxy Error</html>' })
    assert.equal(result.status, 'uncertain', String(statusCode))
  }
})

test('429 and 529 are UNCERTAIN, not PASS', async () => {
  for (const statusCode of [429, 529]) {
    const { result } = await probe({ statusCode, body: '{}' })
    assert.equal(result.status, 'uncertain', String(statusCode))
    assert.match(result.reason, /rate limited|overloaded/)
  }
})

test('explicit geo block is FAIL regardless of generic error status', async () => {
  for (const statusCode of [400, 401, 403, 451]) {
    const { result } = await probe({
      statusCode,
      body: statusCode === 451 ? '' : '{"error":{"message":"User location is not supported"}}'
    })
    assert.equal(result.status, 'fail', String(statusCode))
  }
})

test('Cloudflare challenge is UNCERTAIN and does not make an API request', async () => {
  const { result, requests } = await probe(
    { statusCode: 401, body: '{"type":"authentication_error"}' },
    { statusCode: 403, headers: { 'cf-mitigated': 'challenge' }, body: 'Checking your browser' }
  )
  assert.equal(result.status, 'uncertain')
  assert.equal(requests.length, 1)
})

test('Claude HTML static strings do not masquerade as a region or bot challenge', async () => {
  const { result } = await probe(
    { statusCode: 401, body: '{"type":"error","error":{"type":"authentication_error"}}' },
    { statusCode: 200, body: '<html><script>const text="not available in your country"; const hint="cf-chl-";</script></html>' }
  )
  assert.equal(result.status, 'pass')
})

test('explicit unsupported-region page title is still a FAIL', async () => {
  const { result } = await probe(
    { statusCode: 401, body: '{"type":"authentication_error"}' },
    { statusCode: 200, body: '<html><title>Country not supported</title></html>' }
  )
  assert.equal(result.status, 'fail')
})
test('gateway JSON without full Anthropic envelope stays UNCERTAIN', async () => {
  for (const statusCode of [400, 401]) {
    for (const body of [
      '{"type":"authentication_error"}',
      '{"error":{"type":"authentication_error"}}',
      '{"type":"proxy_error","error":{"type":"authentication_error"}}',
      '{"type":"error","error":"authentication_error"}',
      '{"type":"invalid_request_error"}'
    ]) {
      const { result } = await probe({ statusCode, body })
      assert.equal(result.status, 'uncertain', statusCode + ': ' + body)
    }
  }
})
