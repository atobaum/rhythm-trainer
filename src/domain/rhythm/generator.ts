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

export type Subdivision = 'basic' | 'duple' | 'triple'

export function subdivisionOf(cell: Cell): Subdivision {
  if (cell.items.some((item) => item.triplet)) {
    return 'triple'
  }
  return cell.items.some((item) => item.duration[1] > 4) ? 'duple' : 'basic'
}

const startsWithRest = (cell: Cell) => cell.items[0]?.rest === true

// 쉼표로 시작하는 박이 강박에 몰리지 않게 하는 박별 가중치. 값은 가설이다.
function restStartWeight(beat: number, beatsPerBar: number): number {
  if (beat === 0) {
    return 0.25
  }
  return beatsPerBar === 4 && beat === 2 ? 0.5 : 1
}

type Placed = { cell: Cell; start: number; role: 'feature' | 'filler' }

type BarPlan = { placed: Placed[]; features: Cell[]; fillers: Cell[] }

function pickWith<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)]
}

function pickWeighted<T>(items: T[], weightOf: (item: T) => number, random: () => number): T {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0)
  let remaining = random() * total
  for (const item of items) {
    remaining -= weightOf(item)
    if (remaining < 0) {
      return item
    }
  }
  return items[items.length - 1]
}

function pickFiller(fillers: Cell[], beat: number, beatsPerBar: number, random: () => number): Cell {
  return pickWeighted(fillers, (cell) => (startsWithRest(cell) ? restStartWeight(beat, beatsPerBar) : 1), random)
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

// 한 마디는 둘로 나눔과 셋으로 나눔 중 한 갈래만 쓴다.
function cellsOfOneSubdivision(spec: GenerationSpec, random: () => number): { features: Cell[]; fillers: Cell[] } {
  const subdivisions = [...new Set(spec.features.map(subdivisionOf).filter((subdivision) => subdivision !== 'basic'))]
  if (subdivisions.length === 0) {
    return { features: spec.features, fillers: spec.fillers }
  }
  const chosen = pickWith(subdivisions, random)
  const fits = (cell: Cell) => subdivisionOf(cell) === 'basic' || subdivisionOf(cell) === chosen
  const fillers = spec.fillers.filter(fits)
  return { features: spec.features.filter(fits), fillers: fillers.some((cell) => cell.beats === 1) ? fillers : spec.fillers }
}

function planBar(spec: GenerationSpec, random: () => number): BarPlan {
  const { features, fillers } = cellsOfOneSubdivision(spec, random)
  const slots: (Cell | null)[] = new Array(spec.beatsPerBar).fill(null)
  const placed: Placed[] = []
  for (let count = 0; count < spec.featuresPerBar; count++) {
    const preferred = pickWith(features, random)
    const candidates = [preferred, ...features.filter((cell) => cell !== preferred)]
    const cell = candidates.find((candidate) => startsFor(candidate, slots, spec.beatsPerBar).length > 0)
    if (!cell) {
      break
    }
    const start = pickWith(startsFor(cell, slots, spec.beatsPerBar), random)
    placed.push({ cell, start, role: 'feature' })
    for (let offset = 0; offset < cell.beats; offset++) {
      slots[start + offset] = cell
    }
  }
  const oneBeatFillers = fillers.filter((cell) => cell.beats === 1)
  slots.forEach((slot, beat) => {
    if (slot === null) {
      placed.push({ cell: pickFiller(oneBeatFillers, beat, spec.beatsPerBar, random), start: beat, role: 'filler' })
    }
  })
  placed.sort((left, right) => left.start - right.start)
  return { placed, features, fillers: oneBeatFillers }
}

const VARIED_REPEAT_CHANCE = 0.6
const QUARTER_ENDING_CHANCE = 0.5
const MAXIMUM_VARIATION_TRIES = 10

function cellsOf(plan: BarPlan): Cell[] {
  return plan.placed.map((entry) => entry.cell)
}

function sameBar(left: Cell[], right: Cell[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function redraw(entry: Placed, plan: BarPlan, spec: GenerationSpec, random: () => number): Placed {
  if (entry.role === 'filler') {
    return { ...entry, cell: pickFiller(plan.fillers, entry.start, spec.beatsPerBar, random) }
  }
  const sameLength = plan.features.filter((cell) => cell.beats === entry.cell.beats)
  return { ...entry, cell: pickWith(sameLength, random) }
}

// 첫 마디를 한두 박만 바꿔 반복한다. 바꿀 수 있는 박이 없으면 null.
function varyBar(first: BarPlan, spec: GenerationSpec, random: () => number): BarPlan | null {
  for (let attempt = 0; attempt < MAXIMUM_VARIATION_TRIES; attempt++) {
    const changeCount = random() < 0.5 ? 1 : 2
    const placed = [...first.placed]
    for (let changed = 0; changed < changeCount; changed++) {
      const index = Math.floor(random() * placed.length)
      placed[index] = redraw(placed[index], first, spec, random)
    }
    const varied = { ...first, placed }
    if (!sameBar(cellsOf(varied), cellsOf(first))) {
      return varied
    }
  }
  return null
}

function endOnQuarter(plan: BarPlan, spec: GenerationSpec, random: () => number): BarPlan {
  const last = plan.placed[plan.placed.length - 1]
  const endings = plan.fillers.filter((cell) => subdivisionOf(cell) === 'basic')
  if (last.role !== 'filler' || last.start !== spec.beatsPerBar - 1 || endings.length === 0 || random() >= QUARTER_ENDING_CHANCE) {
    return plan
  }
  return { ...plan, placed: [...plan.placed.slice(0, -1), { ...last, cell: pickWith(endings, random) }] }
}

const QUARTER_FALLBACK: Cell = { beats: 1, items: [note(1, 4)] }

function withEnoughNotes(cells: Cell[]): Cell[] {
  const result = [...cells]
  for (let index = 0; index < result.length && soundingItems(result) < 2; index++) {
    if (result[index].beats === 1 && soundingItems([result[index]]) === 0) {
      result[index] = QUARTER_FALLBACK
    }
  }
  return result
}

// 두 마디씩 묶어 둘째 마디는 첫 마디를 조금 바꿔 반복하거나 새로 만들고, 둘째 마디 끝은 4분음표나 쉼표로 맺기 쉽게 한다.
export function arrangeBars(spec: GenerationSpec, seed: number): Cell[][] {
  const random = seededRandom(seed)
  const bars: Cell[][] = []
  for (let bar = 0; bar < spec.bars; bar += 2) {
    const first = planBar(spec, random)
    if (bar + 1 >= spec.bars) {
      bars.push(withEnoughNotes(cellsOf(first)))
      break
    }
    const varied = random() < VARIED_REPEAT_CHANCE ? varyBar(first, spec, random) : null
    let second = endOnQuarter(varied ?? planBar(spec, random), spec, random)
    if (sameBar(cellsOf(second), cellsOf(first))) {
      second = planBar(spec, random)
    }
    bars.push(withEnoughNotes(cellsOf(first)), withEnoughNotes(cellsOf(second)))
  }
  return bars
}

export function arrangeCells(spec: GenerationSpec, seed: number): Cell[] {
  return arrangeBars(spec, seed).flat()
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
