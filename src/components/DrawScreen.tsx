import type { CSSProperties } from 'react'
import { RotateCcw } from 'lucide-react'
import type { TableEntry } from '../lib/draw'
import type { DrawnCard, Spread } from '../types'
import { TarotCardView } from './TarotCardView'

interface Props {
  spread: Spread
  table: TableEntry[]
  picks: number[]
  drawn: DrawnCard[]
  revealed: boolean[]
  question: string
  onPick: (index: number) => void
  onRelayTable: () => void
  onReveal: (index: number) => void
  onRevealAll: () => void
}

interface SlotProps {
  index: number
  position: number
  label: string
  entry: DrawnCard
  revealed: boolean
  crossing: boolean
  onReveal: (index: number) => void
}

function Slot({ index, position, label, entry, revealed, crossing, onReveal }: SlotProps) {
  return (
    <div
      className={`slot slot-${position}${revealed ? ' revealed' : ''}${crossing ? ' crossing' : ''}`}
      role={revealed ? undefined : 'button'}
      tabIndex={revealed ? undefined : 0}
      aria-label={revealed ? undefined : `翻开第 ${position} 张牌：${label}`}
      onClick={() => !revealed && onReveal(index)}
      onKeyDown={(e) => {
        if (!revealed && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onReveal(index)
        }
      }}
    >
      <span className="slot-label">
        {position}. {label}
      </span>
      <div className="card-rotor">
        <TarotCardView card={entry.card} reversed={entry.reversed} revealed={revealed} />
      </div>
      <span className="slot-name">
        {revealed ? (
          <>
            {entry.card.name}
            {entry.reversed && <span className="rev">逆</span>}
          </>
        ) : (
          ' '
        )}
      </span>
    </div>
  )
}

export function DrawScreen({
  spread,
  table,
  picks,
  drawn,
  revealed,
  question,
  onPick,
  onRelayTable,
  onReveal,
  onRevealAll,
}: Props) {
  const isCeltic = spread.id === 'celtic'
  const picking = drawn.length < spread.count
  const count = revealed.filter(Boolean).length
  const all = !picking && count === drawn.length

  return (
    <div>
      <div className="board-head">
        <div>
          <h2 className="board-title">{picking ? '凭直觉选牌' : spread.name}</h2>
          <p className="board-question">
            {question.trim() ? `「${question.trim()}」` : '没有写下问题，就围绕此刻的状态来看。'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="progress">
            {picking ? `${picks.length} / ${spread.count}` : `${count} / ${drawn.length}`}
          </span>
          {!picking && !all && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onRevealAll}>
              全部翻开
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRelayTable}>
            <RotateCcw size={14} strokeWidth={1.6} />
            重新铺牌
          </button>
        </div>
      </div>

      {picking ? (
        <div className="table-stage">
          <p className="table-hint">
            78 张牌已经全部铺在桌面上，每次的位置与角度都不同。不要计算，按第一直觉点选
            {spread.count} 张牌——先选中的对应第一个位置。
          </p>

          <div className="pick-order" aria-label="选择顺序">
            {spread.positions.map((position, i) => (
              <span key={i} className={`pick-chip${i < picks.length ? ' filled' : ''}`}>
                <em>{i + 1}</em>
                {position.label}
              </span>
            ))}
          </div>

          <div className="card-table">
            {table.map((entry, i) => {
              const picked = picks.includes(i)
              return (
                <button
                  key={entry.card.id}
                  type="button"
                  className={`table-card${picked ? ' picked' : ''}`}
                  style={
                    {
                      '--tx': `${entry.tx}px`,
                      '--ty': `${entry.ty}px`,
                      '--rot': `${entry.rot}deg`,
                    } as CSSProperties
                  }
                  onClick={() => onPick(i)}
                  disabled={picked}
                  aria-label={`选择第 ${i + 1} 张牌（背面朝上）`}
                >
                  <span className="table-card-mark" aria-hidden="true">
                    ✦
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <>
          <p className="table-hint">
            {all ? '全部牌已翻开。' : '点击牌面翻开，或一次全部翻开。'}
          </p>
          <div className={`board ${isCeltic ? 'celtic' : 'linear'}`}>
            {drawn.map((entry, i) => {
              const position = spread.positions[i]
              if (!position) return null
              return (
                <Slot
                  key={i}
                  index={i}
                  position={i + 1}
                  label={position.label}
                  entry={entry}
                  revealed={revealed[i]}
                  crossing={isCeltic && i === 1}
                  onReveal={onReveal}
                />
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}