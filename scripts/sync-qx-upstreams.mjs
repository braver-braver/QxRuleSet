/**
 * Sync vetted, domain-only upstream rules into reviewable Quantumult X lists.
 * Always regenerate from current manual rules; never replace a hand-maintained rule.
 * No external npm dependencies, eval, subprocesses or user credentials.
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const BEGIN = '# BEGIN QX-UPSTREAM-AUTO blackmatrix7 (do not edit)'
export const END = '# END QX-UPSTREAM-AUTO blackmatrix7'
const STATE_PATH = 'quantumultX/upstream-state.json'
const MANIFEST_PATH = 'quantumultX/upstreams.json'
const acceptedTypes = new Set(['HOST', 'HOST-SUFFIX'])
const upstreamPath = /^\/blackmatrix7\/ios_rule_script\/master\/rule\/QuantumultX\/([A-Za-z]+)\/([A-Za-z]+)\.list$/

export function validHostname(value) {
  if (typeof value !== 'string' || value.length > 253) return false
  const valueLower = value.toLowerCase()
  if (!/^[a-z0-9.-]+$/.test(valueLower) || valueLower.includes('..')) return false
  const labels = valueLower.split('.')
  if (labels.length < 2 || !/^[a-z]{2,63}$/.test(labels.at(-1))) return false
  return labels.every(label => label.length <= 63 &&
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))
}

export function parseDomainRule(line) {
  const parts = String(line).trim().split(',').map(part => part.trim())
  const kind = parts[0] ? parts[0].toUpperCase() : ''
  const domain = (parts[1] || '').toLowerCase()
  if (!acceptedTypes.has(kind) || parts.length < 2 || parts.length > 4 ||
      !validHostname(domain)) return null
  return { kind, domain, policy: parts[2] || '' }
}

export function parseDomainRules(text) {
  const seen = new Set()
  const rules = []
  for (const line of String(text).split(/\r?\n/)) {
    const rule = parseDomainRule(line)
    if (!rule) continue
    const key = rule.kind + ',' + rule.domain
    if (!seen.has(key)) { seen.add(key); rules.push(rule) }
  }
  return rules
}

export function stripManaged(content) {
  const source = String(content)
  const first = source.indexOf(BEGIN)
  const last = source.indexOf(END)
  if (first < 0 && last < 0) return source.trimEnd()
  if (first < 0 || last < first ||
      source.indexOf(BEGIN, first + BEGIN.length) >= 0 ||
      source.indexOf(END, last + END.length) >= 0) {
    throw new Error('Malformed or duplicated upstream managed markers')
  }
  return (source.slice(0, first).trimEnd() + '\n\n' +
    source.slice(last + END.length).trim()).trimEnd()
}

export function covers(existing, candidate) {
  if (existing.domain === candidate.domain) return true
  return existing.kind === 'HOST-SUFFIX' &&
    candidate.domain.endsWith('.' + existing.domain)
}

export function overlaps(a, b) {
  if (a.domain === b.domain) return true
  if (a.kind === 'HOST-SUFFIX' && b.domain.endsWith('.' + a.domain)) return true
  if (b.kind === 'HOST-SUFFIX' && a.domain.endsWith('.' + b.domain)) return true
  return false
}

function allowedDomain(domain, allowSuffixes) {
  return allowSuffixes.some(suffix =>
    domain === suffix || domain.endsWith('.' + suffix))
}

export function reconcileTarget(content, upstreamRules, entry, otherPolicies = []) {
  const base = stripManaged(content)
  const manual = parseDomainRules(base)
  const allowed = upstreamRules.filter(rule =>
    allowedDomain(rule.domain, entry.allowSuffixes))
  const managed = []
  const skippedConflict = []
  for (const rule of allowed) {
    if (manual.some(existing => covers(existing, rule))) continue
    const conflict = otherPolicies.some(existing =>
      existing.policy !== entry.policy && overlaps(existing, rule))
    if (conflict) { skippedConflict.push(rule.kind + ',' + rule.domain); continue }
    if (managed.some(existing => covers(existing, rule))) continue
    managed.push({ ...rule, policy: entry.policy })
  }
  managed.sort((a, b) =>
    a.domain.localeCompare(b.domain, 'en') || a.kind.localeCompare(b.kind, 'en'))
  if (!managed.length) {
    return { content: base + '\n', managed, skippedConflict, eligible: allowed.length }
  }
  const lines = managed.map(rule =>
    rule.kind + ',' + rule.domain + ',' + entry.policy)
  return {
    content: base + '\n\n' + BEGIN + '\n' + lines.join('\n') + '\n' + END + '\n',
    managed, skippedConflict, eligible: allowed.length
  }
}

function validateManifest(manifest) {
  if (!manifest || manifest.schema !== 1 || !Array.isArray(manifest.sources) ||
      manifest.sources.length < 1 || manifest.sources.length > 20) {
    throw new Error('Invalid or empty upstream manifest')
  }
  const names = new Set()
  const targets = new Set()
  for (const item of manifest.sources) {
    if (!item || !/^[A-Za-z]+$/.test(item.name || '') ||
        names.has(item.name) || !['sync', 'audit'].includes(item.mode) ||
        !Number.isSafeInteger(item.minRules) || item.minRules < 2) {
      throw new Error('Invalid source metadata')
    }
    names.add(item.name)
    let url
    try { url = new URL(item.url) } catch { throw new Error('Invalid upstream URL') }
    const match = url.pathname.match(upstreamPath)
    if (url.protocol !== 'https:' || url.hostname !== 'raw.githubusercontent.com' ||
        url.username || url.password || url.search || url.hash ||
        !match || match[1] !== item.name || match[2] !== item.name) {
      throw new Error('Upstream URL outside approved blackmatrix7 paths: ' + item.name)
    }
    if (item.mode === 'sync') {
      if (!/^quantumultX\/rules\/(ai|services)\/[a-z-]+\.list$/.test(item.target || '') ||
          targets.has(item.target) || typeof item.policy !== 'string' || !item.policy.trim() ||
          !Array.isArray(item.allowSuffixes) || item.allowSuffixes.length < 1 ||
          !item.allowSuffixes.every(validHostname)) {
        throw new Error('Invalid sync target or ownership allowlist: ' + item.name)
      }
      targets.add(item.target)
    }
  }
}

async function fetchText(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)
    try {
      const response = await fetch(url, {
        headers: { Accept: 'text/plain' }, redirect: 'error',
        signal: controller.signal
      })
      if (!response.ok) throw new Error('HTTP ' + response.status)
      const bytes = Number(response.headers.get('content-length') || 0)
      if (bytes > 2_000_000) throw new Error('Upstream too large')
      const text = await response.text()
      if (text.length > 2_000_000) throw new Error('Upstream too large')
      return text
    } catch (error) {
      if (attempt === 1) throw new Error('Cannot load ' + url + ': ' + error.message)
    } finally {
      clearTimeout(timer)
    }
  }
}

async function inventoryRules(root) {
  const rules = []
  for (const dir of ['quantumultX/rules/ai', 'quantumultX/rules/services']) {
    for (const name of await readdir(join(root, dir))) {
      if (!name.endsWith('.list')) continue
      const text = await readFile(join(root, dir, name), 'utf8')
      for (const rule of parseDomainRules(text)) {
        rules.push(rule)
      }
    }
  }
  return rules
}

export async function syncUpstreams({
  root = process.cwd(),
  manifestPath = MANIFEST_PATH,
  getSource = fetchText,
  apply = false
} = {}) {
  const manifest = JSON.parse(await readFile(join(root, manifestPath), 'utf8'))
  validateManifest(manifest)
  let previous = { schema: 1, sources: {} }
  try { previous = JSON.parse(await readFile(join(root, STATE_PATH), 'utf8')) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  if (!previous || previous.schema !== 1 ||
      !previous.sources || typeof previous.sources !== 'object') {
    throw new Error('Invalid previous upstream state')
  }

  const otherRules = await inventoryRules(root)
  const nextState = { schema: 1, sources: {} }
  const changes = []
  const summaries = []
  let totalManaged = 0

  // Calculate and validate every upstream before touching any output.
  for (const entry of manifest.sources) {
    const text = await getSource(entry.url)
    if (typeof text !== 'string' || text.length > 2_000_000 ||
        /^\s*</.test(text)) {
      throw new Error('Non-text or oversized upstream response: ' + entry.name)
    }
    const rules = parseDomainRules(text)
    if (rules.length < entry.minRules) {
      throw new Error('Upstream unexpectedly short: ' + entry.name + ' ' +
        rules.length + ' < ' + entry.minRules)
    }
    const digest = createHash('sha256').update(text).digest('hex')
    const changed = previous.sources[entry.name]?.sha256 !== digest
    let managed = 0
    let blocked = 0
    if (entry.mode === 'sync') {
      const path = join(root, entry.target)
      const existing = await readFile(path, 'utf8')
      const result = reconcileTarget(existing, rules, entry, otherRules)
      managed = result.managed.length
      blocked = result.skippedConflict.length
      if (managed > 80) throw new Error('Too many auto-managed rules for ' + entry.name)
      totalManaged += managed
      if (result.content !== existing) changes.push({ path: entry.target, content: result.content })
      for (const rule of result.managed) otherRules.push(rule)
    }
    nextState.sources[entry.name] = {
      sha256: digest, mode: entry.mode,
      domainRules: rules.length,
      managed, blocked
    }
    summaries.push({ name: entry.name, mode: entry.mode, sourceChanged: changed,
      domainRules: rules.length, managed, blocked })
  }
  if (totalManaged > 160) throw new Error('Total auto-managed rule safety cap exceeded')
  const nextStateText = JSON.stringify(nextState, null, 2) + '\n'
  let stateText = ''
  try { stateText = await readFile(join(root, STATE_PATH), 'utf8') }
  catch (error) { if (error.code !== 'ENOENT') throw error }
  if (stateText !== nextStateText) {
    changes.push({ path: STATE_PATH, content: nextStateText })
  }
  if (apply) {
    for (const change of changes) {
      await writeFile(join(root, change.path), change.content, 'utf8')
    }
  }

  const report = [
    '# Quantumult X 上游规则同步',
    '',
    '来源：blackmatrix7/ios_rule_script 的 Quantumult X 规则；仅域名、限定服务归属的候选进入自动管理区。',
    '大范围共享域名、关键词、IP/ASN、User-Agent 和高风险规则均不自动导入。',
    '',
    '| 来源 | 模式 | 上游域名规则 | 自动管理 | 跨策略冲突跳过 | 上游内容变化 |',
    '| --- | --- | ---: | ---: | ---: | --- |',
    ...summaries.map(item => '| ' + item.name + ' | ' +
      (item.mode === 'sync' ? '候选同步' : '仅审计') + ' | ' +
      item.domainRules + ' | ' + item.managed + ' | ' + item.blocked + ' | ' +
      (item.sourceChanged ? '是' : '否') + ' |'),
    '',
    '变更文件数：' + changes.length + '。所有变更须经 PR 审核；不会自动合并。',
    '请重点核查 GitHub Pages、Bilibili 视频 CDN、AI 独立策略和共享域名冲突。',
    '上游文件摘要只记录内容变化，不代表服务可用性或真实节点解锁。'
  ].join('\n') + '\n'
  return { changes, summaries, report }
}

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const reportIndex = args.indexOf('--report')
  if (args.some((arg, i) => !['--apply', '--report'].includes(arg) &&
      i !== reportIndex + 1)) {
    throw new Error('Usage: node scripts/sync-qx-upstreams.mjs [--apply] [--report path]')
  }
  if (reportIndex >= 0 && !args[reportIndex + 1]) throw new Error('--report requires a path')
  const result = await syncUpstreams({ apply })
  if (reportIndex >= 0) {
    await writeFile(resolve(args[reportIndex + 1]), result.report, 'utf8')
  }
  process.stdout.write(result.report)
  process.stdout.write('changed_files=' + result.changes.map(x => x.path).join(',') + '\n')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error); process.exitCode = 1 })
}
