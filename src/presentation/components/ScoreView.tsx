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
