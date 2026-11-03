import { useState } from 'react'
import { Check, Copy, Download, FileText, Loader2, RotateCcw, Sparkles } from 'lucide-react'
import type { DrawnCard, Spread } from '../types'
import { RichText } from './RichText'

type Status = 'streaming' | 'done' | 'fallback'

interface Props {
  question: string
  spread: Spread
  drawn: DrawnCard[]
  reading: string
  status: Status
  error: string
  onRestart: () => void
  onRetry: () => void
}

export function ReadingScreen({
  question,
  spread,
  drawn,
  reading,
  status,
  error,
  onRestart,
  onRetry,
}: Props) {
  const [copied, setCopied] = useState(false)
  const [exporting, setExporting] = useState<'png' | 'pdf' | ''>('')
  const [exportError, setExportError] = useState('')

  const canExport = Boolean(reading) && status !== 'streaming' && exporting === ''

  const runExport = async (kind: 'png' | 'pdf') => {
    if (!canExport) return
    setExporting(kind)
    setExportError('')
    try {
      const exporter = await import('../lib/export')
      const data = {
        question,
        spreadName: spread.name,
        positions: spread.positions.map((p) => p.label),
        drawn,
        reading,
      }
      const warning =
        kind === 'png'
          ? await exporter.exportSheetAsImage(data)
          : await exporter.exportSheetAsPdf(data)
      if (warning) setExportError(warning)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : '导出失败，请重试')
    } finally {
      setExporting('')
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reading)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div>
      <div className="reading-top">
        <div>
          <p className="eyebrow">{spread.name}</p>
          <h2 className="board-title" style={{ marginTop: 6 }}>
            你的解读
          </h2>
          <p className="reading-question">
            {question.trim() ? `「${question.trim()}」` : <span className="none">没有写下具体问题</span>}
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onRestart}>
          <RotateCcw size={14} strokeWidth={1.6} />
          重新占卜
        </button>
      </div>

      <div className="reading-grid">
        <div className="cards-summary">
          {drawn.map((entry, i) => {
            const position = spread.positions[i]
            return (
              <div className="mini-card" key={i}>
                <div className="mini-frame">
                  <img
                    src={`/cards/${entry.card.image}`}
                    alt={entry.card.name}
                    className={entry.reversed ? 'is-reversed' : undefined}
                  />
                </div>
                <div className="mini-label">{position?.label ?? `第 ${i + 1} 张`}</div>
                <div className="mini-name">
                  {entry.card.name}
                  {entry.reversed ? ' · 逆' : ''}
                </div>
              </div>
            )
          })}
        </div>

        <div>
          <div className="status-line">
            {status === 'streaming' ? (
              <>
                <span className="dot" />
                正在解读牌面…
              </>
            ) : status === 'fallback' ? (
              <>
                <Sparkles size={12} strokeWidth={1.6} />
                本地牌义解读
              </>
            ) : (
              <>
                <Check size={12} strokeWidth={1.8} />
                解读完成
              </>
            )}
          </div>

          {error && <div className="notice">{error}</div>}

          <div className="interpretation">
            {reading ? (
              <RichText text={reading} streaming={status === 'streaming'} />
            ) : status === 'streaming' ? (
              <p className="reading-empty">牌面正在展开，让答案慢慢浮现…</p>
            ) : null}
          </div>

          <div className="reading-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={copy} disabled={!reading}>
              {copied ? <Check size={14} strokeWidth={1.8} /> : <Copy size={14} strokeWidth={1.6} />}
              {copied ? '已复制' : '复制解读'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => runExport('png')}
              disabled={!canExport}
            >
              {exporting === 'png' ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <Download size={14} strokeWidth={1.6} />
              )}
              导出图片
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => runExport('pdf')}
              disabled={!canExport}
            >
              {exporting === 'pdf' ? (
                <Loader2 size={14} className="spin" />
              ) : (
                <FileText size={14} strokeWidth={1.6} />
              )}
              导出 PDF
            </button>
            {status === 'fallback' && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={onRetry}>
                重试 AI 解读
              </button>
            )}
          </div>

          {exportError && <p className="export-error">{exportError}</p>}
        </div>
      </div>

      <p className="footnote">
        塔罗提供的是视角，不是判决。它不替代医疗、法律或财务专业意见。
        <br />
        牌面图像：Rider–Waite–Smith（1909），公有领域。
      </p>
    </div>
  )
}