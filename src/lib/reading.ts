import type { DrawnCard, Spread } from '../types'

export interface ReadingRequest {
  question: string
  spread: Spread
  drawn: DrawnCard[]
  tone: string
}

/**
 * Streams the interpretation from the local proxy. Returns a cleanup-safe
 * async iterator yielding text chunks.
 */
export async function* streamReading(
  body: ReadingRequest,
  signal: AbortSignal,
): AsyncGenerator<string> {
  const res = await fetch('/api/reading', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: body.question,
      spreadId: body.spread.id,
      spreadName: body.spread.name,
      tone: body.tone,
      positions: body.spread.positions.map((p) => p.label),
      cards: body.drawn.map((d) => ({
        id: d.card.id,
        name: d.card.name,
        reversed: d.reversed,
      })),
    }),
    signal,
  })

  if (!res.ok || !res.body) {
    const message = await res.text().catch(() => '')
    throw new Error(message || `请求失败（${res.status}）`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    yield decoder.decode(value, { stream: true })
  }
}

/** Offline / no-API fallback: a readable composite built from the deck data. */
export function composeFallback(question: string, spread: Spread, drawn: DrawnCard[]): string {
  const lines: string[] = []
  const opening = question.trim()
    ? `关于「${question.trim()}」，牌面给出的不是判决，而是一张当下处境的地图。`
    : '这次没有具体的问题，牌面呈现的是你此刻的状态与方向。'
  lines.push(opening, '')
  lines.push(`**${spread.name}** · 整体叙事`, '')

  const tones = drawn.map((d) => (d.reversed ? '受阻' : '流动')).join('、')
  lines.push(
    `这组牌的能量整体是${tones}的。把牌放在一起看，它们指向的不是单一结论，而是几种同时存在的力量：有的在推你向前，有的在提醒你停下来确认方向。`,
    '',
  )

  drawn.forEach((d, i) => {
    const position = spread.positions[i]
    if (!position) return
    lines.push(`**${i + 1}. ${position.label} · ${d.card.name}${d.reversed ? '（逆位）' : '（正位）'}**`, '')
    lines.push(`关键词：${d.card.keywords.join('、')}`)
    lines.push('')
    lines.push(d.reversed ? d.card.reversed : d.card.upright, '')
  })

  lines.push('**给你的建议**', '')
  lines.push(
    '先不要急着做最终决定。从上面最触动你的那一张牌开始，问自己：它描述的状态，我在生活里的哪个具体场景中见过？塔罗的价值在于把模糊的感受说清楚，而不是替你选择。',
    '',
  )
  lines.push('_本次为离线解读（未连接 AI 服务）。牌义来自本地牌库，仅供自我觉察参考。_')
  return lines.join('\n')
}