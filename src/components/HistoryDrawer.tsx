import { AnimatePresence, motion } from 'framer-motion'
import { Trash2, X } from 'lucide-react'
import type { ReadingRecord } from '../types'

interface Props {
  open: boolean
  records: ReadingRecord[]
  onClose: () => void
  onOpen: (record: ReadingRecord) => void
  onDelete: (id: string) => void
  onClear: () => void
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function HistoryDrawer({ open, records, onClose, onOpen, onDelete, onClear }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="drawer-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
          />
          <motion.aside
            className="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.32, ease: [0.2, 0.8, 0.25, 1] }}
            aria-label="占卜记录"
          >
            <div className="drawer-head">
              <h3 className="drawer-title">占卜记录</h3>
              <div style={{ display: 'flex', gap: 4 }}>
                {records.length > 0 && (
                  <button
                    type="button"
                    className="icon-only"
                    title="清空记录"
                    aria-label="清空记录"
                    onClick={() => {
                      if (window.confirm('清空全部占卜记录？此操作无法撤销。')) onClear()
                    }}
                  >
                    <Trash2 size={15} strokeWidth={1.5} />
                  </button>
                )}
                <button type="button" className="icon-only" aria-label="关闭" onClick={onClose}>
                  <X size={17} strokeWidth={1.5} />
                </button>
              </div>
            </div>

            <div className="drawer-body">
              {records.length === 0 ? (
                <div className="history-empty">
                  还没有记录。
                  <br />
                  每一次占卜都会保存在这台设备上。
                </div>
              ) : (
                records.map((record) => (
                  <div className="history-item" key={record.id}>
                    <div className="hi-top">
                      <span className="hi-spread">{record.spreadName}</span>
                      <span className="hi-date">{formatTime(record.createdAt)}</span>
                    </div>
                    <div className="hi-question">
                      {record.question.trim() ? record.question : '（未写下问题）'}
                    </div>
                    <div className="hi-cards">
                      {record.drawn
                        .map((d) => `${d.card.name}${d.reversed ? '逆' : ''}`)
                        .join(' · ')}
                    </div>
                    <div className="hi-actions">
                      <button type="button" className="mini-link" onClick={() => onOpen(record)}>
                        查看
                      </button>
                      <button
                        type="button"
                        className="mini-link"
                        onClick={() => {
                          if (window.confirm('删除这条记录？')) onDelete(record.id)
                        }}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}