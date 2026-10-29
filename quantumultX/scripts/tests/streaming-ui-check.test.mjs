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
    'www.disneyplus.com': { statusCode: 200, body: '<html><title>Disney+</title></html>' },
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
  assert.ok(out.includes('Gemini API: </b>地区受限'))
})

test('invalid API keys are reachable, not verified as usable', async () => {
  const out = await probe()
  assert.ok(out.includes('OpenAI API: </b>接口可达'))
  assert.ok(out.includes('Claude API: </b>接口可达'))
  assert.ok(out.includes('Gemini API: </b>接口可达'))
})

test('HTTP 200 landing pages do not prove full unlock', async () => {
  const out = await probe({ 'www.netflix.com': { statusCode: 200, body: '<html></html>' } })
  assert.ok(out.includes('Netflix: </b>样本页可达'))
  assert.ok(out.includes('YouTube Premium: </b>页面可达'))
  assert.ok(out.includes('ChatGPT: </b>网页可达'))
})

test('Hong Kong Google redirect is not mainland evidence', async () => {
  const out = await probe()
  assert.ok(!out.includes('Google 送中: </b>是 (大陆重定向)'))
})

test('Disney homepage 500 is not a region block', async () => {
  const out = await probe({ 'www.disneyplus.com': { statusCode: 500, body: '' } })
  assert.ok(out.includes('Disneyᐩ: </b>网页异常 (500)'))
})

test('YouTube HTTP 451 reports a legal or regional block', async () => {
  const out = await probe({
    'www.youtube.com': { statusCode: 451, body: '' }
  })
  assert.ok(out.includes('YouTube Premium: </b>地区/法律限制 (451)'))
})

test('Google language preference is not mainland proof', async () => {
  const out = await probe({
    'www.google.com': { statusCode: 302, headers: { location: 'https://www.google.com/?hl=zh-cn' }, body: '' }
  })
  assert.ok(out.includes('Google 送中: </b>无法判定 (语言参数并非地区证据)'))
})


// Runtime failure fixtures: unlike the successful HTTP mocks above, these
// simulate real QX tasks that remain pending, reject or throw synchronously.
async function probeRuntime(options = {}) {
  const reports = []
  const requests = []
  const policy = options.policy === undefined ? 'TEST-POLICY' : options.policy
  const environment = policy === null ? {} : { params: policy }
  const responseOf = options.responseOf || (() => ({ statusCode: 200, headers: {}, body: 'loc=US' }))
  const timerScale = options.timerScale || (ms => ms)
  const context = {
    $environment: environment,
    $task: {
      fetch(req) {
        requests.push(req)
        const response = responseOf(req)  // may synchronously throw
        return response && typeof response.then === 'function'
          ? response
          : Promise.resolve(response)
      }
    },
    $configuration: options.configuration === undefined
      ? { sendMessage: async () => ({ ret: { 'TEST-POLICY': ['TEST-POLICY'] } }) }
      : options.configuration,
    $done: value => reports.push(value),
    console: { log() {} },
    setTimeout: (fn, ms) => setTimeout(fn, timerScale(ms)),
    clearTimeout,
    URL
  }
  runInNewContext(source, context, { timeout: 2000 })
  for (let i = 0; i < 120 && reports.length === 0; i++) {
    await new Promise(resolve => setTimeout(resolve, 5))
  }
  assert.equal(reports.length, 1, 'QX must receive one completed UI response')
  return { reports, requests }
}

test('a completely stalled node still returns a partial report by deadline', async () => {
  const { reports, requests } = await probeRuntime({
    responseOf: () => new Promise(() => {}),
    configuration: { sendMessage: () => new Promise(() => {}) },
    timerScale: ms => ms === 8500 ? 25 : 90
  })
  const report = reports[0]
  assert.match(report.title, /部分结果/)
  assert.ok(report.htmlMessage.includes('OpenAI API: </b>未完成（总时限）'))
  assert.ok(report.htmlMessage.includes('Netflix: </b>未完成（总时限）'))
  assert.ok(!report.htmlMessage.includes('完整支持'))
  assert.ok(requests.length >= 10)
  await new Promise(resolve => setTimeout(resolve, 115))
  assert.equal(reports.length, 1, '$done must not run twice on late request timeout')
})

test('partial success is retained when other services are stalled', async () => {
  const { reports } = await probeRuntime({
    responseOf: req => req.url.includes('api.openai.com')
      ? { statusCode: 401, body: '{"error":{"code":"invalid_api_key"}}' }
      : new Promise(() => {}),
    configuration: { sendMessage: () => new Promise(() => {}) },
    timerScale: ms => ms === 8500 ? 25 : 85
  })
  const output = reports[0].htmlMessage
  assert.ok(output.includes('OpenAI API: </b>接口可达 (未认证)'))
  assert.ok(output.includes('YouTube Premium: </b>未完成（总时限）'))
})

test('policy-state API hang cannot prevent complete service report', async () => {
  const { reports } = await probeRuntime({
    configuration: { sendMessage: () => new Promise(() => {}) },
    timerScale: ms => ms === 750 ? 20 : ms === 8500 ? 120 : 90
  })
  const report = reports[0]
  assert.ok(!report.title.includes('部分结果'))
  assert.ok(report.htmlMessage.includes('Claude API: </b>异常 (200)'))
  assert.ok(report.htmlMessage.includes('节点</b> ➟ TEST-POLICY'))
})

test('undefined policy parameters fall back to default routing without throwing', async () => {
  const { reports, requests } = await probeRuntime({
    policy: null,
    configuration: undefined
  })
  assert.ok(reports[0].htmlMessage.includes('当前分流（未指定策略）'))
  assert.ok(requests.length >= 10)
  for (const req of requests) {
    assert.ok(!Object.hasOwn(req.opts || {}, 'policy'), 'must not send undefined policy')
    assert.ok(!Object.hasOwn(req, 'timeout'), 'script timeout is not a documented QX fetch parameter')
  }
})

test('synchronous $task.fetch failures show service error without blank UI', async () => {
  const { reports } = await probeRuntime({
    responseOf: req => {
      if (req.url.includes('api.anthropic.com')) throw new Error('invalid proxy policy')
      return { statusCode: 200, headers: {}, body: 'loc=US' }
    }
  })
  assert.ok(reports[0].htmlMessage.includes('Claude API: </b>网络错误'))
  assert.ok(reports[0].htmlMessage.includes('OpenAI API: </b>异常 (200)'))
})

test('a late HTTP response cannot cause a second $done after watchdog', async () => {
  const { reports } = await probeRuntime({
    responseOf: req => req.url.includes('www.netflix.com')
      ? new Promise(resolve => setTimeout(() => resolve({ statusCode: 200, body: '' }), 55))
      : new Promise(() => {}),
    timerScale: ms => ms === 8500 ? 25 : 100,
    configuration: { sendMessage: () => new Promise(() => {}) }
  })
  assert.ok(reports[0].htmlMessage.includes('Netflix: </b>未完成（总时限）'))
  await new Promise(resolve => setTimeout(resolve, 110))
  assert.equal(reports.length, 1)
})


test('Disney homepage success and redirects never claim playback eligibility', async () => {
  const ordinary = await probe()
  assert.ok(ordinary.includes('Disneyᐩ: </b>网页可达 (播放未验证)'))
  const redirected = await probe({
    'www.disneyplus.com': {
      statusCode: 302, headers: { location: 'https://www.disneyplus.com/login' }, body: ''
    }
  })
  assert.ok(redirected.includes('Disneyᐩ: </b>网页重定向 (播放未验证)'))
})

test('Disney 403 without explicit region evidence stays indeterminate', async () => {
  const unknown = await probe({
    'www.disneyplus.com': { statusCode: 403, body: 'Access Denied' }
  })
  assert.ok(unknown.includes('访问受限 (403，原因未明)'))
  const blocked = await probe({
    'www.disneyplus.com': {
      statusCode: 403,
      body: '{"error":{"status":"FAILED_PRECONDITION","message":"User location is not supported"}}'
    }
  })
  assert.ok(blocked.includes('Disneyᐩ: </b>地区/访问限制 (403)'))
})

test('Google HTTP 200 is not proof of a non-mainland route', async () => {
  const out = await probe({
    'www.google.com': { statusCode: 200, body: '<html lang="en"></html>' }
  })
  assert.ok(out.includes('Google 送中: </b>未观察到大陆跳转 (非确定证明)'))
})

test('shared region fallback makes only one IP API request for two failed traces', async () => {
  const { reports, requests } = await probeRuntime({
    responseOf: req => {
      if (req.url.includes('/cdn-cgi/trace')) return { statusCode: 403, body: '' }
      if (req.url.includes('ipapi.co/json')) {
        return { statusCode: 200, body: '{"country_code":"JP"}' }
      }
      return { statusCode: 200, headers: {}, body: '' }
    }
  })
  assert.equal(requests.filter(req => req.url.includes('ipapi.co/json')).length, 1)
  assert.ok(reports[0].htmlMessage.includes('⟦🇯🇵⟧'))
})

test('malformed HTTP response does not strand API probe or the report', async () => {
  const { reports } = await probeRuntime({
    responseOf: req => req.url.includes('api.openai.com')
      ? null
      : { statusCode: 200, body: 'loc=US', headers: {} }
  })
  assert.ok(reports[0].htmlMessage.includes('OpenAI API: </b>响应格式异常'))
  assert.ok(!reports[0].title.includes('部分结果'))
})

test('QX selftest via variables runs without network or policy APIs', async () => {
  const reports = []
  let calls = 0
  runInNewContext(source, {
    $environment: { params: '<EXAMPLE & NODE>', variables: { mode: 'selftest' } },
    $task: { fetch: () => { calls++; throw new Error('network must not be used') } },
    $configuration: { sendMessage: () => { calls++; throw new Error('policy API must not be used') } },
    $done: value => reports.push(value),
    console: { log() {} }, setTimeout, clearTimeout
  })
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(reports.length, 1)
  assert.equal(calls, 0)
  assert.ok(reports[0].title.includes('引擎自检'))
  assert.ok(reports[0].htmlMessage.includes('未发起网络请求'))
  assert.ok(reports[0].htmlMessage.includes('&lt;EXAMPLE &amp; NODE&gt;'))
})

test('QX selftest works with legacy sourcePath #mode=selftest', async () => {
  const reports = []
  let calls = 0
  runInNewContext(source, {
    $environment: { params: 'NODE', sourcePath: 'https://example.test/script.js#mode=selftest' },
    $task: { fetch: () => { calls++; throw new Error('network must not be used') } },
    $done: value => reports.push(value),
    console: { log() {} }, setTimeout, clearTimeout
  })
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(reports.length, 1)
  assert.equal(calls, 0)
  assert.ok(reports[0].htmlMessage.includes('脚本引擎执行成功'))
})

test('challenge strings on HTTP 200 pages are not proof of bot mitigation', async () => {
  const out = await probe({
    'www.disneyplus.com': {
      statusCode: 200,
      body: '<html><script>window.cf_chl = "cf-chl-";</script></html>'
    },
    'claude.ai': {
      statusCode: 200,
      body: '<html><script>const word = "challenge-platform"</script></html>'
    },
    'chatgpt.com': {
      statusCode: 200,
      body: '<html><script>const word = "checking your browser"</script></html>'
    }
  })
  assert.ok(out.includes('Disneyᐩ: </b>网页可达 (播放未验证)'))
  assert.ok(out.includes('Claude: </b>网页可达 (解锁未证实)'))
  assert.ok(out.includes('ChatGPT: </b>网页可达 (解锁未证实)'))
  const blocked = await probe({
    'www.disneyplus.com': {
      statusCode: 403,
      headers: { 'cf-mitigated': 'challenge' },
      body: '<html>Checking your browser</html>'
    }
  })
  assert.ok(blocked.includes('Disneyᐩ: </b>验证拦截'))
})

test('Claude API generic 400/401 are unknown, not reachable', async () => {
  for (const status of [400, 401]) {
    const out = await probe({
      'api.anthropic.com': { statusCode: status, body: '<html>Proxy Error</html>' }
    })
    assert.ok(out.includes('Claude API: </b>状态不明 (' + status), 'HTTP ' + status)
    assert.ok(!out.includes('Claude API: </b>接口可达'), 'false positive: ' + status)
  }
})

test('Claude API structured validation or authentication errors mean reachability only', async () => {
  const invalidRequest = await probe({
    'api.anthropic.com': {
      statusCode: 400,
      body: '{"type":"error","error":{"type":"invalid_request_error","message":"invalid request"}}'
    }
  })
  assert.ok(invalidRequest.includes('Claude API: </b>接口可达 (未认证)'))
  const auth = await probe({
    'api.anthropic.com': {
      statusCode: 401,
      body: '{"type":"error","error":{"type":"authentication_error","message":"invalid x-api-key"}}'
    }
  })
  assert.ok(auth.includes('Claude API: </b>接口可达 (未认证)'))
})

test('Claude API region restriction overrides 400/401; 451 needs no body', async () => {
  for (const status of [400, 401, 451]) {
    const out = await probe({
      'api.anthropic.com': {
        statusCode: status,
        body: status === 451 ? '' : '{"error":{"message":"User location is not supported"}}'
      }
    })
    assert.ok(out.includes('Claude API: </b>地区受限'), 'HTTP ' + status)
  }
})

test('Claude API 429/529 remain inconclusive', async () => {
  for (const status of [429, 529]) {
    const out = await probe({ 'api.anthropic.com': { statusCode: status, body: '{}' } })
    assert.ok(out.includes('Claude API: </b>限流/繁忙 (未验证)'), String(status))
    assert.ok(!out.includes('Claude API: </b>接口可达'), String(status))
  }
})
