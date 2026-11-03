import type { TarotCard } from '../types'

interface Props {
  card: TarotCard
  reversed: boolean
  revealed: boolean
}

export function TarotCardView({ card, reversed, revealed }: Props) {
  return (
    <div className={`card3d${revealed ? ' flipped' : ''}`}>
      <div className="card-inner">
        <div className="card-face card-back" aria-hidden="true" />
        <div className="card-face card-front">
          <img
            src={`/cards/${card.image}`}
            alt={`${card.name} ${card.nameEn}${reversed ? '（逆位）' : ''}`}
            className={reversed ? 'is-reversed' : undefined}
            loading="eager"
            draggable={false}
          />
        </div>
      </div>
    </div>
  )
}