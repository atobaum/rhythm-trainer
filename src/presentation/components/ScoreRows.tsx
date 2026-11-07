import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { splitIntoBars } from '../../domain/rhythm/pattern.ts'
import type { RhythmPattern } from '../../domain/rhythm/pattern.ts'
import { useNarrowScreen } from '../hooks/use-narrow-screen.ts'
import ScoreView from './ScoreView.tsx'
import type { PositionToX } from './ScoreView.tsx'
import type { BeatMark } from './TimingTrack.tsx'

// position 은 패턴 전체를 0~1 로 본 위치다.
export type ScoreRow = {
  toX: (position: number) => number
  contains: (position: number) => boolean
  cursor: number | null
  beats: BeatMark[]
}

type Props = {
  pattern: RhythmPattern
  hidden?: boolean
  cursor: number | null
  renderTracks: (row: ScoreRow) => ReactNode
}

export default function ScoreRows({ pattern, hidden = false, cursor, renderTracks }: Props) {
  const narrow = useNarrowScreen()
  const rows = useMemo(() => (narrow && !hidden && pattern.bars > 1 ? splitIntoBars(pattern) : null) ?? [pattern], [narrow, hidden, pattern])
  return rows.map((rowPattern, index) => (
    <ScoreRowView
      key={rowPattern.id}
      pattern={rowPattern}
      hidden={hidden}
      index={index}
      count={rows.length}
      beatsPerRow={(pattern.timeSignature.numerator * pattern.bars) / rows.length}
      beatsPerBar={pattern.timeSignature.numerator}
      cursor={cursor}
      renderTracks={renderTracks}
    />
  ))
}

type RowProps = Props & { index: number; count: number; beatsPerRow: number; beatsPerBar: number }

function ScoreRowView({ pattern, hidden, index, count, beatsPerRow, beatsPerBar, cursor, renderTracks }: RowProps) {
  const [positionToX, setPositionToX] = useState<PositionToX>(() => (position: number) => position)
  const handleLayout = useCallback((mapping: PositionToX) => setPositionToX(() => mapping), [])
  const start = index / count
  const end = (index + 1) / count
  const contains = (position: number) => (index === 0 || position >= start) && (index === count - 1 || position < end)
  const toX = (position: number) => positionToX((position - start) * count)
  const rowCursor = cursor !== null && contains(cursor) ? cursor : null
  const beats = Array.from({ length: beatsPerRow }, (_, beat) => ({
    x: positionToX(beat / beatsPerRow),
    label: String(((index * beatsPerRow + beat) % beatsPerBar) + 1),
  }))
  return (
    <>
      <ScoreView pattern={pattern} hidden={hidden} cursorX={hidden || rowCursor === null ? null : toX(rowCursor)} onLayout={handleLayout} />
      {renderTracks({ toX, contains, cursor: rowCursor, beats })}
    </>
  )
}
