import { Fragment, type ReactNode } from 'react'

const INLINE = /(\*\*[^*]+\*\*|_[^_]+_)/g

/**
 * Render one paragraph, keeping the emphasis parsing on the whole block so a
 * `**bold**` pair split across a soft line break still resolves.
 */
function renderBlock(block: string): ReactNode[] {
  return block.split(INLINE).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2) {
      return <em key={i}>{part.slice(1, -1)}</em>
    }
    const lines = part.split('\n')
    return (
      <Fragment key={i}>
        {lines.map((line, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {line}
          </Fragment>
        ))}
      </Fragment>
    )
  })
}

function cleanLine(line: string): string {
  return line
    .replace(/^#{1,6}\s*/, '')
    .replace(/^\s*[•·]\s+/, '')
    .replace(/＊/g, '*')
}

export function RichText({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const blocks = text
    .replace(/＊/g, '*')
    // A line that is only a bold label is a heading; give it its own paragraph.
    .replace(/\n(?=\*\*[^*\n]+\*\*\s*$)/gm, '\n\n')
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)

  return (
    <div className="reading-body">
      {blocks.map((block, bi) => {
        const lines = block.split('\n').map(cleanLine)
        const isList = lines.every((l) => /^- /.test(l))
        if (isList) {
          return (
            <ul key={bi} style={{ paddingLeft: '1.2em', marginBottom: '0.95em' }}>
              {lines.map((line, li) => (
                <li key={li} style={{ marginBottom: '0.35em' }}>
                  {renderBlock(line.replace(/^- /, ''))}
                </li>
              ))}
            </ul>
          )
        }
        return <p key={bi}>{renderBlock(lines.join('\n'))}</p>
      })}
      {streaming && <span className="caret" aria-hidden="true" />}
    </div>
  )
}