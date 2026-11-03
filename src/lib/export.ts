import { jsPDF } from 'jspdf'
import type { DrawnCard } from '../types'

export interface ExportData {
  question: string
  spreadName: string
  positions: string[]
  drawn: DrawnCard[]
  reading: string
}

const W = 820
const PAD = 54
const CONTENT = W - PAD * 2
const SCALE = 2

const BG = '#0b0912'
const INK = '#ece6da'
const MUTED = '#a49bb0'
const FAINT = '#6f6880'
const GOLD = '#d4af6a'
const GOLD_BRIGHT = '#efd9a5'
const GOLD_DIM = 'rgba(212, 175, 106, 0.55)'
const LINE = 'rgba(212, 175, 106, 0.16)'
const LINE_STRONG = 'rgba(212, 175, 106, 0.32)'
const BODY = '#ded7cc'

const SERIF = '"Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", Georgia, serif'
const SANS = '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif'

const CARD_W = 124
const CARD_H = 207
const CARD_GAP = 14
const CARD_ROW_GAP = 18
const CAPTION_POS_H = 13
const CAPTION_NAME_H = 16

const BODY_SIZE = 14.5
const BODY_LH = 28
const BODY_GAP = 14

type InlineStyle = 'normal' | 'bold' | 'em'
interface Inline {
  text: string
  style: InlineStyle
}

interface BodyLine {
  y: number
  x: number
  segments: Inline[]
  bullet: boolean
}

interface CardBox {
  x: number
  y: number
  reversed: boolean
  name: string
  pos: string
}

interface Layout {
  height: number
  headLineY: number
  eyebrowY: number
  titleY: number
  questionY: number
  questionH: number
  cardsY: number
  cardsH: number
  bodyDividerY: number
  bodyLines: BodyLine[]
  bodyBottom: number
  footDividerY: number
  footY: number
  footLines: string[]
  cards: CardBox[]
}

function fontFor(style: InlineStyle): string {
  if (style === 'bold') return `600 ${BODY_SIZE}px ${SERIF}`
  if (style === 'em') return `400 12px ${SANS}`
  return `400 ${BODY_SIZE}px ${SERIF}`
}

function tokens(line: string): Inline[] {
  return line
    .split(/(\*\*[^*]+\*\*|_[^_]+_)/g)
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        return { text: part.slice(2, -2), style: 'bold' as const }
      }
      if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
        return { text: part.slice(1, -1), style: 'em' as const }
      }
      return { text: part, style: 'normal' as const }
    })
}

function cleanLine(line: string): string {
  return line
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\s*[•·]\s+/, '')
    .replace(/＊/g, '*')
}

function parseBlocks(text: string): { list: boolean; lines: string[] }[] {
  return text
    .replace(/＊/g, '*')
    .replace(/\n(?=\*\*[^*\n]+\*\*\s*$)/gm, '\n\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n').map(cleanLine)
      const list = lines.every((l) => /^- /.test(l))
      return { list, lines: list ? lines.map((l) => l.replace(/^- /, '')) : lines }
    })
}

function wrap(ctx: CanvasRenderingContext2D, segments: Inline[], maxWidth: number): Inline[][] {
  const lines: Inline[][] = []
  let line: Inline[] = []
  let width = 0

  for (const seg of segments) {
    ctx.font = fontFor(seg.style)
    let buf = ''
    for (const ch of Array.from(seg.text)) {
      const w = ctx.measureText(ch).width
      if (width + w > maxWidth && (buf || line.length > 0)) {
        if (buf) line.push({ text: buf, style: seg.style })
        lines.push(line)
        line = []
        width = 0
        buf = ''
        if (ch === ' ') continue
      }
      buf += ch
      width += w
    }
    if (buf) line.push({ text: buf, style: seg.style })
  }
  if (line.length) lines.push(line)
  return lines.filter((l) => l.some((s) => s.text.trim() !== ''))
}

function spacedWidth(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
  const chars = Array.from(text)
  let width = 0
  for (const ch of chars) width += ctx.measureText(ch).width + spacing
  return Math.max(0, width - spacing)
}

function drawSpaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  align: 'left' | 'right' | 'center' = 'left',
): void {
  ctx.textAlign = 'left'
  const width = spacedWidth(ctx, text, spacing)
  let cursor = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x
  for (const ch of Array.from(text)) {
    ctx.fillText(ch, cursor, y)
    cursor += ctx.measureText(ch).width + spacing
  }
}

function drawSegments(
  ctx: CanvasRenderingContext2D,
  segments: Inline[],
  x: number,
  y: number,
): void {
  ctx.textAlign = 'left'
  let cursor = x
  for (const seg of segments) {
    if (!seg.text) continue
    ctx.font = fontFor(seg.style)
    ctx.fillStyle = seg.style === 'bold' ? GOLD_BRIGHT : seg.style === 'em' ? FAINT : BODY
    ctx.fillText(seg.text, cursor, y)
    cursor += ctx.measureText(seg.text).width
  }
}

function buildLayout(ctx: CanvasRenderingContext2D, data: ExportData): Layout {
  const cards = data.drawn

  ctx.font = `15px ${SERIF}`
  const question = data.question.trim() ? `「${data.question.trim()}」` : '（没有写下具体问题）'
  const questionLines = wrap(ctx, tokens(question), CONTENT)
  const questionH = Math.max(1, questionLines.length) * 25

  const headLineY = PAD + 18 + 18
  const eyebrowY = headLineY + 32
  const titleY = eyebrowY + 15 + 10
  const questionY = titleY + 46 + 14
  const cardsY = questionY + questionH + 30

  const perRow = Math.max(1, Math.floor((CONTENT + CARD_GAP) / (CARD_W + CARD_GAP)))
  const rows = Math.ceil(cards.length / perRow)
  const cardBlockH = CARD_H + 8 + CAPTION_POS_H + 3 + CAPTION_NAME_H
  const cardsH = rows === 0 ? 0 : rows * cardBlockH + (rows - 1) * CARD_ROW_GAP

  const boxes: CardBox[] = []
  cards.forEach((entry, i) => {
    const row = Math.floor(i / perRow)
    const inRow = Math.min(perRow, cards.length - row * perRow)
    const rowW = inRow * CARD_W + (inRow - 1) * CARD_GAP
    const startX = PAD + (CONTENT - rowW) / 2
    const col = i - row * perRow
    boxes.push({
      x: startX + col * (CARD_W + CARD_GAP),
      y: cardsY + row * (cardBlockH + CARD_ROW_GAP),
      reversed: entry.reversed,
      name: entry.card.name,
      pos: data.positions[i] ?? `第 ${i + 1} 张`,
    })
  })

  const bodyDividerY = cardsY + cardsH + 34
  let y = bodyDividerY + 26

  const bodyLines: BodyLine[] = []
  for (const block of parseBlocks(data.reading)) {
    if (block.list) {
      for (const item of block.lines) {
        const lines = wrap(ctx, tokens(item), CONTENT - 22)
        lines.forEach((segments, i) => {
          bodyLines.push({ y, x: PAD + 22, segments, bullet: i === 0 })
          y += BODY_LH
        })
        y += 4
      }
      y += 8
    } else {
      for (const raw of block.lines) {
        const lines = wrap(ctx, tokens(raw), CONTENT)
        for (const segments of lines) {
          bodyLines.push({ y, x: PAD, segments, bullet: false })
          y += BODY_LH
        }
      }
      y += BODY_GAP
    }
  }

  const bodyBottom = Math.max(y - BODY_GAP, bodyDividerY + 26)
  const footDividerY = bodyBottom + 30
  const footY = footDividerY + 16

  ctx.font = `11px ${SERIF}`
  const footRaw = [
    '塔罗提供的是视角，不是判决，不替代医疗、法律或财务专业意见。',
    '牌面图像：Rider–Waite–Smith（1909），公有领域。',
  ]
  const footLines = footRaw.flatMap((line) => wrap(ctx, tokens(line), CONTENT).map((l) => l.map((s) => s.text).join('')))
  const height = footY + footLines.length * 19 + 40

  return {
    height,
    headLineY,
    eyebrowY,
    titleY,
    questionY,
    questionH,
    cardsY,
    cardsH,
    bodyDividerY,
    bodyLines,
    bodyBottom,
    footDividerY,
    footY,
    footLines,
    cards: boxes,
  }
}

function loadCardImage(path: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = path
  })
}

function hairline(ctx: CanvasRenderingContext2D, y: number, color: string): void {
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PAD, y + 0.5)
  ctx.lineTo(W - PAD, y + 0.5)
  ctx.stroke()
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function today(): string {
  return new Date().toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

interface RenderResult {
  canvas: HTMLCanvasElement
  error: string
  breaks: number[]
}

async function renderSheet(data: ExportData): Promise<RenderResult> {
  const images = await Promise.all(data.drawn.map((entry) => loadCardImage(`/cards/${entry.card.image}`)))

  const measure = document.createElement('canvas')
  const mctx = measure.getContext('2d')
  if (!mctx) throw new Error('无法创建画布')
  const layout = buildLayout(mctx, data)

  const canvas = document.createElement('canvas')
  canvas.width = W * SCALE
  canvas.height = Math.ceil(layout.height * SCALE)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布')
  ctx.scale(SCALE, SCALE)
  ctx.textBaseline = 'top'

  // background
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, W, layout.height)
  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, 520)
  glow.addColorStop(0, 'rgba(212, 175, 106, 0.075)')
  glow.addColorStop(1, 'rgba(212, 175, 106, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, 540)

  // head
  ctx.fillStyle = GOLD
  ctx.font = `400 14px ${SERIF}`
  drawSpaced(ctx, '镜中塔罗', PAD, PAD, 4.4)
  ctx.fillStyle = FAINT
  ctx.font = `400 12px ${SERIF}`
  drawSpaced(ctx, today(), W - PAD, PAD + 2, 0.8, 'right')
  hairline(ctx, layout.headLineY, LINE)

  // titles
  ctx.fillStyle = GOLD_DIM
  ctx.font = `400 11px ${SERIF}`
  drawSpaced(ctx, data.spreadName, PAD, layout.eyebrowY, 3.2)

  ctx.fillStyle = GOLD_BRIGHT
  ctx.font = `400 34px ${SERIF}`
  drawSpaced(ctx, '你的解读', PAD - 1, layout.titleY, 4.6)

  ctx.fillStyle = MUTED
  ctx.font = `400 15px ${SERIF}`
  const question = data.question.trim() ? `「${data.question.trim()}」` : '（没有写下具体问题）'
  let qy = layout.questionY
  for (const line of wrap(ctx, tokens(question), CONTENT)) {
    drawSegments(ctx, line, PAD, qy)
    qy += 25
  }

  // cards
  layout.cards.forEach((box, i) => {
    const img = images[i]
    const cy = box.y
    if (img) {
      ctx.save()
      roundRect(ctx, box.x, cy, CARD_W, CARD_H, 6)
      ctx.clip()
      if (box.reversed) {
        ctx.translate(box.x + CARD_W / 2, cy + CARD_H / 2)
        ctx.rotate(Math.PI)
        ctx.drawImage(img, -CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H)
      } else {
        ctx.drawImage(img, box.x, cy, CARD_W, CARD_H)
      }
      ctx.restore()
      ctx.strokeStyle = LINE_STRONG
      ctx.lineWidth = 1
      roundRect(ctx, box.x + 0.5, cy + 0.5, CARD_W - 1, CARD_H - 1, 6)
      ctx.stroke()
    } else {
      ctx.fillStyle = '#17142a'
      roundRect(ctx, box.x, cy, CARD_W, CARD_H, 6)
      ctx.fill()
      ctx.fillStyle = GOLD
      ctx.font = `400 18px ${SERIF}`
      ctx.textAlign = 'center'
      ctx.fillText('✦', box.x + CARD_W / 2, cy + CARD_H / 2 - 9)
      ctx.textAlign = 'left'
    }

    ctx.fillStyle = GOLD_DIM
    ctx.font = `400 10.5px ${SERIF}`
    ctx.textAlign = 'center'
    drawSpaced(ctx, box.pos, box.x + CARD_W / 2, cy + CARD_H + 8, 1.2, 'center')
    ctx.fillStyle = INK
    ctx.font = `400 12px ${SERIF}`
    ctx.textAlign = 'center'
    const name = box.reversed ? `${box.name} · 逆` : box.name
    ctx.fillText(name, box.x + CARD_W / 2, cy + CARD_H + 8 + CAPTION_POS_H + 3)
    ctx.textAlign = 'left'
  })

  // body
  hairline(ctx, layout.bodyDividerY, LINE)
  for (const line of layout.bodyLines) {
    if (line.bullet) {
      ctx.fillStyle = GOLD_DIM
      ctx.font = `400 ${BODY_SIZE}px ${SERIF}`
      ctx.fillText('·', PAD + 6, line.y)
    }
    drawSegments(ctx, line.segments, line.x, line.y)
  }

  // foot
  hairline(ctx, layout.footDividerY, LINE)
  ctx.fillStyle = FAINT
  ctx.font = `400 11px ${SERIF}`
  layout.footLines.forEach((line, i) => {
    ctx.fillText(line, PAD, layout.footY + i * 19)
  })

  const error = images.every(Boolean)
    ? ''
    : '部分牌面图像未能加载，已用占位符代替。'

  const cardRows = Array.from(new Set(layout.cards.map((box) => box.y)))
  const breaks = [
    ...cardRows.map((y) => y - 8),
    ...layout.bodyLines.map((line) => line.y - 8),
  ]
    .map((y) => Math.round(y * SCALE))
    .filter((y) => y > 0 && y < canvas.height)
    .sort((a, b) => a - b)

  return { canvas, error, breaks }
}

function two(n: number): string {
  return String(n).padStart(2, '0')
}

function stamp(): string {
  const d = new Date()
  return `${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}`
}

function download(url: string, filename: string): void {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export async function exportSheetAsImage(data: ExportData): Promise<string> {
  const { canvas, error } = await renderSheet(data)
  download(canvas.toDataURL('image/png'), `镜中塔罗-${stamp()}.png`)
  return error
}

export async function exportSheetAsPdf(data: ExportData): Promise<string> {
  const { canvas, error, breaks } = await renderSheet(data)

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 28
  const usableW = pageW - margin * 2
  const usableH = pageH - margin * 2

  const scale = usableW / canvas.width
  const sliceHeight = Math.max(1, Math.floor(usableH / scale))

  let offset = 0
  let page = 0
  while (offset < canvas.height) {
    let end = Math.min(canvas.height, offset + sliceHeight)
    if (end < canvas.height) {
      const lowest = offset + Math.floor(sliceHeight * 0.62)
      const candidates = breaks.filter((y) => y > lowest && y <= end)
      if (candidates.length) end = candidates[candidates.length - 1]
    }
    const height = end - offset
    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = height
    const ctx = slice.getContext('2d')
    if (!ctx) throw new Error('无法创建画布')
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, slice.width, slice.height)
    ctx.drawImage(canvas, 0, offset, canvas.width, height, 0, 0, canvas.width, height)

    if (page > 0) pdf.addPage()
    pdf.addImage(
      slice.toDataURL('image/jpeg', 0.92),
      'JPEG',
      margin,
      margin,
      usableW,
      height * scale,
      undefined,
      'FAST',
    )

    offset += height
    page += 1
  }

  pdf.save(`镜中塔罗-${stamp()}.pdf`)
  return error
}