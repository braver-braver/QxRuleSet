/***
 * 服务解锁检测 v3.4.1 (AI + 流媒体 + Google 送中检测)
 *
 * 基于 KOP-XIAO/QuantumultX streaming-ui-check.js 重构维护
 * Thanks to: Hyseen, AtlantisGawrGura, CoiaPrant, Netflixxp
 *
 * 更新: 2026-10-29
 *
 * ★ 重点检测: Claude (Web + API) / ChatGPT (Web + API) / Gemini (Web + API)
 * ★ Google 送中检测: 观察大陆站重定向线索，避免把页面语言误判为出口位置
 * ○ 流媒体:   Netflix / YouTube Premium / Disney+
 *
 * For Quantumult-X 598+ ONLY!!
 *
 * [task_local]
 * event-interaction https://raw.githubusercontent.com/braver-braver/QxRuleSet/refs/heads/main/quantumultX/scripts/streaming-ui-check.js, tag=服务解锁查询, img-url=checkmark.seal.system, enabled=true
 *
 * @KOP-XIAO (original) | Refactored 2026-07
 ***/

// ===================== 常量配置 =====================

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const arrow = " ➟ "
// 整个 event-interaction 必须在有限时间内交还 UI。
// 不依赖 QX 默认 HTTP 超时：单项请求在脚本内单独限时，超时不重试。
// 部分节点可能慢/拒绝连接，返回部分结果优于没有任何界面响应。
const SCRIPT_DEADLINE_MS = 8500
const POLICY_LOOKUP_TIMEOUT_MS = 750
const TIMEOUTS = {
  trace: 2000,
  api: 4500,
  web: 5200,
  streaming: 6200
}

// --- Claude ---
const CLAUDE_WEB_URL     = 'https://claude.ai'
const CLAUDE_TRACE_URL   = 'https://claude.ai/cdn-cgi/trace'
const CLAUDE_API_URL     = 'https://api.anthropic.com/v1/models'

// --- ChatGPT / OpenAI ---
const CHATGPT_WEB_URL    = 'https://chatgpt.com'
const CHATGPT_TRACE_URL  = 'https://chatgpt.com/cdn-cgi/trace'
const OPENAI_API_URL     = 'https://api.openai.com/v1/models'

// --- Gemini / Google AI ---
const GEMINI_WEB_URL     = 'https://gemini.google.com/app'
const GEMINI_API_URL     = 'https://generativelanguage.googleapis.com/v1beta/models?key=invalid-key-for-reachability-test'

// --- Google 送中检测 ---
// 命中大陆网络时，Google 会返回 zh-CN 简体页面 / 302 到 google.cn / 触发 sorry 人机验证
const GOOGLE_URL          = 'https://www.google.com/'
const GOOGLE_NOSSL_URL    = 'http://www.google.com/generate_204'
const REGION_FALLBACK_URL  = 'https://ipapi.co/json/'

// --- 流媒体 ---
const NETFLIX_URL        = 'https://www.netflix.com/title/81280792'
const YOUTUBE_URL        = 'https://www.youtube.com/premium'
// Anonymous homepage probe only; no embedded token or playback claims.
const DISNEY_WEB_URL     = 'https://www.disneyplus.com/'

// ===================== QuantumultX 选项 =====================

// 从策略/节点交互菜单调用时 params 为目标策略。
// 若从其他任务入口运行且没有 params，应回退到当前路由，不能传 policy: undefined。
const SELECTED_POLICY = String(
  (typeof $environment !== 'undefined' && $environment && $environment.params) || ''
).trim()
var opts           = SELECTED_POLICY ? { policy: SELECTED_POLICY } : {}
var opts_noRedirect = Object.assign({}, opts, { redirection: false })

// #mode=selftest on the QX task URL verifies that the script can execute
// without depending on proxies, DNS, HTTP endpoints or policy-state APIs.
function scriptMode() {
  try {
    if (typeof $environment === 'undefined' || !$environment) return 'full'
    const variables = $environment.variables
    if (variables && typeof variables.mode === 'string') {
      return variables.mode.toLowerCase() === 'selftest' ? 'selftest' : 'full'
    }
    const source = String($environment.sourcePath || '')
    return /[#&]mode=selftest(?:&|$)/i.test(source) ? 'selftest' : 'full'
  } catch (_) {
    return 'full'
  }
}
const SCRIPT_MODE = scriptMode()

// ===================== 国旗映射表 =====================

var flags = new Map([
  ["AC","🇦🇨"],["AE","🇦🇪"],["AF","🇦🇫"],["AI","🇦🇮"],["AL","🇦🇱"],["AM","🇦🇲"],
  ["AQ","🇦🇶"],["AR","🇦🇷"],["AS","🇦🇸"],["AT","🇦🇹"],["AU","🇦🇺"],["AW","🇦🇼"],
  ["AX","🇦🇽"],["AZ","🇦🇿"],["BA","🇧🇦"],["BB","🇧🇧"],["BD","🇧🇩"],["BE","🇧🇪"],
  ["BF","🇧🇫"],["BG","🇧🇬"],["BH","🇧🇭"],["BI","🇧🇮"],["BJ","🇧🇯"],["BM","🇧🇲"],
  ["BN","🇧🇳"],["BO","🇧🇴"],["BR","🇧🇷"],["BS","🇧🇸"],["BT","🇧🇹"],["BW","🇧🇼"],
  ["BY","🇧🇾"],["BZ","🇧🇿"],["CA","🇨🇦"],["CF","🇨🇫"],["CH","🇨🇭"],["CK","🇨🇰"],
  ["CL","🇨🇱"],["CM","🇨🇲"],["CN","🇨🇳"],["CO","🇨🇴"],["CR","🇨🇷"],["CU","🇨🇺"],
  ["CV","🇨🇻"],["CW","🇨🇼"],["CX","🇨🇽"],["CY","🇨🇾"],["CZ","🇨🇿"],["DE","🇩🇪"],
  ["DJ","🇩🇯"],["DK","🇩🇰"],["DM","🇩🇲"],["DO","🇩🇴"],["DZ","🇩🇿"],["EC","🇪🇨"],
  ["EE","🇪🇪"],["EG","🇪🇬"],["ER","🇪🇷"],["ES","🇪🇸"],["ET","🇪🇹"],["EU","🇪🇺"],
  ["FI","🇫🇮"],["FJ","🇫🇯"],["FK","🇫🇰"],["FM","🇫🇲"],["FO","🇫🇴"],["FR","🇫🇷"],
  ["GA","🇬🇦"],["GB","🇬🇧"],["GD","🇬🇩"],["GE","🇬🇪"],["GH","🇬🇭"],["GR","🇬🇷"],
  ["GT","🇬🇹"],["GY","🇬🇾"],["HK","🇭🇰"],["HN","🇭🇳"],["HR","🇭🇷"],["HT","🇭🇹"],
  ["HU","🇭🇺"],["ID","🇮🇩"],["IE","🇮🇪"],["IL","🇮🇱"],["IM","🇮🇲"],["IN","🇮🇳"],
  ["IQ","🇮🇶"],["IR","🇮🇷"],["IS","🇮🇸"],["IT","🇮🇹"],["JM","🇯🇲"],["JO","🇯🇴"],
  ["JP","🇯🇵"],["KE","🇰🇪"],["KG","🇰🇬"],["KH","🇰🇭"],["KR","🇰🇷"],["KW","🇰🇼"],
  ["KZ","🇰🇿"],["LA","🇱🇦"],["LB","🇱🇧"],["LI","🇱🇮"],["LK","🇱🇰"],["LT","🇱🇹"],
  ["LU","🇱🇺"],["LV","🇱🇻"],["MA","🇲🇦"],["MC","🇲🇨"],["MD","🇲🇩"],["ME","🇲🇪"],
  ["MG","🇲🇬"],["MK","🇲🇰"],["ML","🇲🇱"],["MM","🇲🇲"],["MN","🇲🇳"],["MO","🇲🇴"],
  ["MT","🇲🇹"],["MU","🇲🇺"],["MV","🇲🇻"],["MW","🇲🇼"],["MX","🇲🇽"],["MY","🇲🇾"],
  ["MZ","🇲🇿"],["NA","🇳🇦"],["NE","🇳🇪"],["NG","🇳🇬"],["NI","🇳🇮"],["NL","🇳🇱"],
  ["NO","🇳🇴"],["NP","🇳🇵"],["NR","🇳🇷"],["NZ","🇳🇿"],["OM","🇴🇲"],["PA","🇵🇦"],
  ["PE","🇵🇪"],["PG","🇵🇬"],["PH","🇵🇭"],["PK","🇵🇰"],["PL","🇵🇱"],["PT","🇵🇹"],
  ["PW","🇵🇼"],["PY","🇵🇾"],["QA","🇶🇦"],["RO","🇷🇴"],["RS","🇷🇸"],["RU","🇷🇺"],
  ["RW","🇷🇼"],["SA","🇸🇦"],["SB","🇸🇧"],["SC","🇸🇨"],["SD","🇸🇩"],["SE","🇸🇪"],
  ["SG","🇸🇬"],["SI","🇸🇮"],["SK","🇸🇰"],["SL","🇸🇱"],["SM","🇸🇲"],["SN","🇸🇳"],
  ["SR","🇸🇷"],["ST","🇸🇹"],["SV","🇸🇻"],["SY","🇸🇾"],["TH","🇹🇭"],["TJ","🇹🇯"],
  ["TL","🇹🇱"],["TN","🇹🇳"],["TO","🇹🇴"],["TR","🇹🇷"],["TT","🇹🇹"],["TV","🇹🇻"],
  ["TW","🇹🇼"],["TZ","🇹🇿"],["UA","🇺🇦"],["UG","🇺🇬"],["UK","🇬🇧"],["UM","🇺🇲"],
  ["US","🇺🇸"],["UY","🇺🇾"],["UZ","🇺🇿"],["VA","🇻🇦"],["VE","🇻🇪"],["VG","🇻🇬"],
  ["VI","🇻🇮"],["VN","🇻🇳"],["VU","🇻🇺"],["WS","🇼🇸"],["ZA","🇿🇦"],["ZM","🇿🇲"]
])

// ===================== 结果对象 =====================

let result = {
  title:     '   🔍 服务解锁查询',
  Claude:    '<b>Claude: </b>检测失败 ❗️',
  ClaudeAPI: '<b>Claude API: </b>检测失败 ❗️',
  ChatGPT:   '<b>ChatGPT: </b>检测失败 ❗️',
  OpenAIAPI: '<b>OpenAI API: </b>检测失败 ❗️',
  Gemini:    '<b>Gemini: </b>检测失败 ❗️',
  GeminiAPI: '<b>Gemini API: </b>检测失败 ❗️',
  GoogleCN:  '<b>Google 送中: </b>检测失败 ❗️',
  Netflix:   '<b>Netflix: </b>检测失败 ❗️',
  YouTube:   '<b>YouTube Premium: </b>检测失败 ❗️',
  Disney:    '<b>Disneyᐩ: </b>检测失败 ❗️'
}

// ===================== 辅助函数 =====================

function regionFromTrace(body) {
  let m = (body || '').match(/loc=([A-Z]{2})/)
  return m ? m[1] : ''
}

function flag(region) {
  if (!region) return '❓'
  let code = String(region).toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return '❓'
  return flags.get(code) || code
}

function getHeader(headers, name) {
  let target = name.toLowerCase()
  let source = headers || {}
  let keys = Object.keys(source)
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === target) return String(source[keys[i]] || '')
  }
  return ''
}

function hasStructuredRegionBlock(body) {
  let text = (body || '').toLowerCase()
  return /"unsupported_(?:country|region)"\s*:\s*true/.test(text) ||
    /"(?:code|reason)"\s*:\s*"unsupported_(?:country|region)[^"]*"/.test(text)
}

function hasExplicitRegionMessage(body) {
  let text = (body || '').toLowerCase()
  return text.indexOf('user location is not supported') !== -1 ||
    text.indexOf('location is not supported for the api use') !== -1 ||
    text.indexOf('country not supported') !== -1 ||
    text.indexOf('not available in your country') !== -1 ||
    text.indexOf('not available in your region') !== -1 ||
    text.indexOf('service is not available in your territory') !== -1
}

function hasApiRegionBlock(body) {
  let text = (body || '').toLowerCase()
  return (/"(?:status|code)"\s*:\s*"(?:failed_precondition|unsupported_country)"/.test(text) && /location|region|country/.test(text)) ||
    hasStructuredRegionBlock(text) ||
    hasExplicitRegionMessage(text) ||
    /(?:user )?location[^.]{0,40}(?:not supported|unsupported)/.test(text)
}

function isBotChallenge(resp, body) {
  // A regular HTML bundle can contain Cloudflare challenge strings even on
  // HTTP 200. Prefer the explicit mitigation header; otherwise only inspect
  // challenge wording on denial/unavailable responses.
  if (getHeader(resp && resp.headers, 'cf-mitigated').toLowerCase() === 'challenge') {
    return true
  }
  const status = Number(resp && resp.statusCode)
  if (status !== 403 && status !== 503) return false
  const text = (body || '').toLowerCase()
  return text.indexOf('challenge-platform') !== -1 ||
    text.indexOf('cf-chl-') !== -1 ||
    text.indexOf('checking your browser') !== -1 ||
    text.indexOf('verify you are human') !== -1
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// HTTP 4xx/5xx 一般以成功 Promise 返回，网络错误会 reject。
// QX 的单次 HTTP 请求默认超时约 10 秒；这里强制更短的 JS 层上限。
// request.timeout 是本脚本的内部参数，不能转发为未文档化的 QX 请求字段。
// 不对每个错误重试，以免一个慢节点把整份交互报告拖过运行期限。
function fetchWithTimeout(request) {
  return new Promise((resolve, reject) => {
    let settled = false
    const timeout = request.timeout || TIMEOUTS.web
    const fetchRequest = Object.assign({}, request)
    delete fetchRequest.timeout
    const timer = setTimeout(() => settle(new Error('timeout')), timeout)

    function settle(error, response) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (!error) {
        // A missing response must reject rather than throw inside a probe's
        // .then callback and leave the surrounding Promise unresolved.
        const status = response && Number(response.statusCode)
        if (!Number.isInteger(status) || status < 100 || status > 599) {
          error = new Error('invalid HTTP response')
        } else {
          response = Object.assign({}, response, {
            statusCode: status,
            body: typeof response.body === 'string' ? response.body : ''
          })
        }
      }
      if (error) reject(error)
      else resolve(response)
    }

    try {
      let pending = $task.fetch(fetchRequest)
      if (!pending || typeof pending.then !== 'function') {
        settle(new Error('$task.fetch did not return a promise'))
      } else {
        pending.then(
          resp => settle(null, resp),
          err => settle(err || new Error('network error'))
        )
      }
    } catch (error) {
      // 部分版本/不合法策略会同步抛错，而非返回 rejected Promise。
      settle(error)
    }
  })
}

function networkErrorLabel(err) {
  let message = String((err && (err.error || err.message)) || err || '').toLowerCase()
  if (message.indexOf('invalid http response') !== -1) return '响应格式异常 ⚠️'
  if (message.indexOf('timeout') !== -1 || message.indexOf('timed out') !== -1) return '检测超时 🚦'
  if (message.indexOf('dns') !== -1 || message.indexOf('getaddrinfo') !== -1 || message.indexOf('resolve') !== -1) return 'DNS 失败 🚫'
  if (message.indexOf('refused') !== -1 || message.indexOf('reset') !== -1 || message.indexOf('connect') !== -1) return '连接失败 🚫'
  return '网络错误 🚦'
}

// Two trace checks share one fallback IP API call for the selected policy.
let fallbackRegionPromise = null
function getFallbackRegion() {
  if (!fallbackRegionPromise) {
    fallbackRegionPromise = (async () => {
      try {
        const resp = await fetchWithTimeout({
          url: REGION_FALLBACK_URL, opts: opts, timeout: TIMEOUTS.trace,
          headers: { 'User-Agent': UA }
        })
        if (resp.statusCode !== 200) return ''
        const data = JSON.parse(resp.body || '{}')
        const code = String(data.country_code || '').toUpperCase()
        return /^[A-Z]{2}$/.test(code) ? code : ''
      } catch (_) {
        return ''
      }
    })()
  }
  return fallbackRegionPromise
}

async function getRegion(traceUrl) {
  try {
    const trace = await fetchWithTimeout({
      url: traceUrl, opts: opts, timeout: TIMEOUTS.trace,
      headers: { 'User-Agent': UA }
    })
    if (trace.statusCode === 200) {
      const code = regionFromTrace(trace.body)
      if (code) return code
    }
  } catch (_) {}
  return getFallbackRegion()
}

// ===================== 检测: Claude Web =====================

function testClaude() {
  return (async () => {
    // 地区探测和 Web 请求并行，避免两次串行超时阻塞整个脚本。
    let regionPromise = getRegion(CLAUDE_TRACE_URL)
    try {
      let resp = await fetchWithTimeout({
        url: CLAUDE_WEB_URL,
        opts: opts,
        timeout: TIMEOUTS.web,
        headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' }
      })
      let f = flag(await regionPromise)
      let s = resp.statusCode
      let body = (resp.body || '').toLowerCase()
      // 只有明确的结构化标志或错误页标题才代表地区阻断；普通文案中的
      // “unavailable/restricted” 可能来自打包脚本，不能单独作为判据。
      let titleMatch = body.match(/<title[^>]*>([^<]*)<\/title>/i)
      let deniedTitle = titleMatch && /country not supported|not available in your country/.test(titleMatch[1])
      let accessDeniedTitle = titleMatch && /access denied/.test(titleMatch[1])
      if (isBotChallenge(resp, body)) {
        result.Claude = "<b>Claude: </b>验证拦截" + arrow + "⟦" + f + "⟧ ⚠️"
      } else if (s === 451 || hasStructuredRegionBlock(body) || deniedTitle) {
        result.Claude = "<b>Claude: </b>未支持" + arrow + "⟦" + f + "⟧ 🚫"
      } else if (s === 403 || accessDeniedTitle) {
        result.Claude = "<b>Claude: </b>访问受限 (403) ⚠️"
      } else if (s >= 200 && s < 400) {
        result.Claude = "<b>Claude: </b>网页可达 (解锁未证实)" + arrow + "⟦" + f + "⟧ ⚠️"
      } else {
        result.Claude = "<b>Claude: </b>异常 (" + s + ") ❗️"
      }
    } catch (e) {
      result.Claude = "<b>Claude: </b>" + networkErrorLabel(e)
    }
  })()
}

function claudeApiErrorType(body) {
  try {
    const response = JSON.parse(String(body || '{}'))
    const error = response && response.error
    return String((error && error.type) || (response && response.type) || '').toLowerCase()
  } catch (_) {
    return ''
  }
}

// ===================== 检测: Claude API =====================

function testClaudeAPI() {
  return new Promise((resolve) => {
    fetchWithTimeout({
      url: CLAUDE_API_URL,
      opts: opts,
      timeout: TIMEOUTS.api,
      headers: {
        'anthropic-version': '2023-06-01',
        'x-api-key': 'invalid-key-for-reachability-test'
      }
    }).then(resp => {
      let s = resp.statusCode
      let body = (resp.body || '').toLowerCase()

      // Generic HTTP 400/401 can be emitted by a proxy or gateway.
      // Only structured Anthropic errors support a reachability claim.
      const errorType = claudeApiErrorType(body)
      if (s === 451 || hasApiRegionBlock(body)) {
        result.ClaudeAPI = "<b>Claude API: </b>地区受限 🚫"
      } else if ((s === 401 && errorType === 'authentication_error') ||
                 (s === 400 && errorType === 'invalid_request_error')) {
        result.ClaudeAPI = "<b>Claude API: </b>接口可达 (未认证) ⚠️"
      } else if (s === 400 || s === 401) {
        result.ClaudeAPI = "<b>Claude API: </b>状态不明 (" + s + "，未认证) ⚠️"
      } else if (s === 429 || s === 529) {
        result.ClaudeAPI = "<b>Claude API: </b>限流/繁忙 (未验证) ⚠️"
      } else if (s === 403) {
        result.ClaudeAPI = "<b>Claude API: </b>访问受限 (403) ⚠️"
      } else {
        result.ClaudeAPI = "<b>Claude API: </b>异常 (" + s + ") ❗️"
      }
      resolve()
    }, err => {
      result.ClaudeAPI = "<b>Claude API: </b>" + networkErrorLabel(err)
      resolve()
    })
  })
}

// ===================== 检测: ChatGPT Web =====================

function testChatGPT() {
  return (async () => {
    let regionPromise = getRegion(CHATGPT_TRACE_URL)
    try {
      let resp = await fetchWithTimeout({ url: CHATGPT_WEB_URL, opts: opts_noRedirect, timeout: TIMEOUTS.web, headers: { 'User-Agent': UA } })
      let f = flag(await regionPromise)
      let s = resp.statusCode
      let body = (resp.body || '').toLowerCase()
      let contentType = getHeader(resp.headers, 'content-type').toLowerCase()
      if (isBotChallenge(resp, body)) {
        result.ChatGPT = "<b>ChatGPT: </b>验证拦截" + arrow + "⟦" + f + "⟧ ⚠️"
      } else if (s === 451 || hasStructuredRegionBlock(body) ||
          ((s === 403 || contentType.indexOf('text/plain') !== -1) && hasExplicitRegionMessage(body))) {
        result.ChatGPT = "<b>ChatGPT: </b>未支持" + arrow + "⟦" + f + "⟧ 🚫"
      } else if (s === 403) {
        result.ChatGPT = "<b>ChatGPT: </b>访问受限 (403) ⚠️"
      } else if (s >= 200 && s < 400) {
        result.ChatGPT = "<b>ChatGPT: </b>网页可达 (解锁未证实)" + arrow + "⟦" + f + "⟧ ⚠️"
      } else {
        result.ChatGPT = "<b>ChatGPT: </b>异常 (" + s + ") ❗️"
      }
    } catch (e) {
      result.ChatGPT = "<b>ChatGPT: </b>" + networkErrorLabel(e)
    }
  })()
}

// ===================== 检测: OpenAI API =====================

function testOpenAIAPI() {
  return new Promise((resolve) => {
    fetchWithTimeout({
      url: OPENAI_API_URL,
      opts: opts,
      timeout: TIMEOUTS.api,
      headers: {
        'Authorization': 'Bearer sk-test-00000000',
        'User-Agent': UA
      }
    }).then(resp => {
      let s = resp.statusCode
      let body = (resp.body || '').toLowerCase()

      // 401 = invalid_api_key 仅代表接口可达，不能证明能调用模型
      if (hasApiRegionBlock(body) && (s === 400 || s === 403 || s === 451)) {
        result.OpenAIAPI = "<b>OpenAI API: </b>地区受限 🚫"
      } else if (s === 401) {
        result.OpenAIAPI = "<b>OpenAI API: </b>接口可达 (未认证) ⚠️"
      } else if (s === 429) {
        result.OpenAIAPI = "<b>OpenAI API: </b>限流 (未验证) ⚠️"
      } else if (s === 403) {
        result.OpenAIAPI = "<b>OpenAI API: </b>访问受限 (403) ⚠️"
      } else {
        result.OpenAIAPI = "<b>OpenAI API: </b>异常 (" + s + ") ❗️"
      }
      resolve()
    }, err => {
      result.OpenAIAPI = "<b>OpenAI API: </b>" + networkErrorLabel(err)
      resolve()
    })
  })
}

// ===================== 检测: Gemini Web =====================

function testGemini() {
  return new Promise((resolve) => {
    fetchWithTimeout({
      url: GEMINI_WEB_URL,
      opts: opts_noRedirect,
      timeout: TIMEOUTS.web,
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'en-US,en;q=0.9'
      }
    }).then(resp => {
      let s = resp.statusCode
      let body = (resp.body || '').toLowerCase()

      if (s === 302 || s === 301 || s === 307 || s === 308) {
        // 未登录状态下 Gemini 通常会重定向到 accounts.google.com，属正常
        let loc = getHeader(resp.headers, 'location').toLowerCase()
        if (loc.indexOf('accounts.google.com') !== -1 ||
            loc.indexOf('gemini.google.com') !== -1 ||
            loc.indexOf('consent.google.com') !== -1) {
          result.Gemini = "<b>Gemini: </b>登录跳转 (解锁未证实) ⚠️"
        } else {
          result.Gemini = "<b>Gemini: </b>重定向异常 ⚠️"
        }
      } else if (s === 451 || (s === 403 && (hasStructuredRegionBlock(body) || hasExplicitRegionMessage(body)))) {
        result.Gemini = "<b>Gemini: </b>未支持 🚫"
      } else if (s === 403) {
        result.Gemini = "<b>Gemini: </b>访问受限 (403) ⚠️"
      } else if (s >= 200 && s < 400) {
        result.Gemini = "<b>Gemini: </b>网页可达 (解锁未证实) ⚠️"
      } else {
        result.Gemini = "<b>Gemini: </b>异常 (" + s + ") ❗️"
      }
      resolve()
    }, err => {
      result.Gemini = "<b>Gemini: </b>" + networkErrorLabel(err)
      resolve()
    })
  })
}

// ===================== 检测: Gemini API (Google AI Studio) =====================

function testGeminiAPI() {
  return new Promise((resolve) => {
    fetchWithTimeout({
      url: GEMINI_API_URL,
      opts: opts,
      timeout: TIMEOUTS.api,
      headers: { 'User-Agent': UA }
    }).then(resp => {
      let s = resp.statusCode
      let body = (resp.body || '').toLowerCase()

      // 400 也可能是 FAILED_PRECONDITION 地区限制，必须优先检查错误正文
      if (hasApiRegionBlock(body) && (s === 400 || s === 403 || s === 451)) {
        result.GeminiAPI = "<b>Gemini API: </b>地区受限 🚫"
      } else if (s === 400 || s === 401) {
        result.GeminiAPI = "<b>Gemini API: </b>接口可达 (无效 Key) ⚠️"
      } else if (s === 403) {
        result.GeminiAPI = "<b>Gemini API: </b>访问受限 (403) ⚠️"
      } else if (s === 429) {
        result.GeminiAPI = "<b>Gemini API: </b>限流 (未验证) ⚠️"
      } else if (s === 200) {
        result.GeminiAPI = "<b>Gemini API: </b>接口响应成功 (解锁未证实) ⚠️"
      } else {
        result.GeminiAPI = "<b>Gemini API: </b>异常 (" + s + ") ❗️"
      }
      resolve()
    }, err => {
      result.GeminiAPI = "<b>Gemini API: </b>" + networkErrorLabel(err)
      resolve()
    })
  })
}

// ===================== 检测: Google 送中 =====================
// 判断节点出口 IP 是否被 Google 判定为中国大陆网络。
// 命中特征: 大陆重定向或主页语言锁定 zh-CN；验证码本身不再视为大陆证据。

function testGoogleCN() {
  return (async () => {
    let request = {
      opts: opts_noRedirect,
      timeout: TIMEOUTS.web,
      headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' }
    }
    let resp
    try {
      // 主页响应才能提供地区跳转和页面语言；204 只能作为连通性回退。
      resp = await fetchWithTimeout(Object.assign({ url: GOOGLE_URL }, request))
    } catch (firstError) {
      try {
        resp = await fetchWithTimeout(Object.assign({ url: GOOGLE_NOSSL_URL }, request, { timeout: TIMEOUTS.trace }))
        if (resp.statusCode === 204) {
          result.GoogleCN = "<b>Google 送中: </b>无法判定 (仅连通) ⚠️"
          return
        }
      } catch (secondError) {
        result.GoogleCN = "<b>Google 送中: </b>" + networkErrorLabel(secondError)
        return
      }
    }

    let s = resp.statusCode
    let body = (resp.body || '').toLowerCase()
    let loc = getHeader(resp.headers, 'location').toLowerCase()
    if (loc.indexOf('google.cn') !== -1 ||
        loc.indexOf('google.com.cn') !== -1) {
      result.GoogleCN = "<b>Google 送中: </b>可能 (跳转 Google 中国站) 🇨🇳⚠️"
    } else if (loc.indexOf('hl=zh-cn') !== -1) {
      result.GoogleCN = "<b>Google 送中: </b>无法判定 (语言参数并非地区证据) ⚠️"
    } else if (loc.indexOf('consent.google.') !== -1) {
      result.GoogleCN = "<b>Google 送中: </b>无法判定 (同意页) ⚠️"
    } else if (loc.indexOf('/sorry/') !== -1 || body.indexOf('/sorry/') !== -1) {
      result.GoogleCN = "<b>Google 送中: </b>无法判定 (触发人机验证) ⚠️"
    } else if (/<html[^>]+lang=["']zh-cn["']/.test(body)) {
      result.GoogleCN = "<b>Google 送中: </b>无法判定 (简体页面并非地区证据) ⚠️"
    } else if (s >= 300 && s < 400) {
      result.GoogleCN = "<b>Google 送中: </b>重定向异常 ⚠️"
    } else if (s === 204 || (s >= 200 && s < 300)) {
      result.GoogleCN = "<b>Google 送中: </b>未观察到大陆跳转 (非确定证明) ⚠️"
    } else {
      result.GoogleCN = "<b>Google 送中: </b>异常 (" + s + ") ❗️"
    }
  })()
}

// ===================== 检测: Netflix =====================

function testNetflix() {
  return new Promise((resolve) => {
    fetchWithTimeout({
      url: NETFLIX_URL,
      opts: opts,
      timeout: TIMEOUTS.streaming,
      headers: { 'User-Agent': UA }
    }).then(resp => {
      let s = resp.statusCode
      if (s === 404) {
        result.Netflix = "<b>Netflix: </b>样本不可用 (不能推断仅自制剧) ⚠️"
      } else if (s === 403 && isBotChallenge(resp, resp.body)) {
        result.Netflix = "<b>Netflix: </b>验证拦截 ⚠️"
      } else if (s === 403) {
        result.Netflix = "<b>Netflix: </b>访问受限 (403) ⚠️"
      } else if (s === 200) {
        let url = getHeader(resp.headers, 'x-originating-url')
        let region = ''
        if (url) {
          let parts = url.split('/')
          if (parts[3] && parts[3] !== 'title') {
            region = parts[3].split('-')[0].toUpperCase()
          }
        }
        result.Netflix = "<b>Netflix: </b>样本页可达 (完整解锁未证实)" + arrow + "⟦" + flag(region) + "⟧ ⚠️"
      } else {
        result.Netflix = "<b>Netflix: </b>异常 (" + s + ") ❗️"
      }
      resolve()
    }, err => {
      result.Netflix = "<b>Netflix: </b>" + networkErrorLabel(err)
      resolve()
    })
  })
}

// ===================== 检测: YouTube Premium =====================

function testYouTube() {
  return new Promise((resolve) => {
    fetchWithTimeout({
      url: YOUTUBE_URL,
      opts: opts,
      timeout: TIMEOUTS.streaming,
      headers: { 'User-Agent': UA }
    }).then(resp => {
      let s = resp.statusCode
      let body = (resp.body || '').toLowerCase()

      // 451 必须先于通用 HTTP 错误处理，否则地区限制分支永远无法命中。
      if (s === 451) {
        result.YouTube = "<b>YouTube Premium: </b>地区/法律限制 (451) 🚫"
      } else if (s < 200 || s >= 400) {
        result.YouTube = "<b>YouTube Premium: </b>异常 (" + s + ") ❗️"
      } else {
        // 页面 JS 可能包含限制文案，不能在整页 HTML 中用字符串匹配判定地区封锁。
        let region = ''
        let re = /"(?:gl|innertube_context_gl)":"([a-z]{2})"/
        let ret = re.exec(body)
        if (ret && ret.length === 2) {
          region = ret[1]
        } else if (body.indexOf('www.google.cn') !== -1 || body.indexOf('youtube.cn') !== -1) {
          region = 'CN'
        }
        result.YouTube = "<b>YouTube Premium: </b>页面可达 (订阅资格未证实)" + arrow + "⟦" + flag(region) + "⟧ ⚠️"
      }
      resolve()
    }, err => {
      result.YouTube = "<b>YouTube Premium: </b>" + networkErrorLabel(err)
      resolve()
    })
  })
}

// ===================== 检测: Disney+ =====================
// The legacy device-registration GraphQL client token cannot reliably prove
// playback eligibility. Probe the anonymous homepage and describe only the
// response actually observed; no cookies or account credentials are sent.
function testDisneyPlus() {
  return fetchWithTimeout({
    url: DISNEY_WEB_URL,
    opts: opts_noRedirect,
    timeout: TIMEOUTS.streaming,
    headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' }
  }).then(resp => {
    const status = resp.statusCode
    const body = (resp.body || '').toLowerCase()
    if (status === 451 || (status === 403 && hasApiRegionBlock(body))) {
      result.Disney = "<b>Disneyᐩ: </b>地区/访问限制 (" + status + ") 🚫"
    } else if (isBotChallenge(resp, body)) {
      result.Disney = "<b>Disneyᐩ: </b>验证拦截 ⚠️"
    } else if (status === 403) {
      result.Disney = "<b>Disneyᐩ: </b>访问受限 (403，原因未明) ⚠️"
    } else if (status === 429) {
      result.Disney = "<b>Disneyᐩ: </b>请求限流 (429) ⚠️"
    } else if (status >= 200 && status < 300) {
      result.Disney = "<b>Disneyᐩ: </b>网页可达 (播放未验证) ⚠️"
    } else if (status >= 300 && status < 400) {
      result.Disney = "<b>Disneyᐩ: </b>网页重定向 (播放未验证) ⚠️"
    } else {
      result.Disney = "<b>Disneyᐩ: </b>网页异常 (" + status + ") ⚠️"
    }
  }, err => {
    result.Disney = "<b>Disneyᐩ: </b>" + networkErrorLabel(err)
  })
}

// ===================== 输出构建 =====================

function buildOutput(policyInfo) {
  let nodeLabel = escapeHtml(policyInfo || SELECTED_POLICY || '当前分流（未指定策略）')

  // AI 服务板块
  let aiItems  = [
    result.Claude, result.ClaudeAPI,
    result.ChatGPT, result.OpenAIAPI,
    result.Gemini, result.GeminiAPI
  ].join('<br/><br/>')
  // 流媒体板块
  let mediaItems = [result.Netflix, result.YouTube, result.Disney].join('<br/><br/>')

  let content = ''
  content += '--------------------------------------<br/>'
  content += '<font color=#6C5CE7><b>🤖 AI 服务</b></font><br/><br/>'
  content += aiItems
  content += '<br/><br/>--------------------------------------<br/>'
  content += '<font color=#00A86B><b>🌐 Google 网络</b></font><br/><br/>'
  content += result.GoogleCN
  content += '<br/><br/>--------------------------------------<br/>'
  content += '<font color=#0984E3><b>📺 流媒体</b></font><br/><br/>'
  content += mediaItems
  content += '<br/><br/>--------------------------------------<br/>'
  content += '<font color=#CD5C5C><b>节点</b>' + arrow + nodeLabel + '</font>'

  return '<p style="text-align: center; font-family: -apple-system; font-size: large; font-weight: thin">' + content + '</p>'
}

// ===================== 主流程 =====================

// 所有输出路径共用一个出口，保证最多一次 $done()。
// 超过全局预算时将未完成项目明确标注，不能把它们误报成「不支持」。
let reportDone = false
let reportTimer = null
let resolvedPolicyPath = ''

function finishReport(deadlineReached) {
  if (reportDone) return
  reportDone = true
  if (reportTimer != null) clearTimeout(reportTimer)

  if (deadlineReached) {
    for (const key of ['Claude', 'ClaudeAPI', 'ChatGPT', 'OpenAIAPI',
                       'Gemini', 'GeminiAPI', 'GoogleCN', 'Netflix', 'YouTube', 'Disney']) {
      result[key] = result[key].replace('检测失败 ❗️', '未完成（总时限）⚠️')
    }
  }

  let output
  try {
    output = {
      title: deadlineReached ? '🔍 服务解锁查询（部分结果）' : result.title,
      htmlMessage: buildOutput(resolvedPolicyPath)
    }
  } catch (error) {
    output = {
      title: '🔍 服务解锁查询',
      htmlMessage: '<p>报告生成异常：' + escapeHtml(error) + '</p>'
    }
  }
  $done(output)
}

// 策略链路是辅助信息，绝对不能阻塞主体诊断结果。
// 对不提供 $configuration API 的 QX 环境、空策略参数和永久 pending 都安全降级。
function queryPolicyPath() {
  return new Promise(resolve => {
    if (!SELECTED_POLICY || typeof $configuration === 'undefined' ||
        !$configuration || typeof $configuration.sendMessage !== 'function') {
      resolve()
      return
    }

    let settled = false
    const timer = setTimeout(() => complete(null), POLICY_LOOKUP_TIMEOUT_MS)
    function complete(response) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        if (response && response.ret) {
          let path = response.ret[SELECTED_POLICY]
          if (Array.isArray(path)) resolvedPolicyPath = path.join(arrow)
          else if (typeof path === 'string') resolvedPolicyPath = path
        }
      } catch (error) {
        console.log('>>> 策略链路解析失败: ' + error)
      }
      resolve()
    }

    try {
      Promise.resolve($configuration.sendMessage({
        action: 'get_policy_state',
        content: SELECTED_POLICY
      })).then(complete, () => complete(null))
    } catch (error) {
      complete(null)
    }
  })
}

;(async () => {
  if (SCRIPT_MODE === 'selftest') {
    // If no panel appears, investigate the QX task cache/Tunnel/runtime first.
    reportDone = true
    $done({
      title: '🔍 服务解锁查询 · 引擎自检',
      htmlMessage: '<p style="text-align:center"><b>✅ QX 脚本引擎执行成功</b><br/>' +
        '未发起网络请求，也未判断任何服务是否解锁。<br/>' +
        '当前策略标签：' + escapeHtml(SELECTED_POLICY || '未传入') + '</p>'
    })
    return
  }

  // 从第一行开始计时：任何网络或 API 卡住均不得让 UI 一直空白。
  reportTimer = setTimeout(() => finishReport(true), SCRIPT_DEADLINE_MS)
  console.log('>>> 服务解锁检测启动 (总时限 ' + SCRIPT_DEADLINE_MS + 'ms)')

  let policyTask = queryPolicyPath()
  const probes = [
    ['Claude', testClaude],
    ['ClaudeAPI', testClaudeAPI],
    ['ChatGPT', testChatGPT],
    ['OpenAIAPI', testOpenAIAPI],
    ['Gemini', testGemini],
    ['GeminiAPI', testGeminiAPI],
    ['GoogleCN', testGoogleCN],
    ['Netflix', testNetflix],
    ['YouTube', testYouTube],
    ['Disney', testDisneyPlus]
  ]

  await Promise.all(probes.map(([name, probe]) =>
    Promise.resolve().then(probe).catch(error => {
      console.log('>>> 检测项 ' + name + ' 异常: ' + error)
      result[name] = result[name].replace('检测失败 ❗️', '检测异常 ⚠️')
    })
  ))
  await policyTask

  console.log('>>> 服务解锁检测完成')
  finishReport(false)
})().catch(error => {
  console.log('>>> 脚本全局异常: ' + error)
  finishReport(true)
})
