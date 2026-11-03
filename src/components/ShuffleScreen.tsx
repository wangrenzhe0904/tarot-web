import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Shuffle } from 'lucide-react'
import type { Spread } from '../types'

interface Props {
  spread: Spread
  onReady: (cutPile: number) => void
}

type ShuffleState = 'idle' | 'shuffling' | 'cut'

export function ShuffleScreen({ spread, onReady }: Props) {
  const [state, setState] = useState<ShuffleState>('idle')
  const [pile, setPile] = useState<number | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(timer.current), [])

  const shuffle = () => {
    window.clearTimeout(timer.current)
    setPile(null)
    setState('shuffling')
    timer.current = window.setTimeout(() => setState('cut'), 1600)
  }

  return (
    <div className="shuffle-stage">
      <p className="eyebrow">Shuffle · {spread.name}</p>
      <h2 className="shuffle-title">
        {state === 'idle' && '把问题放在心里'}
        {state === 'shuffling' && '正在洗牌…'}
        {state === 'cut' && '切牌'}
      </h2>
      <p className="shuffle-sub">
        {state === 'idle' && '没有唯一正确的洗牌方式。轻触牌堆，让注意力回到那个问题上。'}
        {state === 'shuffling' && '深呼吸，不必急着得到答案。'}
        {state === 'cut' && '牌已洗好。把它分成三叠，凭直觉选一叠放在最上面——这一步由你来决定。'}
      </p>

      {state !== 'cut' ? (
        <div
          className={`deck-stack${state === 'shuffling' ? ' shuffling' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="洗牌"
          onClick={shuffle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              shuffle()
            }
          }}
        >
          <div className="stack-card" style={{ transform: 'rotate(-5deg) translateY(4px)' }} />
          <div className="stack-card" style={{ transform: 'rotate(3deg) translateY(-2px)' }} />
          <div className="stack-card" style={{ transform: 'rotate(-1deg)' }} />
        </div>
      ) : (
        <div className="cut-piles" role="group" aria-label="切牌：选择一叠">
          {[0, 1, 2].map((index) => (
            <button
              key={index}
              type="button"
              className={`cut-pile${pile === index ? ' selected' : ''}`}
              aria-pressed={pile === index}
              onClick={() => setPile(index)}
            >
              <span className="cut-stack" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="cut-label">第 {index + 1} 叠</span>
            </button>
          ))}
        </div>
      )}

      {state === 'cut' ? (
        <div className="shuffle-actions">
          <button type="button" className="btn btn-primary" onClick={() => onReady(pile ?? -1)}>
            {pile === null ? '不切牌，直接铺牌' : '把这一叠放到最上面'}
            <ArrowRight size={16} strokeWidth={1.6} />
          </button>
          <button type="button" className="btn btn-ghost" onClick={shuffle}>
            <Shuffle size={15} strokeWidth={1.6} />
            再洗一次
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost" onClick={shuffle} disabled={state === 'shuffling'}>
          <Shuffle size={15} strokeWidth={1.6} />
          {state === 'shuffling' ? '洗牌中…' : '开始洗牌'}
        </button>
      )}
    </div>
  )
}