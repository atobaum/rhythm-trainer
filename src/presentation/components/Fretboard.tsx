import { useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { DOUBLE_INLAY_FRET, INLAY_FRETS, STRING_NUMBERS, drawnFrets, isInRange, openStringNoteName } from '../../domain/fretboard/fretboard.ts'
import type { FretPosition, FretRange } from '../../domain/fretboard/fretboard.ts'
import type { CellTone } from '../../domain/fretboard/position-records.ts'

const LABEL_WIDTH = 40
const STRING_GAP = 40
const SIDE_MARKER_HEIGHT = 12
const SIDE_MARKER_RADIUS = 3.5
const FRET_NUMBER_HEIGHT = 22
const INLAY_RADIUS = 7
const BOARD_HEIGHT = STRING_GAP * STRING_NUMBERS.length
const THINNEST_STRING_WIDTH = 1
const THICKEST_STRING_WIDTH = 4
const MARK_RADIUS = 13

export type FretMarkTone = 'question' | 'correct' | 'wrong'

export type FretMark = {
  position: FretPosition
  tone: FretMarkTone
}

export type FretCellTone = {
  position: FretPosition
  tone: CellTone
}

type Props = {
  range: FretRange
  marks?: FretMark[]
  cellTones?: FretCellTone[]
  highlightString?: number
  onTap?: (position: FretPosition, timeStamp: number) => void
}

function isInlayFret(fret: number): boolean {
  return fret === DOUBLE_INLAY_FRET || (INLAY_FRETS as readonly number[]).includes(fret)
}

function stringWidth(stringNumber: number): number {
  const step = (THICKEST_STRING_WIDTH - THINNEST_STRING_WIDTH) / (STRING_NUMBERS.length - 1)
  return THINNEST_STRING_WIDTH + (stringNumber - 1) * step
}

function useElementWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) {
      return
    }
    setWidth(element.clientWidth)
    const observer = new ResizeObserver(() => setWidth(element.clientWidth))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}

export default function Fretboard({ range, marks = [], cellTones = [], highlightString, onTap }: Props) {
  const { ref, width } = useElementWidth()
  const drawn = drawnFrets(range)
  const frets = Array.from({ length: drawn.toFret - drawn.fromFret + 1 }, (_, offset) => drawn.fromFret + offset)
  const columnWidth = width > LABEL_WIDTH ? (width - LABEL_WIDTH) / frets.length : 0
  const columnLeft = (fret: number) => LABEL_WIDTH + (fret - drawn.fromFret) * columnWidth
  const columnCenter = (fret: number) => columnLeft(fret) + columnWidth / 2
  const stringY = (stringNumber: number) => (stringNumber - 0.5) * STRING_GAP
  const neckLeft = drawn.fromFret === 0 ? columnLeft(1) : columnLeft(drawn.fromFret)

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (!onTap || columnWidth === 0) {
      return
    }
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - bounds.left
    const y = event.clientY - bounds.top
    const columnIndex = Math.floor((x - LABEL_WIDTH) / columnWidth)
    const rowIndex = Math.floor(y / STRING_GAP)
    if (columnIndex < 0 || columnIndex >= frets.length || rowIndex < 0 || rowIndex >= STRING_NUMBERS.length) {
      return
    }
    const position = { stringNumber: STRING_NUMBERS[rowIndex], fret: frets[columnIndex] }
    if (isInRange(range, position)) {
      onTap(position, event.timeStamp)
    }
  }

  return (
    <div className="fretboard" ref={ref}>
      {columnWidth > 0 && (
        <svg
          width={width}
          height={BOARD_HEIGHT + SIDE_MARKER_HEIGHT + FRET_NUMBER_HEIGHT}
          onPointerDown={handlePointerDown}
          role="img"
          aria-label={`지판 ${drawn.fromFret}~${drawn.toFret}프렛`}
        >
          <rect className="fretboard-neck" x={neckLeft} y={0} width={width - neckLeft} height={BOARD_HEIGHT} />
          {cellTones.map(({ position, tone }) => (
            <rect
              key={`tone-${position.stringNumber}-${position.fret}`}
              className={`fretboard-cell fretboard-cell-${tone}`}
              x={columnLeft(position.fret)}
              y={(position.stringNumber - 1) * STRING_GAP}
              width={columnWidth}
              height={STRING_GAP}
            />
          ))}
          {frets.map((fret) => {
            const x = columnCenter(fret)
            if (fret === DOUBLE_INLAY_FRET) {
              return (
                <g key={`inlay-${fret}`} className="fretboard-inlay">
                  <circle cx={x} cy={STRING_GAP * 2} r={INLAY_RADIUS} />
                  <circle cx={x} cy={STRING_GAP * 4} r={INLAY_RADIUS} />
                </g>
              )
            }
            return isInlayFret(fret) ? (
              <circle key={`inlay-${fret}`} className="fretboard-inlay" cx={x} cy={STRING_GAP * 3} r={INLAY_RADIUS} />
            ) : null
          })}
          {frets.map((fret) => {
            const x = columnLeft(fret) + columnWidth
            if (fret === 0) {
              return <line key={`fret-${fret}`} className="fretboard-nut" x1={x} x2={x} y1={0} y2={BOARD_HEIGHT} />
            }
            return <line key={`fret-${fret}`} className="fretboard-fret" x1={x} x2={x} y1={0} y2={BOARD_HEIGHT} />
          })}
          {drawn.fromFret > 0 && (
            <line className="fretboard-fret" x1={neckLeft} x2={neckLeft} y1={0} y2={BOARD_HEIGHT} />
          )}
          {STRING_NUMBERS.map((stringNumber) => (
            <g key={`string-${stringNumber}`}>
              <line
                className={stringNumber === highlightString ? 'fretboard-string fretboard-string-highlight' : 'fretboard-string'}
                x1={LABEL_WIDTH}
                x2={width}
                y1={stringY(stringNumber)}
                y2={stringY(stringNumber)}
                strokeWidth={stringWidth(stringNumber) + (stringNumber === highlightString ? 1 : 0)}
              />
              <text className="fretboard-label" x={LABEL_WIDTH / 2} y={stringY(stringNumber)}>
                {stringNumber} {openStringNoteName(stringNumber)}
              </text>
            </g>
          ))}
          {STRING_NUMBERS.flatMap((stringNumber) =>
            frets
              .filter((fret) => !isInRange(range, { stringNumber, fret }))
              .map((fret) => (
                <rect
                  key={`dim-${stringNumber}-${fret}`}
                  className="fretboard-dim"
                  x={columnLeft(fret)}
                  y={(stringNumber - 1) * STRING_GAP}
                  width={columnWidth}
                  height={STRING_GAP}
                />
              )),
          )}
          {marks.map((mark) => (
            <circle
              key={`mark-${mark.position.stringNumber}-${mark.position.fret}-${mark.tone}`}
              className={`fretboard-mark fretboard-mark-${mark.tone}`}
              cx={columnCenter(mark.position.fret)}
              cy={stringY(mark.position.stringNumber)}
              r={Math.min(MARK_RADIUS, columnWidth / 2 - 1)}
            />
          ))}
          {frets.filter(isInlayFret).map((fret) => {
            const x = columnCenter(fret)
            const y = BOARD_HEIGHT + SIDE_MARKER_HEIGHT / 2
            const offsets = fret === DOUBLE_INLAY_FRET ? [-SIDE_MARKER_RADIUS * 1.6, SIDE_MARKER_RADIUS * 1.6] : [0]
            return (
              <g key={`side-${fret}`} className="fretboard-side-marker">
                {offsets.map((offset) => (
                  <circle key={offset} cx={x + offset} cy={y} r={SIDE_MARKER_RADIUS} />
                ))}
              </g>
            )
          })}
          {frets.map((fret) => (
            <text
              key={`number-${fret}`}
              className={isInlayFret(fret) ? 'fretboard-number fretboard-number-inlay' : 'fretboard-number'}
              x={columnCenter(fret)}
              y={BOARD_HEIGHT + SIDE_MARKER_HEIGHT + FRET_NUMBER_HEIGHT / 2 + 2}
            >
              {fret}
            </text>
          ))}
        </svg>
      )}
    </div>
  )
}
