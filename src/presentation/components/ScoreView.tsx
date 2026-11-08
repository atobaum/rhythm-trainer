import { useEffect, useRef, useState } from 'react'
import type { RhythmPattern } from '../../domain/rhythm/pattern.ts'
import { notationFontsReady, renderScore } from '../../infrastructure/notation/score-renderer.ts'

export type PositionToX = (position: number) => number

type Props = {
  pattern: RhythmPattern
  hidden?: boolean
  cursorX?: number | null
  onLayout?: (positionToX: PositionToX) => void
  minimal?: boolean
}

// 작은 보기는 칸 폭이 고정이라, 그린 내용이 칸보다 넓으면 비율을 지켜 줄인다. 좁은 내용은 키우지 않는다.
function shrinkToFit(drawing: HTMLElement, width: number) {
  const svg = drawing.querySelector('svg')
  if (!svg || typeof svg.getBBox !== 'function') {
    return
  }
  const box = svg.getBBox()
  const contentWidth = Math.ceil(box.x + box.width)
  if (contentWidth <= width) {
    return
  }
  const height = Number(svg.getAttribute('height'))
  svg.setAttribute('viewBox', `0 0 ${contentWidth} ${height}`)
  svg.setAttribute('preserveAspectRatio', 'xMinYMid meet')
}

export default function ScoreView({
  pattern,
  hidden = false,
  cursorX = null,
  onLayout,
  minimal = false,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const drawingRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [failure, setFailure] = useState<string | null>(null)

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) {
      return
    }
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const drawing = drawingRef.current
    if (!drawing || width === 0 || hidden) {
      return
    }
    let cancelled = false
    notationFontsReady.then(() => {
      if (cancelled) {
        return
      }
      try {
        const layout = renderScore(drawing, pattern, width, { minimal })
        if (minimal) {
          shrinkToFit(drawing, width)
        }
        setFailure(null)
        onLayout?.(layout.xOfPatternPosition)
      } catch (error) {
        setFailure(error instanceof Error ? error.message : String(error))
      }
    })
    return () => {
      cancelled = true
    }
  }, [pattern, width, hidden, onLayout, minimal])

  return (
    <div ref={wrapperRef} className={minimal ? 'score score-minimal' : 'score'}>
      {hidden ? <div className="score-hidden">듣고 기억해서 치세요</div> : <div ref={drawingRef} />}
      {failure && <div className="score-hidden">{failure}</div>}
      {cursorX !== null && <div className="score-cursor" style={{ left: `${cursorX * 100}%` }} />}
    </div>
  )
}
