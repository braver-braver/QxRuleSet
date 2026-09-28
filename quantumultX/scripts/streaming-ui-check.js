/***
 * 服务解锁检测 v3.1.1 (AI + 流媒体 + Google 送中检测)
 *
 * 基于 KOP-XIAO/QuantumultX streaming-ui-check.js 重构维护
 * Thanks to: Hyseen, AtlantisGawrGura, CoiaPrant, Netflixxp
 *
 * 更新: 2026-09-24
 *
 * ★ 重点检测: Claude (Web + API) / ChatGPT (Web + API) / Gemini (Web + API)
 * ★ Google 送中检测: 判断节点 IP 是否被 Google 判定为大陆网络（大陆重定向/强制简体）
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
// Trace/API 请求通常很快，网页和流媒体在移动网络上需要更长时间。
const TIMEOUTS = {
  trace: 4000,
  api: 7000,
  web: 9000,
  streaming: 10000
}
const MAX_ATTEMPTS = 2
const RETRY_DELAY = 600

// --- Claude ---
const CLAUDE_WEB_URL     = 'https://claude.ai'
const CLAUDE_TRACE_URL   = 'https://claude.ai/cdn-cgi/trace'
const CLAUDE_API_URL     = 'https://api.anthropic.com/v1/messages'

// --- ChatGPT / OpenAI ---
const CHATGPT_WEB_URL    = 'https://chatgpt.com'
const CHATGPT_TRACE_URL  = 'https://chatgpt.com/cdn-cgi/trace'
const OPENAI_API_URL     = 'https://api.openai.com/v1/models'

// --- Gemini / Google AI ---
const GEMINI_WEB_URL     = 'https://gemini.google.com/app'
const GEMINI_API_URL     = 'https://generativelanguage.googleapis.com/v1beta/models?key=AIzaTest00000000000000000000000000'

// --- Google 送中检测 ---
// 命中大陆网络时，Google 会返回 zh-CN 简体页面 / 302 到 google.cn / 触发 sorry 人机验证
const GOOGLE_URL          = 'https://www.google.com/'
const GOOGLE_NOSSL_URL    = 'http://www.google.com/generate_204'
const REGION_FALLBACK_URL  = 'https://ipapi.co/json/'

// --- 流媒体 ---
const NETFLIX_URL        = 'https://www.netflix.com/title/81280792'
const YOUTUBE_URL        = 'https://www.youtube.com/premium'
const DISNEY_API_URL     = 'https://disney.api.edge.bamgrid.com/graph/v1/device/graphql'
const DISNEY_TOKEN       = 'ZGlzbmV5JmJyb3dzZXImMS4wLjA.Cu56AgSfBTDag5NiRA81oLHkDZfu5L3CKadnefEAY84'

// ===================== QuantumultX 选项 =====================

var opts           = { policy: $environment.params }
var opts_noRedirect = { policy: $environment.params, redirection: false }

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
  ["TW","🇨🇳"],["TZ","🇹🇿"],["UA","🇺🇦"],["UG","🇺🇬"],["UK","🇬🇧"],["UM","🇺🇲"],
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
  return text.indexOf('country not supported') !== -1 ||
    text.indexOf('not available in your country') !== -1 ||
    text.indexOf('not available in your region') !== -1 ||
    text.indexOf('service is not available in your territory') !== -1
}

function hasApiRegionBlock(body) {
  let text = (body || '').toLowerCase()
  return hasStructuredRegionBlock(text) ||
    hasExplicitRegionMessage(text) ||
    /(?:user )?location[^.]{0,40}(?:not supported|unsupported)/.test(text)
}

function isBotChallenge(resp, body) {
  let text = (body || '').toLowerCase()
  return getHeader(resp && resp.headers, 'cf-mitigated').toLowerCase() === 'challenge' ||
    text.indexOf('challenge-platform') !== -1 ||
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

// Quantumult X 只会在网络层失败时 reject；HTTP 错误仍然会 resolve。
// 重试只针对可恢复的网络失败，避免对明确的 4xx/5xx 重复请求。
// 超时在脚本层实现，避免依赖 Quantumult X 未公开的单请求 timeout 行为。
function fetchWithRetry(request) {
  return new Promise((resolve, reject) => {
    let attempt = 0
    let run = () => {
      attempt++
      let settled = false
      let timer = setTimeout(() => {
        if (settled) return
        settled = true
        retryOrReject(new Error('timeout'))
      }, request.timeout)
      let retryOrReject = err => {
        if (attempt < MAX_ATTEMPTS) {
          setTimeout(run, RETRY_DELAY * attempt)
        } else {
          reject(err)
        }
      }
      $task.fetch(request).then(response => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(response)
      }, err => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        retryOrReject(err)
      })
    }
    run()
  })
}

function networkErrorLabel(err) {
  let message = String(err || '').toLowerCase()
  if (message.indexOf('timeout') !== -1 || message.indexOf('timed out') !== -1) return '检测超时 🚦'
  if (message.indexOf('dns') !== -1 || message.indexOf('getaddrinfo') !== -1 || message.indexOf('resolve') !== -1) return 'DNS 失败 🚫'
  if (message.indexOf('refused') !== -1 || message.indexOf('reset') !== -1 || message.indexOf('connect') !== -1) return '连接失败 🚫'
  return '网络错误 🚦'
}

async function getRegion(traceUrl) {
  try {
    let trace = await fetchWithRetry({ url: traceUrl, opts: opts, timeout: TIMEOUTS.trace, headers: { 'User-Agent': UA } })
    if (trace.statusCode === 200) {
      let region = regionFromTrace(trace.body)
      if (region) return region
    }
  } catch (e) {}

  try {
    let fallback = await fetchWithRetry({ url: REGION_FALLBACK_URL, opts: opts, timeout: TIMEOUTS.trace, headers: { 'User-Agent': UA } })
    if (fallback.statusCode === 200) {
      let data = JSON.parse(fallback.body || '{}')
      if (data.country_code) return String(data.country_code).toUpperCase()
    }
  } catch (e) {}
  return ''
}

// ===================== 检测: Claude Web =====================

function testClaude() {
  return (async () => {
    let region = await getRegion(CLAUDE_TRACE_URL)
    let f = flag(region)
    try {
      let resp = await fetchWithRetry({
        url: CLAUDE_WEB_URL,
        opts: opts,
        timeout: TIMEOUTS.web,
        headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' }
      })
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
        result.Claude = "<b>Claude: </b>支持 " + arrow + "⟦" + f + "⟧ 🎉"
      } else {
        result.Claude = "<b>Claude: </b>异常 (" + s + ") ❗️"
      }
    } catch (e) {
      result.Claude = "<b>Claude: </b>" + networkErrorLabel(e)
    }
  })()
}

// ===================== 检测: Claude API =====================

function testClaudeAPI() {
  return new Promise((resolve) => {
    fetchWithRetry({
      url: CLAUDE_API_URL,
      method: 'POST',
      opts: opts,
      timeout: TIMEOUTS.api,
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': 'sk-ant-api03-test-000000'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }]
      })
    }).then(resp => {
      let s = resp.statusCode
      let body = (resp.body || '').toLowerCase()

      // 401 = authentication_error → API 可达 (密钥无效而已)
      // 400 = invalid_request     → API 可达
      // 429 = rate_limit          → API 可达
      // 529 = overloaded          → API 可达
      if (s === 401 || s === 400 || s === 429 || s === 529) {
        result.ClaudeAPI = "<b>Claude API: </b>可用 🎉"
      } else if (s === 403 && hasApiRegionBlock(body)) {
        result.ClaudeAPI = "<b>Claude API: </b>受限 🚫"
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
    let region = await getRegion(CHATGPT_TRACE_URL)
    let f = flag(region)
    try {
      let resp = await fetchWithRetry({ url: CHATGPT_WEB_URL, opts: opts_noRedirect, timeout: TIMEOUTS.web, headers: { 'User-Agent': UA } })
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
        result.ChatGPT = "<b>ChatGPT: </b>支持 " + arrow + "⟦" + f + "⟧ 🎉"
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
    fetchWithRetry({
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

      // 401 = invalid_api_key → API 可达
      if (s === 401 || s === 429) {
        result.OpenAIAPI = "<b>OpenAI API: </b>可用 🎉"
      } else if (s === 403 && hasApiRegionBlock(body)) {
        result.OpenAIAPI = "<b>OpenAI API: </b>受限 🚫"
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
    fetchWithRetry({
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
          result.Gemini = "<b>Gemini: </b>支持 🎉"
        } else {
          result.Gemini = "<b>Gemini: </b>重定向异常 ⚠️"
        }
      } else if (s === 451 || hasStructuredRegionBlock(body) || hasExplicitRegionMessage(body)) {
        result.Gemini = "<b>Gemini: </b>未支持 🚫"
      } else if (s === 403) {
        result.Gemini = "<b>Gemini: </b>访问受限 (403) ⚠️"
      } else if (s >= 200 && s < 400) {
        result.Gemini = "<b>Gemini: </b>支持 🎉"
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
    fetchWithRetry({
      url: GEMINI_API_URL,
      opts: opts,
      timeout: TIMEOUTS.api,
      headers: { 'User-Agent': UA }
    }).then(resp => {
      let s = resp.statusCode
      let body = (resp.body || '').toLowerCase()

      // 400 = API_KEY_INVALID → 服务可达，仅密钥无效
      if (s === 400 || s === 401) {
        result.GeminiAPI = "<b>Gemini API: </b>可用 🎉"
      } else if (s === 403 && hasApiRegionBlock(body)) {
        result.GeminiAPI = "<b>Gemini API: </b>受限 🚫"
      } else if (s === 403) {
        result.GeminiAPI = "<b>Gemini API: </b>访问受限 (403) ⚠️"
      } else if (s === 200) {
        result.GeminiAPI = "<b>Gemini API: </b>可用 🎉"
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
      resp = await fetchWithRetry(Object.assign({ url: GOOGLE_URL }, request))
    } catch (firstError) {
      try {
        resp = await fetchWithRetry(Object.assign({ url: GOOGLE_NOSSL_URL }, request))
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
        loc.indexOf('google.com.cn') !== -1 ||
        loc.indexOf('google.com.hk') !== -1 ||
        loc.indexOf('hkredirect') !== -1 ||
        loc.indexOf('hl=zh-cn') !== -1) {
      result.GoogleCN = "<b>Google 送中: </b>是 (大陆重定向) 🇨🇳⚠️"
    } else if (loc.indexOf('consent.google.') !== -1) {
      result.GoogleCN = "<b>Google 送中: </b>无法判定 (同意页) ⚠️"
    } else if (loc.indexOf('/sorry/') !== -1 || body.indexOf('/sorry/') !== -1) {
      result.GoogleCN = "<b>Google 送中: </b>无法判定 (触发人机验证) ⚠️"
    } else if (/<html[^>]+lang=["']zh-cn["']/.test(body)) {
      result.GoogleCN = "<b>Google 送中: </b>是 (强制简体页面) 🇨🇳⚠️"
    } else if (s >= 300 && s < 400) {
      result.GoogleCN = "<b>Google 送中: </b>重定向异常 ⚠️"
    } else if (s === 204 || (s >= 200 && s < 300)) {
      result.GoogleCN = "<b>Google 送中: </b>否 ✅"
    } else {
      result.GoogleCN = "<b>Google 送中: </b>异常 (" + s + ") ❗️"
    }
  })()
}

// ===================== 检测: Netflix =====================

function testNetflix() {
  return new Promise((resolve) => {
    fetchWithRetry({
      url: NETFLIX_URL,
      opts: opts,
      timeout: TIMEOUTS.streaming,
      headers: { 'User-Agent': UA }
    }).then(resp => {
      let s = resp.statusCode
      if (s === 404) {
        result.Netflix = "<b>Netflix: </b>仅自制剧 ⚠️"
      } else if (s === 403 && isBotChallenge(resp, resp.body)) {
        result.Netflix = "<b>Netflix: </b>验证拦截 ⚠️"
      } else if (s === 403) {
        result.Netflix = "<b>Netflix: </b>未支持 🚫"
      } else if (s === 200) {
        let url = getHeader(resp.headers, 'x-originating-url')
        let region = ''
        if (url) {
          let parts = url.split('/')
          if (parts[3] && parts[3] !== 'title') {
            region = parts[3].split('-')[0].toUpperCase()
          }
        }
        result.Netflix = "<b>Netflix: </b>完整支持" + arrow + "⟦" + flag(region) + "⟧ 🎉"
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
    fetchWithRetry({
      url: YOUTUBE_URL,
      opts: opts,
      timeout: TIMEOUTS.streaming,
      headers: { 'User-Agent': UA }
    }).then(resp => {
      let s = resp.statusCode
      let body = (resp.body || '').toLowerCase()

      if (s < 200 || s >= 400) {
        result.YouTube = "<b>YouTube Premium: </b>异常 (" + s + ") ❗️"
        resolve()
        return
      }

      if (body.indexOf('premium is not available in your country') !== -1 ||
          body.indexOf('youtube premium is not available') !== -1 ||
          body.indexOf('not available in your region') !== -1) {
        result.YouTube = "<b>YouTube Premium: </b>未支持 🚫"
      } else {
        let region = ''
        let re = /"(?:gl|innertube_context_gl)":"([a-z]{2})"/
        let ret = re.exec(body)
        if (ret && ret.length === 2) {
          region = ret[1]
        } else if (body.indexOf('www.google.cn') !== -1 || body.indexOf('youtube.cn') !== -1) {
          region = 'CN'
        }
        result.YouTube = "<b>YouTube Premium: </b>支持 " + arrow + "⟦" + flag(region) + "⟧ 🎉"
      }
      resolve()
    }, err => {
      result.YouTube = "<b>YouTube Premium: </b>" + networkErrorLabel(err)
      resolve()
    })
  })
}

// ===================== 检测: Disney+ =====================

function testDisneyPlus() {
  return new Promise((resolve) => {
    fetchWithRetry({
      url: DISNEY_API_URL,
      method: 'POST',
      opts: opts,
      timeout: TIMEOUTS.streaming,
      headers: {
        'Accept-Language': 'en',
        'Authorization': DISNEY_TOKEN,
        'Content-Type': 'application/json',
        'User-Agent': UA
      },
      body: JSON.stringify({
        query: 'mutation registerDevice($input: RegisterDeviceInput!) { registerDevice(registerDevice: $input) { grant { grantType assertion } } }',
        variables: {
          input: {
            applicationRuntime: 'chrome',
            attributes: {
              browserName: 'chrome',
              browserVersion: '126.0.0',
              manufacturer: 'apple',
              model: null,
              operatingSystem: 'macintosh',
              operatingSystemVersion: '10.15.7',
              osDeviceIds: []
            },
            deviceFamily: 'browser',
            deviceLanguage: 'en',
            deviceProfile: 'macosx'
          }
        }
      })
    }).then(resp => {
      let body = (resp.body || '').toLowerCase()
      if (resp.statusCode === 401) {
        result.Disney = "<b>Disneyᐩ: </b>Token 失效，需更新 ⚠️"
        resolve()
        return
      }
      if (resp.statusCode === 403 && hasApiRegionBlock(body)) {
        result.Disney = "<b>Disneyᐩ: </b>未支持 🚫"
        resolve()
        return
      }
      if (resp.statusCode === 403 && /token|unauthorized|invalid credential/.test(body)) {
        result.Disney = "<b>Disneyᐩ: </b>Token 失效，需更新 ⚠️"
        resolve()
        return
      }
      if (resp.statusCode === 403) {
        result.Disney = "<b>Disneyᐩ: </b>访问受限 (403) ⚠️"
        resolve()
        return
      }
      if (resp.statusCode !== 200) {
        result.Disney = "<b>Disneyᐩ: </b>未支持 🚫"
        resolve()
        return
      }

      try {
        let data = JSON.parse(resp.body)
        let sdk = data && data.extensions && data.extensions.sdk
        if (!sdk) {
          result.Disney = "<b>Disneyᐩ: </b>检测异常 ❗️"
          resolve()
          return
        }

        let session = sdk.session || {}
        let inSupported = session.inSupportedLocation
        let region = (session.location && session.location.countryCode) || ''
        let f = flag(region)

        if (inSupported === false || inSupported === 'false') {
          result.Disney = "<b>Disneyᐩ: </b>即将登陆" + arrow + "⟦" + f + "⟧ ⚠️"
        } else if (inSupported === true || inSupported === 'true') {
          result.Disney = "<b>Disneyᐩ: </b>支持 " + arrow + "⟦" + f + "⟧ 🎉"
        } else {
          result.Disney = "<b>Disneyᐩ: </b>检测异常 ❗️"
        }
      } catch (e) {
        result.Disney = "<b>Disneyᐩ: </b>检测异常 ❗️"
      }
      resolve()
    }, err => {
      result.Disney = "<b>Disneyᐩ: </b>" + networkErrorLabel(err)
      resolve()
    })
  })
}

// ===================== 输出构建 =====================

function buildOutput(policyInfo) {
  let nodeLabel = escapeHtml(policyInfo || $environment.params)

  // AI 服务板块
  let aiItems  = [
    result.Claude, result.ClaudeAPI,
    result.ChatGPT, result.OpenAIAPI,
    result.Gemini, result.GeminiAPI
  ].join('</br></br>')
  // 流媒体板块
  let mediaItems = [result.Netflix, result.YouTube, result.Disney].join('</br></br>')

  let content = ''
  content += '--------------------------------------</br>'
  content += '<font color=#6C5CE7><b>🤖 AI 服务</b></font></br></br>'
  content += aiItems
  content += '</br></br>--------------------------------------</br>'
  content += '<font color=#00A86B><b>🌐 Google 网络</b></font></br></br>'
  content += result.GoogleCN
  content += '</br></br>--------------------------------------</br>'
  content += '<font color=#0984E3><b>📺 流媒体</b></font></br></br>'
  content += mediaItems
  content += '</br></br>--------------------------------------</br>'
  content += '<font color=#CD5C5C><b>节点</b>' + arrow + nodeLabel + '</font>'

  return '<p style="text-align: center; font-family: -apple-system; font-size: large; font-weight: thin">' + content + '</p>'
}

// ===================== 主流程 =====================

const message = {
  action: "get_policy_state",
  content: $environment.params
}

;(async () => {
  console.log(">>> 脚本启动, 策略组: " + $environment.params)

  // 并发执行所有检测
  await Promise.all([
    testClaude(),
    testClaudeAPI(),
    testChatGPT(),
    testOpenAIAPI(),
    testGemini(),
    testGeminiAPI(),
    testGoogleCN(),
    testNetflix(),
    testYouTube(),
    testDisneyPlus()
  ])

  console.log(">>> 全部检测完成")
  console.log(">>> Claude: " + result.Claude)
  console.log(">>> ChatGPT: " + result.ChatGPT)
  console.log(">>> Gemini: " + result.Gemini)
  console.log(">>> Google送中: " + result.GoogleCN)

  // 获取策略组链路信息
  try {
    let resolve = await $configuration.sendMessage(message)
    if (resolve.ret) {
      let path = resolve.ret[message.content]
      let output = Array.isArray(path) ? path.join(arrow) : (path || $environment.params)
      $done({ title: result.title, htmlMessage: buildOutput(output) })
    } else {
      $done({ title: result.title, htmlMessage: buildOutput(null) })
    }
  } catch (e) {
    console.log(">>> sendMessage 异常: " + e)
    $done({ title: result.title, htmlMessage: buildOutput(null) })
  }
})().catch(e => {
  // 全局兜底：无论什么错误都保证 $done 被调用
  console.log(">>> 脚本全局异常: " + e)
  $done({
    title: '🔍 服务解锁查询',
    htmlMessage: '<p style="text-align:center">脚本执行出错: ' + escapeHtml(e) + '</p>'
  })
})
