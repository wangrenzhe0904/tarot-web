import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

dotenv.config({ path: path.join(ROOT, '.env') })

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/**
 * Optional convenience: when LLM_API_KEY is not set locally, borrow credentials
 * from the sibling Vibe-Trading project. Set FALLBACK_ENV_PATH to override.
 */
function readFallbackEnv() {
  const fallbackPath = process.env.FALLBACK_ENV_PATH
    ? path.resolve(process.env.FALLBACK_ENV_PATH)
    : path.resolve(ROOT, '../Vibe-Trading-main/agent/.env')
  try {
    return dotenv.parse(fs.readFileSync(fallbackPath))
  } catch {
    return {}
  }
}

const fallbackEnv = readFallbackEnv()

// Gateway overrides saved from the in-app settings panel. `.env` stays the
// source of defaults; anything here wins over it.
const SETTINGS_PATH = path.join(ROOT, '.data', 'settings.json')

function readSettings() {
  try {
    const parsed = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'))
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

let overrides = readSettings()

const envKey = process.env.LLM_API_KEY || fallbackEnv.OPENAI_API_KEY || ''
const envBase = process.env.LLM_BASE_URL || fallbackEnv.OPENAI_BASE_URL || ''
const envModel = process.env.LLM_MODEL || fallbackEnv.LANGCHAIN_MODEL_NAME || 'gpt-4o-mini'

/**
 * Accept either ".../v1" or a bare host. The sibling project stores the
 * Anthropic-protocol variant (".../anthropic"), which is not the OpenAI route
 * this server uses, so strip that suffix when falling back.
 */
function normalizeBaseUrl(raw) {
  let base = (raw || '').trim().replace(/\/+$/, '')
  if (!base) return ''
  base = base.replace(/\/anthropic$/, '')
  return /\/v1$/.test(base) ? base : `${base}/v1`
}

function llmConfig() {
  const rawBase = overrides.baseUrl || envBase
  const base = normalizeBaseUrl(rawBase)
  const apiKey = overrides.apiKey ?? envKey
  return {
    baseUrl: rawBase,
    endpoint: base ? `${base}/chat/completions` : '',
    apiKey,
    model: overrides.model || envModel,
    configured: Boolean(apiKey && base),
    keySource: overrides.apiKey ? 'settings' : envKey ? 'env' : 'none',
  }
}

function settingsSummary() {
  const c = llmConfig()
  return {
    baseUrl: c.baseUrl,
    model: c.model,
    hasKey: Boolean(c.apiKey),
    keyHint: c.apiKey ? `${c.apiKey.slice(0, 3)}…${c.apiKey.slice(-4)}` : '',
    keySource: c.keySource,
    configured: c.configured,
  }
}

function writeSettings(next) {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true })
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2))
}

// ---------------------------------------------------------------------------
// Model discovery
// ---------------------------------------------------------------------------

/**
 * Gateways usually expose GET /models. The corporate gateway this app was
 * built against does not, so fall back to probing a short list of common
 * OpenAI-compatible model IDs with a one-token request. Results are cached in
 * `.data/models.json` and refreshed only when the user asks.
 */
const MODEL_CANDIDATES = [
  'glm-5',
  'glm-4.6',
  'glm-4.5',
  'glm-4.5-air',
  'glm-4-plus',
  'deepseek-chat',
  'deepseek-reasoner',
  'qwen-max',
  'qwen-plus',
  'qwen-turbo',
  'qwen3-max',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-5',
  'claude-sonnet-4-5',
  'claude-opus-4-5',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'moonshot-v1-8k',
  'kimi-k2-0905-preview',
]

const MODELS_CACHE_PATH = path.join(ROOT, '.data', 'models.json')

function readModelsCache() {
  try {
    const parsed = JSON.parse(fs.readFileSync(MODELS_CACHE_PATH, 'utf8'))
    if (parsed && Array.isArray(parsed.models)) {
      return {
        baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : '',
        models: parsed.models.filter((id) => typeof id === 'string' && id.trim()),
        checkedAt: typeof parsed.checkedAt === 'string' ? parsed.checkedAt : '',
      }
    }
  } catch {
    /* no cache yet */
  }
  return { baseUrl: '', models: [], checkedAt: '' }
}

function writeModelsCache(cache) {
  try {
    fs.mkdirSync(path.dirname(MODELS_CACHE_PATH), { recursive: true })
    fs.writeFileSync(MODELS_CACHE_PATH, JSON.stringify(cache, null, 2))
  } catch (error) {
    console.error('[models] cache write failed:', error?.message)
  }
}

async function fetchModelList(cfg) {
  if (!cfg.baseUrl || !cfg.apiKey) return null
  const base = normalizeBaseUrl(cfg.baseUrl)
  if (!base) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)
  try {
    const res = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${cfg.apiKey}` },
      signal: controller.signal,
    })
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    const raw = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : []
    const ids = raw
      .map((item) => (typeof item === 'string' ? item : item?.id))
      .filter((id) => typeof id === 'string' && id.trim())
    return ids.length ? [...new Set(ids.map((id) => id.trim()))].sort() : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function probeModel(cfg, model) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8_000)
  try {
    const res = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
      }),
      signal: controller.signal,
    })
    await res.text().catch(() => '')
    return res.status
  } catch {
    return 0
  } finally {
    clearTimeout(timer)
  }
}

async function discoverModels(cfg) {
  if (!cfg.configured) {
    return { models: [], source: 'none', message: '还没有可用的网关地址或密钥。' }
  }

  const listed = await fetchModelList(cfg)
  if (listed) {
    return { models: listed, source: 'list', message: `已从网关读取 ${listed.length} 个模型。` }
  }

  const queue = [...MODEL_CANDIDATES]
  if (cfg.model && !queue.includes(cfg.model)) queue.unshift(cfg.model)
  const models = new Set()
  let authFailed = false
  let probes = 0

  const worker = async () => {
    while (queue.length && !authFailed) {
      const model = queue.shift()
      if (!model) continue
      probes += 1
      const status = await probeModel(cfg, model)
      if (status === 401 || status === 403) {
        authFailed = true
        return
      }
      // Some gateways reject max_tokens on reasoning models; treat any
      // non-auth success as "this model exists and answered".
      if (status >= 200 && status < 300) models.add(model)
    }
  }

  await Promise.all(Array.from({ length: 5 }, worker))

  if (authFailed) {
    return { models: [], source: 'probe', message: '鉴权失败：密钥无效，或没有读取模型的权限。' }
  }

  const sorted = [...models].sort()
  return {
    models: sorted,
    source: 'probe',
    message: sorted.length
      ? `探测到 ${sorted.length} 个可用模型。`
      : `探测了 ${probes} 个常用模型，均未响应；仍可手动填写。`,
  }
}

const TONES = {
  gentle: '温柔陪伴：先接住提问者的情绪，再给视角。少用命令句，多用邀请式的表达。',
  honest: '冷静直白：不回避不舒适的部分，先给判断，再解释理由。保持善意，但不美化。',
  mystic: '诗意神秘：多用意象与隐喻，允许留白；但不要装神弄鬼、制造恐惧或故弄玄虚。',
  practical: '务实理性：结构清晰，优先给出可执行的行动与判断依据，少用抽象抒情。',
}

// ---------------------------------------------------------------------------
// Deck & spreads (single source of truth shared with the frontend)
// ---------------------------------------------------------------------------

const CARD_MAP = new Map()
for (const file of ['major', 'wands', 'cups', 'swords', 'pentacles']) {
  const cards = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared/cards', `${file}.json`), 'utf8'))
  for (const card of cards) CARD_MAP.set(card.id, card)
}
const SPREADS = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared/spreads.json'), 'utf8'))
const SPREAD_MAP = new Map(SPREADS.map((s) => [s.id, s]))

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

function buildMessages({ question, spread, positions, cards, tone = 'honest' }) {
  const cardLines = cards
    .map((entry, i) => {
      const card = CARD_MAP.get(entry.id)
      const orientation = entry.reversed ? '逆位' : '正位'
      return `${i + 1}. 位置「${positions[i]}」— ${card.name}（${card.nameEn}，${orientation}）`
    })
    .join('\n')

  const depth =
    cards.length === 1
      ? '篇幅 350–500 字，深入而克制。'
      : cards.length >= 8
        ? '篇幅 900–1200 字。'
        : '篇幅 550–800 字。'

  const system = [
    '你是一位冷静、诚实、经验丰富的塔罗读者。你不装神弄鬼，也不说放之四海而皆准的空话。',
    '你把塔罗当作一面镜子：它帮助提问者看清自己已经知道但不愿承认的东西，而不是替他做决定。',
    '你像一位值得信任的长辈，而不是客服。你的语气由下面的【语气】要求决定。',
    '',
    '写作要求：',
    '1. 只能解读系统给出的牌，绝不虚构、替换、增加或遗漏任何一张牌，也不要杜撰牌阵之外的牌。',
    '2. 开头用 2–3 句话给出整体叙事：这组牌放在一起，讲的是一个什么样的故事。',
    '3. 然后逐张解读，必须结合「位置含义 + 正/逆位 + 提问者的具体问题」，不要只复述通用牌义。',
    '4. 指出牌与牌之间的呼应、张力或矛盾，这是读牌最重要的部分。',
    '5. 结尾给出 2–3 条具体、可执行的建议，让提问者知道接下来可以做什么。',
    '6. 不预言确定的未来。用「这股能量倾向于……」「如果你继续……可能会……」这类表达，强调选择与能动性。',
    '7. 避免巴纳姆式套话（如「你有时外向有时内向」「你最近有些焦虑」），每句话都要对得起抽到的牌。',
    '8. 使用 Markdown 的 **加粗** 做小标题，不要使用代码块、表格或一级标题。',
    depth,
  ].join('\n')

  const user = [
    `【牌阵】${spread.name}（${cards.length} 张）`,
    `【提问】${question ? question : '（提问者没有写下具体问题，请围绕他当下的整体状态展开）'}`,
    '',
    '【抽到的牌（系统已随机抽取，不可更改）】',
    cardLines,
    '',
    '请按上述要求完成解读。',
  ].join('\n')

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const app = express()
app.use(express.json({ limit: '32kb' }))

// Lightweight in-memory rate limit: 12 readings per IP per minute.
const hits = new Map()
function rateLimited(ip) {
  const now = Date.now()
  const entry = hits.get(ip)
  if (!entry || now - entry.start > 60_000) {
    hits.set(ip, { start: now, count: 1 })
    return false
  }
  entry.count += 1
  return entry.count > 12
}

app.get('/api/health', (_req, res) => {
  const c = llmConfig()
  res.json({
    configured: c.configured,
    deck: CARD_MAP.size,
    spreads: SPREADS.length,
    model: c.model,
  })
})

app.get('/api/settings', (_req, res) => {
  res.json(settingsSummary())
})

app.post('/api/settings', (req, res) => {
  const { baseUrl, model, apiKey, clearKey } = req.body ?? {}
  const next = { ...overrides }

  if (baseUrl !== undefined) {
    if (typeof baseUrl !== 'string' || baseUrl.length > 300) {
      return res.status(400).json({ error: '网关地址格式不正确。' })
    }
    const trimmed = baseUrl.trim()
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      return res.status(400).json({ error: '网关地址需要以 http:// 或 https:// 开头。' })
    }
    if (trimmed) next.baseUrl = trimmed
    else delete next.baseUrl
  }

  if (model !== undefined) {
    if (typeof model !== 'string' || model.trim().length > 120) {
      return res.status(400).json({ error: '模型名不能超过 120 个字符。' })
    }
    if (model.trim()) next.model = model.trim()
    else delete next.model
  }

  if (clearKey === true) {
    delete next.apiKey
  } else if (typeof apiKey === 'string' && apiKey.trim()) {
    if (apiKey.trim().length > 500) {
      return res.status(400).json({ error: '密钥过长。' })
    }
    next.apiKey = apiKey.trim()
  }

  try {
    writeSettings(next)
  } catch (error) {
    console.error('[settings] write failed:', error?.message)
    return res.status(500).json({ error: '保存失败，请检查服务端目录权限。' })
  }
  overrides = next
  res.json(settingsSummary())
})

app.get('/api/settings/models', (_req, res) => {
  const c = llmConfig()
  const cache = readModelsCache()
  const matching = cache.baseUrl === c.baseUrl
  res.json({
    models: matching ? cache.models : [],
    checkedAt: matching ? cache.checkedAt : '',
    configured: c.configured,
  })
})

app.post('/api/settings/models', async (req, res) => {
  const { baseUrl, model, apiKey } = req.body ?? {}
  const saved = llmConfig()

  let nextBase = saved.baseUrl
  if (typeof baseUrl === 'string' && baseUrl.trim()) {
    if (baseUrl.length > 300) return res.status(400).json({ error: '网关地址格式不正确。' })
    nextBase = baseUrl.trim()
  }

  let nextKey = saved.apiKey
  if (typeof apiKey === 'string' && apiKey.trim()) {
    if (apiKey.trim().length > 500) return res.status(400).json({ error: '密钥过长。' })
    nextKey = apiKey.trim()
  }

  let nextModel = saved.model
  if (typeof model === 'string' && model.trim()) {
    if (model.trim().length > 120) return res.status(400).json({ error: '模型名不能超过 120 个字符。' })
    nextModel = model.trim()
  }

  const base = normalizeBaseUrl(nextBase)
  const cfg = {
    baseUrl: nextBase,
    endpoint: base ? `${base}/chat/completions` : '',
    apiKey: nextKey,
    model: nextModel,
    configured: Boolean(base && nextKey),
  }

  try {
    const result = await discoverModels(cfg)
    if (result.models.length) {
      writeModelsCache({
        baseUrl: nextBase,
        models: result.models,
        checkedAt: new Date().toISOString(),
        source: result.source,
      })
    }
    res.json({ ok: result.models.length > 0, ...result, configured: cfg.configured })
  } catch (error) {
    console.error('[models] discovery failed:', error?.message)
    res.json({ ok: false, models: [], message: '读取模型列表失败，仍可手动填写。' })
  }
})

app.post('/api/settings/test', async (_req, res) => {
  const c = llmConfig()
  if (!c.configured) {
    return res.json({ ok: false, message: '还没有可用的网关地址或密钥。' })
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const upstream = await fetch(c.endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${c.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: c.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false,
      }),
      signal: controller.signal,
    })
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '')
      console.error(`[settings] test ${upstream.status} ${detail.slice(0, 200)}`)
      return res.json({
        ok: false,
        message:
          upstream.status === 401
            ? '鉴权失败：密钥无效或没有该模型的权限。'
            : `上游返回 ${upstream.status}。`,
      })
    }
    await upstream.json().catch(() => null)
    return res.json({ ok: true, message: `连接正常 · ${c.model}` })
  } catch (error) {
    return res.json({
      ok: false,
      message:
        error?.name === 'AbortError'
          ? '连接超时（15 秒）。'
          : `连接失败：${error?.message || '未知错误'}`,
    })
  } finally {
    clearTimeout(timer)
  }
})

app.post('/api/reading', async (req, res) => {
  const ip = req.ip || 'unknown'
  if (rateLimited(ip)) {
    return res.status(429).json({ error: '慢一点，牌也需要呼吸。请一分钟后再试。' })
  }

  const { question = '', spreadId, positions, cards, tone = 'honest' } = req.body ?? {}
  const spread = SPREAD_MAP.get(spreadId)

  if (!spread || !Array.isArray(cards) || cards.length !== spread.count) {
    return res.status(400).json({ error: '牌阵或牌数不正确。' })
  }
  if (!Array.isArray(positions) || positions.length !== cards.length) {
    return res.status(400).json({ error: '位置信息不完整。' })
  }
  if (typeof question !== 'string' || question.length > 160) {
    return res.status(400).json({ error: '问题请控制在 160 字以内。' })
  }

  const cleanCards = cards.map((entry) => {
    const card = CARD_MAP.get(entry?.id)
    if (!card) return null
    return { id: card.id, reversed: Boolean(entry.reversed) }
  })
  if (cleanCards.some((c) => c === null)) {
    return res.status(400).json({ error: '存在未知的牌。' })
  }

  const cfg = llmConfig()
  if (!cfg.configured) {
    return res.status(503).json({ error: 'NO_KEY' })
  }

  const messages = buildMessages({
    question: question.trim(),
    spread,
    positions: spread.positions.map((p) => p.label),
    cards: cleanCards,
    tone: Object.hasOwn(TONES, tone) ? tone : 'honest',
  })

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 90_000)
  // `req` emits "close" as soon as its body is consumed; use the response
  // instead so an aborted client actually cancels the upstream call.
  const onClose = () => {
    if (!res.writableEnded) controller.abort()
  }
  res.on('close', onClose)

  try {
    const upstream = await fetch(cfg.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: 0.85,
        max_tokens: 2000,
        stream: true,
      }),
      signal: controller.signal,
    })

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => '')
      console.error(`[llm] ${upstream.status} ${detail.slice(0, 300)}`)
      return res.status(502).json({
        error:
          upstream.status === 401
            ? 'AI 服务鉴权失败，请检查 LLM_API_KEY。'
            : 'AI 服务暂时不可用，已为你切换到本地牌义解读。',
      })
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('X-Accel-Buffering', 'no')

    const decoder = new TextDecoder()
    let buffer = ''

    for await (const chunk of upstream.body) {
      buffer += decoder.decode(chunk, { stream: true })
      let newline = buffer.indexOf('\n')
      while (newline >= 0) {
        const line = buffer.slice(0, newline).trim()
        buffer = buffer.slice(newline + 1)
        newline = buffer.indexOf('\n')
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (!payload) continue
        if (payload === '[DONE]') {
          res.end()
          return
        }
        try {
          const json = JSON.parse(payload)
          const delta = json.choices?.[0]?.delta?.content
          if (delta) res.write(delta)
        } catch {
          /* ignore keep-alive or partial frames */
        }
      }
    }
    res.end()
  } catch (error) {
    clearTimeout(timeout)
    res.off('close', onClose)
    if (res.headersSent) {
      res.end()
      return
    }
    if (error?.name === 'AbortError') {
      return res.status(504).json({ error: 'AI 响应超时，请重试。' })
    }
    console.error('[llm] request failed:', error?.message)
    return res.status(502).json({ error: '连接 AI 服务失败，已为你切换到本地牌义解读。' })
  } finally {
    clearTimeout(timeout)
    res.off('close', onClose)
  }
})

// Serve the built frontend when it exists (pnpm build && pnpm start).
const distDir = path.join(ROOT, 'dist')
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')))
}

const PORT = Number(process.env.PORT) || 8787
app.listen(PORT, () => {
  console.log(
    `[tarot] api on http://localhost:${PORT} | AI ${llmConfig().configured ? 'enabled' : 'disabled (fallback mode)'}`,
  )
})