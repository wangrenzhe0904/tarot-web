export type Suit = 'wands' | 'cups' | 'swords' | 'pentacles'

export interface TarotCard {
  id: string
  name: string
  nameEn: string
  arcana: 'major' | 'minor'
  number: number
  suit: Suit | null
  image: string
  keywords: string[]
  upright: string
  reversed: string
}

export interface SpreadPosition {
  label: string
  meaning: string
}

export interface Spread {
  id: string
  name: string
  subtitle: string
  count: number
  positions: SpreadPosition[]
}

export interface DrawnCard {
  card: TarotCard
  reversed: boolean
}

export interface ReadingRecord {
  id: string
  createdAt: number
  question: string
  spreadId: string
  spreadName: string
  drawn: DrawnCard[]
  reading: string
}