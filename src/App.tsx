import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { History, Settings } from 'lucide-react'
import { DrawScreen } from './components/DrawScreen'
import { HistoryDrawer } from './components/HistoryDrawer'
import { ReadingScreen } from './components/ReadingScreen'
import { SettingsDrawer } from './components/SettingsDrawer'
import { SetupScreen } from './components/SetupScreen'
import { ShuffleScreen } from './components/ShuffleScreen'
import { Starfield } from './components/Starfield'
import { SPREADS, getSpread } from './data/deck'
import { cutDeck, shuffleTable, type TableEntry } from './lib/draw'
import { composeFallback, streamReading } from './lib/reading'
import { loadTone, saveTone, type Tone } from './lib/settings'
import { clearHistory, loadHistory, removeRecord, saveRecord } from './lib/storage'
import type { DrawnCard, ReadingRecord, Spread } from './types'

type Phase = 'setup' | 'shuffle' | 'draw' | 'reading'
type Status = 'streaming' | 'done' | 'fallback'

interface ActiveReading {
  id: string
  question: string
  spread: Spread
  drawn: DrawnCard[]
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('setup')
  const [question, setQuestion] = useState('')
  const [spreadId, setSpreadId] = useState('three')
  const [drawn, setDrawn] = useState<DrawnCard[]>([])
  const [revealed, setRevealed] = useState<boolean[]>([])
  const [reading, setReading] = useState('')
  const [status, setStatus] = useState<Status>('streaming')
  const [error, setError] = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<ReadingRecord[]>(() => loadHistory())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [tone, setTone] = useState<Tone>(() => loadTone())
  const [table, setTable] = useState<TableEntry[]>([])
  const [picks, setPicks] = useState<number[]>([])

  const abortRef = useRef<AbortController | null>(null)
  const activeRef = useRef<ActiveReading | null>(null)

  const spread = getSpread(spreadId)

  useEffect(() => () => abortRef.current?.abort(), [])

  const runReading = useCallback(
    async (q: string, sp: Spread, cards: DrawnCard[], id: string) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setReading('')
      setError('')
      setStatus('streaming')

      const finish = (text: string, nextStatus: Status) => {
        setStatus(nextStatus)
        const record: ReadingRecord = {
          id,
          createdAt: Date.now(),
          question: q,
          spreadId: sp.id,
          spreadName: sp.name,
          drawn: cards,
          reading: text,
        }
        setHistory(saveRecord(record))
      }

      let acc = ''
      try {
        for await (const chunk of streamReading({ question: q, spread: sp, drawn: cards, tone }, controller.signal)) {
          acc += chunk
          setReading(acc)
        }
        if (!acc.trim()) throw new Error('empty response')
        finish(acc, 'done')
      } catch {
        if (controller.signal.aborted) return
        const fallback = composeFallback(q, sp, cards)
        setReading(fallback)
        setError('AI 服务暂时不可用，已切换到本地牌义解读。牌义仍来自完整的 78 张牌库。')
        finish(fallback, 'fallback')
      }
    },
    [tone],
  )

  const startReading = useCallback(
    (q: string, sp: Spread, cards: DrawnCard[], id: string) => {
      activeRef.current = { id, question: q, spread: sp, drawn: cards }
      setPhase('reading')
      void runReading(q, sp, cards, id)
    },
    [runReading],
  )

  // Auto-start the interpretation once the last card is turned over.
  useEffect(() => {
    if (phase !== 'draw' || drawn.length === 0) return
    if (revealed.length !== drawn.length || !revealed.every(Boolean)) return
    const timer = window.setTimeout(() => {
      startReading(question, spread, drawn, crypto.randomUUID())
    }, 780)
    return () => window.clearTimeout(timer)
  }, [phase, revealed, drawn, question, spread, startReading])

  const handleStart = () => setPhase('shuffle')

  const layTable = (pile = -1) => {
    setTable(cutDeck(shuffleTable(), pile))
    setPicks([])
    setDrawn([])
    setRevealed([])
    setPhase('draw')
  }

  const pickCard = (index: number) => {
    if (phase !== 'draw' || drawn.length >= spread.count) return
    if (picks.includes(index) || !table[index]) return
    const next = [...picks, index]
    setPicks(next)
    if (next.length === spread.count) {
      const cards = next.map((i) => ({ card: table[i].card, reversed: table[i].reversed }))
      setDrawn(cards)
      setRevealed(cards.map(() => false))
    }
  }

  const relayTable = () => layTable(-1)

  const reveal = (index: number) => {
    if (phase !== 'draw') return
    setRevealed((prev) => prev.map((v, i) => (i === index ? true : v)))
  }

  const revealAll = () => {
    if (phase !== 'draw') return
    setRevealed(drawn.map(() => true))
  }

  const restart = () => {
    abortRef.current?.abort()
    activeRef.current = null
    setPhase('setup')
    setQuestion('')
    setDrawn([])
    setRevealed([])
    setTable([])
    setPicks([])
    setReading('')
    setError('')
    setStatus('streaming')
  }

  const retry = () => {
    const active = activeRef.current
    if (!active) return
    void runReading(active.question, active.spread, active.drawn, active.id)
  }

  const openRecord = (record: ReadingRecord) => {
    abortRef.current?.abort()
    const sp = getSpread(record.spreadId)
    setQuestion(record.question)
    setSpreadId(sp.id)
    setDrawn(record.drawn)
    setRevealed(record.drawn.map(() => true))
    setReading(record.reading)
    setStatus('done')
    setError('')
    setPhase('reading')
    setHistoryOpen(false)
    activeRef.current = {
      id: record.id,
      question: record.question,
      spread: sp,
      drawn: record.drawn,
    }
  }

  return (
    <div className="app">
      <Starfield />

      <header className="site-header">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15.5 3.2a9 9 0 1 0 5.3 15.6A7.5 7.5 0 0 1 15.5 3.2Z"
              stroke="currentColor"
              strokeWidth="1.1"
            />
            <circle cx="12" cy="12" r="1.1" fill="currentColor" />
          </svg>
          <span>镜中塔罗</span>
        </div>
        <div className="header-actions">
          <button type="button" className="icon-btn" onClick={() => setSettingsOpen(true)}>
            <Settings size={15} strokeWidth={1.5} />
            设置
          </button>
          <button type="button" className="icon-btn" onClick={() => setHistoryOpen(true)}>
            <History size={15} strokeWidth={1.5} />
            记录{history.length > 0 ? ` · ${history.length}` : ''}
          </button>
        </div>
      </header>

      <main className={`main${phase === 'shuffle' ? ' center' : ''}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.25, 1] }}
            style={{ display: 'flex', flexDirection: 'column', flex: 1 }}
          >
            {phase === 'setup' && (
              <SetupScreen
                question={question}
                onQuestion={setQuestion}
                spreads={SPREADS}
                spreadId={spreadId}
                onSpread={setSpreadId}
                onStart={handleStart}
              />
            )}

            {phase === 'shuffle' && <ShuffleScreen spread={spread} onReady={layTable} />}

            {phase === 'draw' && (
              <DrawScreen
                spread={spread}
                table={table}
                picks={picks}
                drawn={drawn}
                revealed={revealed}
                question={question}
                onPick={pickCard}
                onRelayTable={relayTable}
                onReveal={reveal}
                onRevealAll={revealAll}
              />
            )}

            {phase === 'reading' && (
              <ReadingScreen
                question={activeRef.current?.question ?? question}
                spread={activeRef.current?.spread ?? spread}
                drawn={activeRef.current?.drawn ?? drawn}
                reading={reading}
                status={status}
                error={error}
                onRestart={restart}
                onRetry={retry}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        tone={tone}
        onTone={(next) => {
          setTone(next)
          saveTone(next)
        }}
      />

      <HistoryDrawer
        open={historyOpen}
        records={history}
        onClose={() => setHistoryOpen(false)}
        onOpen={openRecord}
        onDelete={(id) => setHistory(removeRecord(id))}
        onClear={() => {
          clearHistory()
          setHistory([])
        }}
      />
    </div>
  )
}