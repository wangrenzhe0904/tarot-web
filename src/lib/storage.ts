import type { ReadingRecord } from '../types'

const KEY = 'mirror-tarot.history.v1'
const MAX_RECORDS = 30

export function loadHistory(): ReadingRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ReadingRecord[]) : []
  } catch {
    return []
  }
}

export function saveRecord(record: ReadingRecord): ReadingRecord[] {
  const next = [record, ...loadHistory().filter((r) => r.id !== record.id)].slice(0, MAX_RECORDS)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* storage full or unavailable — reading still works this session */
  }
  return next
}

export function removeRecord(id: string): ReadingRecord[] {
  const next = loadHistory().filter((r) => r.id !== id)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}