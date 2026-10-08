/**
 * AI Node Sifter for Quantumult X
 * version: 0.2.0
 * updated: 2026-10-08
 *
 * Goal:
 * - keep AI traffic on a node that is actually accepted by the provider
 * - prefer stability over lowest latency
 * - support fail-closed mode and sticky recovery mode
 * - sticky recovery keeps/restores the last verified node across transient network changes
 *
 * Uses Quantumult X configuration APIs:
 * - get_customized_policy
 * - get_policy_state
 * - url_latency_benchmark
 * - set_policy_state
 *
 * Examples:
 * event-interaction .../ai-node-sifter.js#provider=openai
 * event-interaction .../ai-node-sifter.js#provider=claude
 * event-interaction .../ai-node-sifter.js#provider=gemini
 */

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
const CONCURRENCY = 3
const TIMEOUT = 7000
const TRACE_TIMEOUT = 4500
const FAIL_CLOSED = "reject"
const PREF_PREFIX = "qxrule.ai-node-sifter."
const NETWORK_DEBOUNCE_MS = 15000

const PROVIDERS = {
  openai: {
    name: "OpenAI",
    policy: "🤖 OpenAI安全节点",
    preferredRegions: ["US", "GB", "JP", "SG"],
    traceUrl: "https://chatgpt.com/cdn-cgi/trace",
    webUrl: "https://chatgpt.com",
    apiUrl: "https://api.openai.com/v1/models"
  },
  claude: {
    name: "Claude",
    policy: "🧠 Claude安全节点",
    preferredRegions: ["US", "GB", "JP", "SG"],
    traceUrl: "https://claude.ai/cdn-cgi/trace",
    webUrl: "https://claude.ai",
    apiUrl: "https://api.anthropic.com/v1/messages"
  },
  gemini: {
    name: "Gemini",
    policy: "✨ Gemini安全节点",
    preferredRegions: ["US", "JP", "SG", "GB"],
    traceUrl: "https://ipapi.co/json/",
    webUrl: "https://gemini.google.com/app",
    apiUrl: "https://generativelanguage.googleapis.com/v1beta/models?key=AIzaTest00000000000000000000000000"
  }
}

function parseArgs() {
  let out = {}
  let src = String(($environment && $environment.sourcePath) || "")
  let params = String(($environment && $environment.params) || "")
  let hash = src.indexOf("#") >= 0 ? src.split("#").pop() : ""
  let raw = [hash, params].filter(Boolean).join("&")
  raw.split("&").forEach(part => {
    let i = part.indexOf("=")
    if (i > 0) {
      let k = decodeURIComponent(part.slice(0, i))
      let v = decodeURIComponent(part.slice(i + 1))
      out[k] = v
    }
  })
  if (!out.provider) {
    let p = params.toLowerCase()
    if (p.indexOf("openai") >= 0 || p.indexOf("chatgpt") >= 0) out.provider = "openai"
    else if (p.indexOf("claude") >= 0 || p.indexOf("anthropic") >= 0) out.provider = "claude"
    else if (p.indexOf("gemini") >= 0) out.provider = "gemini"
  }
  return out
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)))
}

function prefKey(provider, suffix) {
  return PREF_PREFIX + provider + "." + suffix
}

function loadLastGood(provider) {
  try {
    let raw = $prefs.valueForKey(prefKey(provider, "last-good"))
    let value = raw ? JSON.parse(raw) : null
    if (!value || !value.node) return null
    return value
  } catch (_) {
    return null
  }
}

function saveLastGood(provider, result) {
  if (!result || result.status !== "pass" || !result.node) return false
  try {
    return $prefs.setValueForKey(JSON.stringify({
      node: result.node,
      region: result.region || "",
      verifiedAt: Date.now()
    }), prefKey(provider, "last-good"))
  } catch (_) {
    return false
  }
}

function acquireNetworkRun(provider) {
  try {
    let key = prefKey(provider, "network-run")
    let now = Date.now()
    let previous = Number($prefs.valueForKey(key) || 0)
    if (previous > 0 && now - previous < NETWORK_DEBOUNCE_MS) return false
    $prefs.setValueForKey(String(now), key)
    return true
  } catch (_) {
    return true
  }
}

function isStickyMode(args) {
  return String((args && args.mode) || "").toLowerCase() === "sticky"
}

function isNetworkRun(args) {
  return String((args && args.trigger) || "").toLowerCase() === "network"
}

function qx(action, content) {
  let message = { action: action }
  if (typeof content !== "undefined") message.content = content
  return $configuration.sendMessage(message).then(r => {
    if (!r || r.error) throw new Error((r && r.error) || action + " failed")
    return r.ret || {}
  })
}

function getHeader(headers, name) {
  let target = String(name).toLowerCase()
  let source = headers || {}
  let keys = Object.keys(source)
  for (let i = 0; i < keys.length; i++) {
    if (String(keys[i]).toLowerCase() === target) return String(source[keys[i]] || "")
  }
  return ""
}

function fetchWithTimeout(request) {
  return new Promise((resolve, reject) => {
    let settled = false
    let timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error("timeout"))
    }, request.timeout || TIMEOUT)

    $task.fetch(request).then(resp => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(resp)
    }, err => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err)
    })
  })
}

function hasRegionBlock(body) {
  let t = String(body || "").toLowerCase()
  return /"unsupported_(?:country|region)"\s*:\s*true/.test(t) ||
    /"(?:code|reason)"\s*:\s*"unsupported_(?:country|region)[^"]*"/.test(t) ||
    t.indexOf("country not supported") >= 0 ||
    t.indexOf("not available in your country") >= 0 ||
    t.indexOf("not available in your region") >= 0 ||
    t.indexOf("service is not available in your territory") >= 0 ||
    /(?:user )?location[^.]{0,40}(?:not supported|unsupported)/.test(t)
}

function isBotChallenge(resp, body) {
  let t = String(body || "").toLowerCase()
  return getHeader(resp && resp.headers, "cf-mitigated").toLowerCase() === "challenge" ||
    t.indexOf("challenge-platform") >= 0 ||
    t.indexOf("cf-chl-") >= 0 ||
    t.indexOf("checking your browser") >= 0 ||
    t.indexOf("verify you are human") >= 0
}

function normalizeRegion(value) {
  let v = String(value || "").toUpperCase()
  if (v === "UK") return "GB"
  return /^[A-Z]{2}$/.test(v) ? v : ""
}

async function getRegion(provider, node) {
  let cfg = PROVIDERS[provider]
  try {
    let resp = await fetchWithTimeout({
      url: cfg.traceUrl,
      opts: { policy: node, redirection: false },
      timeout: TRACE_TIMEOUT,
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" }
    })
    if (provider === "gemini") {
      if (resp.statusCode === 200) {
        let data = JSON.parse(resp.body || "{}")
        return normalizeRegion(data.country_code || data.country)
      }
      return ""
    }
    if (resp.statusCode === 200) {
      let m = String(resp.body || "").match(/(?:^|\n)loc=([A-Z]{2})(?:\n|$)/)
      return normalizeRegion(m && m[1])
    }
  } catch (_) {}
  return ""
}

async function testOpenAI(node, region) {
  let cfg = PROVIDERS.openai
  let web
  try {
    web = await fetchWithTimeout({
      url: cfg.webUrl,
      opts: { policy: node, redirection: false },
      timeout: TIMEOUT,
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" }
    })
  } catch (e) {
    return { status: "uncertain", reason: "web network error", region: region }
  }

  let wb = String(web.body || "")
  if (web.statusCode === 451 || hasRegionBlock(wb)) return { status: "fail", reason: "unsupported region", region: region }
  if (isBotChallenge(web, wb) || web.statusCode === 403) return { status: "uncertain", reason: "web challenge/403", region: region }
  if (web.statusCode < 200 || web.statusCode >= 400) return { status: "uncertain", reason: "web " + web.statusCode, region: region }

  try {
    let api = await fetchWithTimeout({
      url: cfg.apiUrl,
      opts: { policy: node },
      timeout: TIMEOUT,
      headers: { "Authorization": "Bearer sk-test-00000000", "User-Agent": UA }
    })
    let body = String(api.body || "")
    if (api.statusCode === 451 || (api.statusCode === 403 && hasRegionBlock(body))) {
      return { status: "fail", reason: "API region blocked", region: region }
    }
    if (api.statusCode === 401 || api.statusCode === 429 || api.statusCode === 200) {
      return { status: "pass", reason: "web + API reachable", region: region }
    }
    if (api.statusCode === 403) return { status: "uncertain", reason: "API generic 403", region: region }
    return { status: "uncertain", reason: "API " + api.statusCode, region: region }
  } catch (e) {
    return { status: "uncertain", reason: "API network error", region: region }
  }
}

async function testClaude(node, region) {
  let cfg = PROVIDERS.claude
  let web
  try {
    web = await fetchWithTimeout({
      url: cfg.webUrl,
      opts: { policy: node, redirection: false },
      timeout: TIMEOUT,
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" }
    })
  } catch (e) {
    return { status: "uncertain", reason: "web network error", region: region }
  }

  let wb = String(web.body || "")
  if (web.statusCode === 451 || hasRegionBlock(wb)) return { status: "fail", reason: "unsupported region", region: region }
  if (isBotChallenge(web, wb) || web.statusCode === 403) return { status: "uncertain", reason: "web challenge/403", region: region }
  if (web.statusCode < 200 || web.statusCode >= 400) return { status: "uncertain", reason: "web " + web.statusCode, region: region }

  try {
    let api = await fetchWithTimeout({
      url: cfg.apiUrl,
      method: "POST",
      opts: { policy: node },
      timeout: TIMEOUT,
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": "sk-ant-api03-test-000000"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }]
      })
    })
    let body = String(api.body || "")
    if (api.statusCode === 451 || (api.statusCode === 403 && hasRegionBlock(body))) {
      return { status: "fail", reason: "API region blocked", region: region }
    }
    if ([400, 401, 429, 529, 200].indexOf(api.statusCode) >= 0) {
      return { status: "pass", reason: "web + API reachable", region: region }
    }
    if (api.statusCode === 403) return { status: "uncertain", reason: "API generic 403", region: region }
    return { status: "uncertain", reason: "API " + api.statusCode, region: region }
  } catch (e) {
    return { status: "uncertain", reason: "API network error", region: region }
  }
}

async function testGemini(node, region) {
  let cfg = PROVIDERS.gemini
  let web
  try {
    web = await fetchWithTimeout({
      url: cfg.webUrl,
      opts: { policy: node, redirection: false },
      timeout: TIMEOUT,
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" }
    })
  } catch (e) {
    return { status: "uncertain", reason: "web network error", region: region }
  }

  let wb = String(web.body || "")
  let loc = getHeader(web.headers, "location").toLowerCase()
  if (web.statusCode === 451 || hasRegionBlock(wb)) return { status: "fail", reason: "unsupported region", region: region }
  if (web.statusCode === 403) return { status: "uncertain", reason: "web 403", region: region }
  let webOkay = (web.statusCode >= 200 && web.statusCode < 300) ||
    ([301, 302, 307, 308].indexOf(web.statusCode) >= 0 &&
      (loc.indexOf("accounts.google.com") >= 0 || loc.indexOf("gemini.google.com") >= 0 || loc.indexOf("consent.google.com") >= 0))
  if (!webOkay) return { status: "uncertain", reason: "web " + web.statusCode, region: region }

  try {
    let api = await fetchWithTimeout({
      url: cfg.apiUrl,
      opts: { policy: node },
      timeout: TIMEOUT,
      headers: { "User-Agent": UA }
    })
    let body = String(api.body || "")
    if (api.statusCode === 451 || (api.statusCode === 403 && hasRegionBlock(body))) {
      return { status: "fail", reason: "API region blocked", region: region }
    }
    if ([200, 400, 401].indexOf(api.statusCode) >= 0) {
      return { status: "pass", reason: "web + API reachable", region: region }
    }
    if (api.statusCode === 403) return { status: "uncertain", reason: "API generic 403", region: region }
    return { status: "uncertain", reason: "API " + api.statusCode, region: region }
  } catch (e) {
    return { status: "uncertain", reason: "API network error", region: region }
  }
}

async function testNode(provider, node) {
  let cfg = PROVIDERS[provider]
  let region = await getRegion(provider, node)
  if (!region) return { node: node, status: "uncertain", reason: "exit region unknown", region: "" }
  if (cfg.preferredRegions.indexOf(region) < 0) {
    return { node: node, status: "fail", reason: "unexpected exit region " + region, region: region }
  }

  let r
  if (provider === "openai") r = await testOpenAI(node, region)
  else if (provider === "claude") r = await testClaude(node, region)
  else r = await testGemini(node, region)

  r.node = node
  return r
}

async function mapLimit(items, limit, fn) {
  let out = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (true) {
      let i = cursor++
      if (i >= items.length) return
      try {
        out[i] = await fn(items[i], i)
      } catch (e) {
        out[i] = { node: items[i], status: "uncertain", reason: String(e), region: "" }
      }
    }
  }
  let workers = []
  let count = Math.min(limit, items.length)
  for (let i = 0; i < count; i++) workers.push(worker())
  await Promise.all(workers)
  return out
}

async function getCandidates(policy) {
  let ret = await qx("get_customized_policy", policy)
  let item = ret && ret[policy]
  let candidates = item && Array.isArray(item.candidates) ? item.candidates : []
  return candidates.filter(x => ["direct", "proxy", "reject"].indexOf(String(x).toLowerCase()) < 0)
}

async function getCurrentLeaf(policy) {
  let ret = await qx("get_policy_state")
  let path = ret && ret[policy]
  if (!Array.isArray(path) || !path.length) return ""
  return String(path[path.length - 1] || "")
}

async function benchmark(nodes) {
  if (!nodes.length) return {}
  try {
    return await qx("url_latency_benchmark", nodes)
  } catch (_) {
    return {}
  }
}

function latencyOf(result, node) {
  let v = result && result[node]
  if (!Array.isArray(v)) return Number.POSITIVE_INFINITY
  let n = Number(v[1])
  return n >= 0 ? n : Number.POSITIVE_INFINITY
}

function chooseBest(cfg, safe, latency, stickyRegion) {
  // Stability first: if the previous exit region is still available, stay in that
  // region. Otherwise all verified regions are equal and latency breaks the tie.
  return safe.slice().sort((a, b) => {
    let aSame = stickyRegion && a.region === stickyRegion ? 0 : 1
    let bSame = stickyRegion && b.region === stickyRegion ? 0 : 1
    if (aSame !== bSame) return aSame - bSame
    return latencyOf(latency, a.node) - latencyOf(latency, b.node)
  })[0]
}

async function setPolicy(policy, target) {
  return qx("set_policy_state", { [policy]: target })
}

function escapeHtml(v) {
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}

function statusIcon(status) {
  return status === "pass" ? "✅" : status === "fail" ? "❌" : "⚠️"
}

function render(cfg, action, selected, results, latency) {
  let rows = (results || []).map(r => {
    let ms = latencyOf(latency || {}, r.node)
    let l = Number.isFinite(ms) ? " · " + ms + " ms" : ""
    return statusIcon(r.status) + " " + escapeHtml(r.node) + " · " + escapeHtml(r.region || "?") + l + "<br><small>" + escapeHtml(r.reason) + "</small>"
  }).join("<br><br>")

  let content = "<p style='font-family:-apple-system;font-size:large'>"
  content += "<b>" + escapeHtml(cfg.name) + " AI 安全节点</b><br><br>"
  content += escapeHtml(action) + "<br>"
  content += "当前选择：<b>" + escapeHtml(selected || FAIL_CLOSED) + "</b>"
  if (rows) content += "<br><br><hr>" + rows
  content += "</p>"
  return content
}

function isScheduledRun() {
  let t = String(($environment && $environment.executeType) || "")
  return t === "0" || t === "-1"
}

function isBackgroundRun(args) {
  return isScheduledRun() || isNetworkRun(args || parseArgs())
}

async function finish(cfg, action, selected, results, latency, args) {
  if (isBackgroundRun(args)) {
    // Healthy checks and successful last-good restoration stay quiet.
    // Uncertainty, confirmed failure and fallback/switch events notify.
    if (action.indexOf("仍安全") < 0 && action.indexOf("已恢复上次验证通过") < 0) {
      $notify("AI 安全节点 · " + cfg.name, action, selected || FAIL_CLOSED)
    }
    $done()
  } else {
    $done({
      title: "AI 安全节点 · " + cfg.name,
      htmlMessage: render(cfg, action, selected, results, latency)
    })
  }
}

;(async () => {
  let args = parseArgs()
  let provider = String(args.provider || "").toLowerCase()
  let cfg = PROVIDERS[provider]
  if (!cfg) throw new Error("missing or unsupported provider")

  let sticky = isStickyMode(args)

  if (isNetworkRun(args)) {
    if (!acquireNetworkRun(provider)) {
      $done()
      return
    }
    let delaySeconds = Number(args.delay || 5)
    if (!Number.isFinite(delaySeconds)) delaySeconds = 5
    delaySeconds = Math.max(0, Math.min(15, delaySeconds))
    await sleep(delaySeconds * 1000)
  }

  let policy = cfg.policy
  let current = await getCurrentLeaf(policy)
  let candidates = await getCandidates(policy)
  let lastGood = loadLastGood(provider)

  if (!candidates.length) {
    if (!sticky) {
      await setPolicy(policy, FAIL_CLOSED)
      await finish(cfg, "没有候选节点，已 fail-closed", FAIL_CLOSED, [], {}, args)
    } else {
      await finish(cfg, "没有候选节点，保留当前策略并提醒", current || FAIL_CLOSED, [], {}, args)
    }
    return
  }

  let currentResult = null
  let rememberedResult = null

  // Sticky routing: first re-check the currently selected real node.
  if (current && candidates.indexOf(current) >= 0) {
    currentResult = await testNode(provider, current)

    if (currentResult.status === "pass") {
      saveLastGood(provider, currentResult)
      await finish(cfg, "当前节点仍安全，保持不切换", current, [currentResult], {}, args)
      return
    }

    if (sticky && currentResult.status === "uncertain") {
      // A timeout/DNS/challenge immediately after wake is not proof that the
      // exit became unsafe. Keep the node selected and ask the user to retry.
      await finish(
        cfg,
        "当前节点暂时无法确认，保留原选择；网络稳定后将再次复核",
        current,
        [currentResult],
        {},
        args
      )
      return
    }

    if (!sticky) {
      // Legacy fail-closed mode: stop AI traffic before scanning alternatives.
      await setPolicy(policy, FAIL_CLOSED)
    }
  } else if (sticky && lastGood && candidates.indexOf(lastGood.node) >= 0) {
    // QX may come back from sleep/reload with the static policy on reject.
    // Test the persisted last-known-good leaf directly, then restore it.
    rememberedResult = await testNode(provider, lastGood.node)

    if (rememberedResult.status === "pass") {
      await setPolicy(policy, lastGood.node)
      saveLastGood(provider, rememberedResult)
      await finish(
        cfg,
        "已恢复上次验证通过的节点",
        lastGood.node,
        [rememberedResult],
        {},
        args
      )
      return
    }

    if (rememberedResult.status === "uncertain") {
      // Preserve continuity across transient network recovery. This node was
      // previously verified; restore it, but notify because this run could not
      // positively re-verify it.
      await setPolicy(policy, lastGood.node)
      await finish(
        cfg,
        "网络状态仍不确定，已恢复上次验证节点；请留意可用性",
        lastGood.node,
        [rememberedResult],
        {},
        args
      )
      return
    }
  }

  let excluded = {}
  if (currentResult) excluded[currentResult.node] = true
  if (rememberedResult) excluded[rememberedResult.node] = true

  let scanTargets = candidates.filter(x => !excluded[x])
  let results = await mapLimit(scanTargets, CONCURRENCY, node => testNode(provider, node))
  if (rememberedResult) results.unshift(rememberedResult)
  if (currentResult) results.unshift(currentResult)

  let safe = results.filter(x => x.status === "pass")
  if (!safe.length) {
    if (!sticky) {
      await setPolicy(policy, FAIL_CLOSED)
      await finish(cfg, "没有验证通过的节点，已 fail-closed", FAIL_CLOSED, results, {}, args)
      return
    }

    // Sticky recovery never converts a transient/confirmed outage into a
    // permanent reject if a real node is already selected. The user gets a
    // notification instead and can retry after the network settles.
    if (current && candidates.indexOf(current) >= 0) {
      await finish(cfg, "未找到可替代的验证节点，保留原选择并提醒", current, results, {}, args)
      return
    }

    // If QX is already on reject and the remembered node was explicitly FAIL,
    // keep reject rather than restoring a known-bad exit.
    await finish(cfg, "未找到验证通过的节点，当前保持 reject", FAIL_CLOSED, results, {}, args)
    return
  }

  let latency = await benchmark(safe.map(x => x.node))
  let stickyRegion = ""
  if (currentResult && currentResult.region) stickyRegion = currentResult.region
  else if (rememberedResult && rememberedResult.region) stickyRegion = rememberedResult.region
  else if (lastGood && lastGood.region) stickyRegion = lastGood.region

  let best = chooseBest(cfg, safe, latency, stickyRegion)

  await setPolicy(policy, best.node)
  saveLastGood(provider, best)
  await finish(cfg, "已切换到验证通过的安全节点", best.node, results, latency, args)
})().catch(async e => {
  let args = parseArgs()
  let provider = String(args.provider || "").toLowerCase()
  let cfg = PROVIDERS[provider] || { name: provider || "AI", policy: "" }
  let sticky = isStickyMode(args)

  if (!sticky) {
    try {
      if (cfg.policy) await setPolicy(cfg.policy, FAIL_CLOSED)
    } catch (_) {}
  }

  let selected = FAIL_CLOSED
  if (sticky && cfg.policy) {
    try {
      selected = (await getCurrentLeaf(cfg.policy)) || FAIL_CLOSED
    } catch (_) {}
  }

  if (isBackgroundRun(args)) {
    $notify(
      "AI 安全节点 · " + cfg.name,
      sticky ? "筛选脚本异常，已保留当前选择" : "筛选脚本异常，已尝试 fail-closed",
      String(e)
    )
    $done()
  } else {
    $done({
      title: "AI 安全节点 · " + cfg.name,
      htmlMessage: "<p style='font-family:-apple-system;font-size:large'>脚本异常：<br>" +
        escapeHtml(e) +
        "<br><br>" +
        (sticky
          ? "已保留当前策略：" + escapeHtml(selected)
          : "已尝试切换到 reject。") +
        "</p>"
    })
  }
})
