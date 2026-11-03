import { useMemo, type CSSProperties } from 'react'

export function Starfield() {
  const stars = useMemo(
    () =>
      Array.from({ length: 110 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        big: Math.random() > 0.86,
        dur: `${4 + Math.random() * 7}s`,
        delay: `${Math.random() * 6}s`,
        opacity: 0.12 + Math.random() * 0.4,
      })),
    [],
  )

  return (
    <div className="starfield" aria-hidden="true">
      {stars.map((s) => (
        <span
          key={s.id}
          className={`star${s.big ? ' big' : ''}`}
          style={
            {
              left: s.left,
              top: s.top,
              opacity: s.opacity,
              '--dur': s.dur,
              '--delay': s.delay,
            } as CSSProperties
          }
        />
      ))}
    </div>
  )
}