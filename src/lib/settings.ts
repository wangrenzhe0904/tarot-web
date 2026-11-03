export const TONES = [
  { id: 'gentle', label: '温柔', desc: '先接住情绪，再给视角' },
  { id: 'honest', label: '直白', desc: '不回避，先给判断' },
  { id: 'mystic', label: '诗意', desc: '意象与隐喻，克制不装神' },
  { id: 'practical', label: '务实', desc: '结构与可执行的建议' },
] as const

export type Tone = (typeof TONES)[number]['id']

const TONE_KEY = 'mirror-tarot.tone.v1'

export function loadTone(): Tone {
  try {
    const raw = localStorage.getItem(TONE_KEY)
    return TONES.some((t) => t.id === raw) ? (raw as Tone) : 'honest'
  } catch {
    return 'honest'
  }
}

export function saveTone(tone: Tone): void {
  try {
    localStorage.setItem(TONE_KEY, tone)
  } catch {
    /* ignore */
  }
}

export interface GatewaySettings {
  baseUrl: string
  model: string
  hasKey: boolean
  keyHint: string
  keySource: 'settings' | 'env' | 'none'
  configured: boolean
}

export async function fetchGatewaySettings(): Promise<GatewaySettings> {
  const res = await fetch('/api/settings')
  if (!res.ok) throw new Error(`无法读取设置（${res.status}）`)
  return res.json()
}

export async function saveGatewaySettings(input: {
  baseUrl: string
  model: string
  apiKey?: string
  clearKey?: boolean
}): Promise<GatewaySettings> {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `保存失败（${res.status}）`)
  return data
}

export interface ModelOptions {
  models: string[]
  checkedAt: string
  configured: boolean
}

export async function fetchModelOptions(): Promise<ModelOptions> {
  const res = await fetch('/api/settings/models')
  if (!res.ok) throw new Error(`无法读取模型列表（${res.status}）`)
  return res.json()
}

export interface ModelDiscovery {
  ok: boolean
  models: string[]
  message: string
  configured?: boolean
}

export async function discoverModelOptions(input: {
  baseUrl?: string
  model?: string
  apiKey?: string
}): Promise<ModelDiscovery> {
  const res = await fetch('/api/settings/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `读取模型列表失败（${res.status}）`)
  return data
}

export async function testGateway(): Promise<{ ok: boolean; message: string }> {
  const res = await fetch('/api/settings/test', { method: 'POST' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `测试失败（${res.status}）`)
  return data
}