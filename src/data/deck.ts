import major from '../../shared/cards/major.json'
import wands from '../../shared/cards/wands.json'
import cups from '../../shared/cards/cups.json'
import swords from '../../shared/cards/swords.json'
import pentacles from '../../shared/cards/pentacles.json'
import spreadData from '../../shared/spreads.json'
import type { Spread, TarotCard } from '../types'

export const DECK: TarotCard[] = [
  ...(major as TarotCard[]),
  ...(wands as TarotCard[]),
  ...(cups as TarotCard[]),
  ...(swords as TarotCard[]),
  ...(pentacles as TarotCard[]),
]

export const SPREADS = spreadData as Spread[]

export const SUIT_LABEL: Record<string, string> = {
  wands: '权杖 · 火',
  cups: '圣杯 · 水',
  swords: '宝剑 · 风',
  pentacles: '星币 · 土',
}

export function getSpread(id: string): Spread {
  return SPREADS.find((s) => s.id === id) ?? SPREADS[0]
}