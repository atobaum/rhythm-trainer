import { addFractions, createFraction } from './fraction.ts'
import type { Fraction } from './fraction.ts'
import type { RhythmEvent, RhythmPattern } from './pattern.ts'

export type CellItem = {
  duration: [number, number]
  rest?: boolean
  tieToNext?: boolean
  triplet?: boolean
}

export type Cell = {
  beats: 1 | 2
  items: CellItem[]
}

export const note = (numerator: number, denominator: number, extra: Partial<CellItem> = {}): CellItem => ({
  duration: [numerator, denominator],
  ...extra,
})
export const rest = (numerator: number, denominator: number): CellItem => ({ duration: [numerator, denominator], rest: true })
export const triplet = (numerator: number, denominator: number, extra: Partial<CellItem> = {}): CellItem => ({
  duration: [numerator, denominator],
  triplet: true,
  ...extra,
})

export type GenerationSpec = {
  id: string
  title: string
  features: Cell[]
  fillers: Cell[]
  featuresPerBar: number
  bars: number
  beatsPerBar: number
}

export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function soundingItems(cells: Cell[]): number {
  return cells.flatMap((cell) => cell.items).filter((item) => !item.rest).length
}

// 4/4 에서 2박 음형은 마디 가운데를 넘지 않게 1박이나 3박에서만 시작한다.
function startsFor(cell: Cell, slots: (Cell | null)[], beatsPerBar: number): number[] {
  const starts: number[] = []
  for (let start = 0; start + cell.beats <= beatsPerBar; start++) {
    const free = Array.from({ length: cell.beats }, (_, offset) => slots[start + offset] === null).every(Boolean)
    const aligned = cell.beats === 1 || beatsPerBar !== 4 || start % 2 === 0
    if (free && aligned) {
      starts.push(start)
    }
  }
  return starts
}

function arrangeBar(spec: GenerationSpec, random: () => number): Cell[] {
  const pick = <T,>(items: T[]) => items[Math.floor(random() * items.length)]
  const slots: (Cell | null)[] = new Array(spec.beatsPerBar).fill(null)
  for (let placed = 0; placed < spec.featuresPerBar; placed++) {
    const preferred = pick(spec.features)
    const candidates = [preferred, ...spec.features.filter((cell) => cell !== preferred)]
    const cell = candidates.find((candidate) => startsFor(candidate, slots, spec.beatsPerBar).length > 0)
    if (!cell) {
      break
    }
    const start = pick(startsFor(cell, slots, spec.beatsPerBar))
    slots[start] = cell
    for (let offset = 1; offset < cell.beats; offset++) {
      slots[start + offset] = { beats: 1, items: [] }
    }
  }
  const oneBeatFillers = spec.fillers.filter((cell) => cell.beats === 1)
  return slots.flatMap((slot) => {
    if (slot === null) {
      return [pick(oneBeatFillers)]
    }
    return slot.items.length > 0 ? [slot] : []
  })
}

export function cellsToEvents(cells: Cell[]): RhythmEvent[] {
  const events: RhythmEvent[] = []
  let onset: Fraction = createFraction(0, 1)
  let tieCount = 0
  let openTie: string | undefined
  cells.forEach((cell, cellIndex) => {
    const tupletGroup = cell.items.some((item) => item.triplet) ? `g${cellIndex}` : undefined
    for (const item of cell.items) {
      const duration = createFraction(item.duration[0], item.duration[1])
      let tieGroupId = openTie
      if (item.tieToNext) {
        tieGroupId ??= `t${++tieCount}`
      }
      events.push({
        id: `e${events.length + 1}`,
        onset,
        duration,
        kind: item.rest ? 'rest' : 'note',
        notation: {
          dots: item.duration[0] === 3 ? 1 : 0,
          ...(item.triplet ? { tuplet: { actual: 3, normal: 2 }, tupletGroup } : {}),
          ...(tieGroupId ? { tieGroupId } : {}),
        },
      })
      openTie = item.tieToNext ? tieGroupId : undefined
      onset = addFractions(onset, duration)
    }
  })
  return events
}

const QUARTER_FALLBACK: Cell = { beats: 1, items: [note(1, 4)] }

export function arrangeCells(spec: GenerationSpec, seed: number): Cell[] {
  const random = seededRandom(seed)
  const cells: Cell[] = []
  for (let bar = 0; bar < spec.bars; bar++) {
    const barCells = arrangeBar(spec, random)
    for (let index = 0; index < barCells.length && soundingItems(barCells) < 2; index++) {
      if (barCells[index].beats === 1 && soundingItems([barCells[index]]) === 0) {
        barCells[index] = QUARTER_FALLBACK
      }
    }
    cells.push(...barCells)
  }
  return cells
}

export function patternFromCells(
  id: string,
  title: string,
  cells: Cell[],
  shape: { beatsPerBar: number; bars: number },
  difficulty = 1,
): RhythmPattern {
  return {
    id,
    title,
    timeSignature: { numerator: shape.beatsPerBar, denominator: 4 },
    bars: shape.bars,
    tracks: [{ id: 'main', role: 'single', instrument: 'tap', events: cellsToEvents(cells) }],
    tags: [id],
    difficulty,
  }
}

export function generateFromCells(spec: GenerationSpec, seed: number): RhythmPattern {
  return { ...patternFromCells(`${spec.id}-${seed}`, spec.title, arrangeCells(spec, seed), spec, spec.featuresPerBar), tags: [spec.id] }
}

export function iconPattern(id: string, cells: Cell[]): RhythmPattern {
  const beats = cells.reduce((sum, cell) => sum + cell.beats, 0)
  return {
    id: `icon-${id}`,
    title: id,
    timeSignature: { numerator: beats, denominator: 4 },
    bars: 1,
    tracks: [{ id: 'main', role: 'single', instrument: 'tap', events: cellsToEvents(cells) }],
    tags: [],
    difficulty: 1,
  }
}
