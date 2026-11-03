import { ArrowRight } from 'lucide-react'
import type { Spread } from '../types'

interface Props {
  question: string
  onQuestion: (value: string) => void
  spreads: Spread[]
  spreadId: string
  onSpread: (id: string) => void
  onStart: () => void
}

const MAX_QUESTION = 160

export function SetupScreen({ question, onQuestion, spreads, spreadId, onSpread, onStart }: Props) {
  return (
    <div className="setup">
      <div className="setup-copy">
        <p className="eyebrow">A quiet mirror</p>
        <h1 className="display">
          镜中
          <br />
          <em>塔罗</em>
        </h1>
        <p className="lede">
          抽牌之前，先诚实地问自己一个问题。塔罗不替你决定，
          它只是把你已经知道、却还没说出口的东西，摆到桌面上。
        </p>

        <div className="setup-form">
          <div>
            <label className="field-label" htmlFor="question">
              <span>你的问题（可以不写）</span>
              <span>{question.length} / {MAX_QUESTION}</span>
            </label>
            <div className="question-box">
              <textarea
                id="question"
                value={question}
                maxLength={MAX_QUESTION}
                onChange={(e) => onQuestion(e.target.value)}
                placeholder="例如：我该不该接受这份新的工作机会？"
              />
            </div>
          </div>

          <div>
            <span className="field-label" style={{ marginBottom: 8, display: 'flex' }}>
              <span>选择牌阵</span>
            </span>
            <div className="spread-grid" role="group" aria-label="选择牌阵">
              {spreads.map((spread) => (
                <button
                  key={spread.id}
                  type="button"
                  className="spread-option"
                  aria-pressed={spreadId === spread.id}
                  onClick={() => onSpread(spread.id)}
                >
                  <span className="so-name">
                    {spread.name}
                    <span className="so-count">{spread.count} 张</span>
                  </span>
                  <span className="so-sub">{spread.subtitle}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="setup-actions">
            <button type="button" className="btn btn-primary" onClick={onStart}>
              开始占卜
              <ArrowRight size={16} strokeWidth={1.6} />
            </button>
            <span className="hint">牌面为 1909 年韦特公版扫描件<br />解读仅供参考，不构成任何专业建议</span>
          </div>
        </div>
      </div>

      <div className="setup-art" aria-hidden="true">
        <div className="orbit" />
        <div className="orbit orbit-2" />
        <div className="orbit orbit-3" />
        <div className="hero-card">
          <img src="/cards/17_Star.jpg" alt="" />
        </div>
      </div>
    </div>
  )
}