// node --test quantumultX/scripts/tests/streaming-ui-check.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const source = readFileSync(new URL('../streaming-ui-check.js', import.meta.url), 'utf8')

async function probe(overrides = {}) {
  let report
  const defaults = {
    'api.anthropic.com': { statusCode: 401, body: '{"type":"authentication_error"}' },
    'api.openai.com': { statusCode: 401, body: '{"error":{"code":"invalid_api_key"}}' },
    'generativelanguage.googleapis.com': { statusCode: 400, body: '{"error":{"status":"INVALID_ARGUMENT","message":"API_KEY_INVALID"}}' },
    'www.netflix.com': { statusCode: 404, body: '' },
    'www.youtube.com': { statusCode: 200, body: '<html><title>Premium</title></html>' },
    'disney.api.edge.bamgrid.com': { statusCode: 500, body: '{}' },
    'www.google.com': { statusCode: 302, headers: { location: 'https://www.google.com.hk/' }, body: '' },
    'ipapi.co': { statusCode: 200, body: '{"country_code":"US"}' }
  }
  const responses = { ...defaults, ...overrides }
  const context = {
    $environment: { params: 'TEST-POLICY' },
    $task: { fetch: async ({ url }) => {
      const host = new URL(url).hostname
      return responses[host] || { statusCode: 200, headers: {}, body: 'loc=US' }
    } },
    $configuration: { sendMessage: async () => ({ ret: { 'TEST-POLICY': ['TEST-POLICY'] } }) },
    $done: value => { report = value },
    console: { log() {} },
    setTimeout, clearTimeout, URL
  }
  runInNewContext(source, context, { timeout: 2000 })
  for (let i = 0; i < 50 && !report; i++) await new Promise(resolve => setTimeout(resolve, 10))
  assert.ok(report, 'script must always call $done')
  return report.htmlMessage
}

test('Gemini FAILED_PRECONDITION at HTTP 400 is region blocked', async () => {
  const out = await probe({
    'generativelanguage.googleapis.com': { statusCode: 400, body: '{"error":{"status":"FAILED_PRECONDITION","message":"User location is not supported for the API use."}}' }
  })
  assert.match(out, /Gemini API: <\\/b>地区受限/)
})

test('invalid API keys are reachable, not verified as usable', async () => {
  const out = await probe()
  assert.match(out, /OpenAI API: <\\/b>接口可达/)
  assert.match(out, /Claude API: <\\/b>接口可达/)
  assert.match(out, /Gemini API: <\\/b>接口可达/)
})

test('HTTP 200 landing pages do not prove full unlock', async () => {
  const out = await probe({ 'www.netflix.com': { statusCode: 200, body: '<html></html>' } })
  assert.match(out, /Netflix: <\\/b>样本页可达/)
  assert.match(out, /YouTube Premium: <\\/b>页面可达/)
  assert.match(out, /ChatGPT: <\\/b>网页可达/)
})

test('Hong Kong Google redirect is not mainland evidence', async () => {
  const out = await probe()
  assert.doesNotMatch(out, /Google 送中: <\\/b>是 \\(大陆重定向\\)/)
})

test('Disney API 500 is not a region block', async () => {
  const out = await probe()
  assert.match(out, /Disneyᐩ: <\\/b>接口异常 \\(500\\)/)
})
