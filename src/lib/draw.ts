import { DECK } from '../data/deck'
import type { DrawnCard, TarotCard } from '../types'

const UINT32_RANGE = 4294967296

/** Cryptographically secure, unbiased integer in [0, max). */
function randInt(max: number): number {
  if (max <= 0) return 0
  const limit = Math.floor(UINT32_RANGE / max) * max
  const buf = new Uint32Array(1)
  let value: number
  do {
    crypto.getRandomValues(buf)
    value = buf[0]
  } while (value >= limit)
  return value % max
}

/**
 * One card lying on the table. `tx` / `ty` / `rot` are the small random
 * offsets that make every spread look freshly laid out.
 */
export interface TableEntry {
  card: TarotCard
  reversed: boolean
  tx: number
  ty: number
  rot: number
}

/** Fisher–Yates shuffle of the full 78-card deck, with per-card jitter. */
export function shuffleTable(): TableEntry[] {
  const entries: TableEntry[] = DECK.map((card) => ({
    card,
    reversed: randInt(100) < 32,
    tx: randInt(9) - 4,
    ty: randInt(9) - 4,
    rot: Math.round((randInt(1201) / 100 - 6) * 10) / 10,
  }))
  for (let i = entries.length - 1; i > 0; i--) {
    const j = randInt(i + 1)
    ;[entries[i], entries[j]] = [entries[j], entries[i]]
  }
  return entries
}

/**
 * Three-pile cut: the chosen pile goes on top, the other two are stacked
 * beneath it in order. `pile` outside 0–2 leaves the deck untouched.
 */
export function cutDeck(deck: TableEntry[], pile: number): TableEntry[] {
  if (pile < 0 || pile > 2) return deck
  const third = Math.floor(deck.length / 3)
  const segments = [deck.slice(0, third), deck.slice(third, third * 2), deck.slice(third * 2)]
  const chosen = segments[pile]
  const rest = segments.filter((_, i) => i !== pile)
  return [...chosen, ...rest[0], ...rest[1]]
}

export function formatCard(entry: DrawnCard): string {
  return `${entry.card.name}（${entry.reversed ? '逆位' : '正位'}）`
}