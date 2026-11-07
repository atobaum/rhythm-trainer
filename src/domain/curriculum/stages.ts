import { figureById } from '../rhythm/figures.ts'
import { arrangeBars, iconPattern, patternFromCells, seededRandom } from '../rhythm/generator.ts'
import type { Cell, GenerationSpec } from '../rhythm/generator.ts'
import type { RhythmPattern } from '../rhythm/pattern.ts'

export type Stage = {
  id: string
  number: number
  section: string
  title: string
  subtitle: string
  part: number
  kind: 'figure' | 'review'
  figureId: string | null
  introBars: boolean
  barCount: number
  icon: RhythmPattern
  spec: GenerationSpec
}

const GENERATED_BARS = 8
const INTRO_BARS = 2
const MAXIMUM_REGENERATIONS = 20

type PlanItem = { section: string; figure: string; parts: number } | { section: string; review: number; key: string }

// 3연음은 박을 셋으로 나누기만 하면 되어서 박을 넷으로 나누는 16분음표보다 먼저 배운다.
const PLAN: PlanItem[] = [
  { section: '기초', figure: 'quarter-rest', parts: 2 },
  { section: '기초', figure: 'two-eighths', parts: 3 },
  { section: '기초', review: 2, key: 'basics' },
  { section: '8분음표', figure: 'eighth-rest-after', parts: 3 },
  { section: '8분음표', figure: 'offbeat-eighth', parts: 3 },
  { section: '8분음표', figure: 'eighth-quarter-eighth', parts: 3 },
  { section: '8분음표', figure: 'dotted-quarter', parts: 3 },
  { section: '8분음표', review: 3, key: 'eighths' },
  { section: '3연음', figure: 'triplet', parts: 3 },
  { section: '3연음', figure: 'triplet-no-second', parts: 4 },
  { section: '3연음', figure: 'triplet-no-third', parts: 4 },
  { section: '3연음', figure: 'triplet-middle-rest', parts: 4 },
  { section: '3연음', figure: 'triplet-first-rest', parts: 3 },
  { section: '3연음', review: 3, key: 'triplets' },
  { section: '더 많은 3연음', figure: 'triplet-only-second', parts: 4 },
  { section: '더 많은 3연음', figure: 'triplet-only-third', parts: 4 },
  { section: '더 많은 3연음', review: 2, key: 'more-triplets' },
  { section: '4분음표 3연음', figure: 'quarter-triplet', parts: 4 },
  { section: '4분음표 3연음', review: 2, key: 'quarter-triplets' },
  { section: '16분음표', figure: 'four-sixteenths', parts: 3 },
  { section: '16분음표', figure: 'eighth-two-sixteenths', parts: 3 },
  { section: '16분음표', figure: 'two-sixteenths-eighth', parts: 3 },
  { section: '16분음표', figure: 'sixteenth-eighth-sixteenth', parts: 3 },
  { section: '16분음표', review: 3, key: 'sixteenths' },
  { section: '점음표', figure: 'dotted-eighth-sixteenth', parts: 4 },
  { section: '점음표', figure: 'sixteenth-dotted-eighth', parts: 4 },
  { section: '점음표', review: 3, key: 'dotted' },
  { section: '고급', figure: 'tied-eighths', parts: 4 },
  { section: '고급', figure: 'rest-three-sixteenths', parts: 4 },
  { section: '고급', figure: 'offbeat-two-sixteenths', parts: 4 },
  { section: '고급', figure: 'sixteenth-syncopation', parts: 4 },
  { section: '고급', figure: 'sixteenth-gaps', parts: 4 },
  { section: '고급', review: 5, key: 'advanced' },
]

// bars 는 빠른 연습과 청음에서 한 문제의 마디 수다. 단계는 한 마디씩 친다.
const FIGURE_PART_SHAPES = [
  { featuresPerBar: 1, bars: 1 },
  { featuresPerBar: 2, bars: 1 },
  { featuresPerBar: 3, bars: 2 },
  { featuresPerBar: 4, bars: 2 },
]

const REVIEW_PART_SHAPES = [
  { featuresPerBar: 2, bars: 1, beatsPerBar: 4 },
  { featuresPerBar: 2, bars: 2, beatsPerBar: 3 },
  { featuresPerBar: 3, bars: 2, beatsPerBar: 4 },
  { featuresPerBar: 3, bars: 2, beatsPerBar: 3 },
  { featuresPerBar: 4, bars: 2, beatsPerBar: 4 },
]

function fillersFrom(learned: Cell[]): Cell[] {
  const simple = learned.filter((cell) => cell.beats === 1)
  const basics = [figureById('quarter').cells[0], ...(learned.includes(figureById('two-eighths').cells[0]) ? [figureById('two-eighths').cells[0]] : [])]
  return [...basics, ...basics, ...simple]
}

function buildStages(): Stage[] {
  const learned: Cell[] = [...figureById('quarter').cells]
  const learnedFigures: string[] = []
  const stages: Omit<Stage, 'number'>[] = []

  for (const item of PLAN) {
    if ('figure' in item) {
      const figure = figureById(item.figure)
      learned.push(...figure.cells)
      learnedFigures.push(figure.id)
      const fillers = item.figure === 'quarter-rest' ? figureById('quarter').cells : fillersFrom(learned)
      for (let part = 1; part <= item.parts; part++) {
        const shape = FIGURE_PART_SHAPES[part - 1]
        const id = `${figure.id}-${part}`
        const barCount = GENERATED_BARS + (part === 1 ? INTRO_BARS : 0)
        stages.push({
          id,
          section: item.section,
          title: `${item.figure === 'quarter-rest' ? '4분음표와 쉼표' : figure.label} (${part}부)`,
          subtitle: `${barCount}마디`,
          part,
          kind: 'figure',
          figureId: figure.id,
          introBars: part === 1,
          barCount,
          icon: iconPattern(figure.id, item.figure === 'quarter-rest' ? [figureById('quarter').cells[0], figure.cells[0]] : [figure.cells[0]]),
          spec: { id, title: figure.label, features: figure.cells, fillers, featuresPerBar: shape.featuresPerBar, bars: shape.bars, beatsPerBar: 4 },
        })
      }
    } else {
      const recent = learnedFigures.slice(-2).map((id) => figureById(id).cells[0])
      const iconCells = recent.reduce<Cell[]>((cells, cell) => (cells.reduce((sum, c) => sum + c.beats, 0) + cell.beats <= 3 ? [...cells, cell] : cells), [])
      for (let part = 1; part <= item.review; part++) {
        const shape = REVIEW_PART_SHAPES[part - 1]
        const id = `review-${item.key}-${part}`
        stages.push({
          id,
          section: item.section,
          title: `여러 그림 (${part}부)`,
          subtitle: `${shape.beatsPerBar}/4박자 · ${GENERATED_BARS}마디`,
          part,
          kind: 'review',
          figureId: null,
          introBars: false,
          barCount: GENERATED_BARS,
          icon: iconPattern(id, iconCells),
          spec: {
            id,
            title: '여러 그림',
            features: learned.filter((cell) => cell.items.some((cellItem) => cellItem.duration[1] !== 4 || cellItem.rest)),
            fillers: fillersFrom(learned),
            ...shape,
          },
        })
      }
    }
  }
  return stages.map((stage, index) => ({ ...stage, number: index + 1 }))
}

export const STAGES: Stage[] = buildStages()

const QUARTER = figureById('quarter').cells[0]

function introBarCells(stage: Stage): Cell[][] {
  const figureCells = figureById(stage.figureId!).cells
  const figureBeats = (count: number): Cell[] => {
    const cells: Cell[] = []
    for (let beats = 0, index = 0; beats < count; index++) {
      const cell = figureCells[index % figureCells.length]
      cells.push(cell)
      beats += cell.beats
    }
    return cells
  }
  const firstHalf = [...figureBeats(2), QUARTER, QUARTER]
  const alternating =
    figureCells[0].beats === 2
      ? [QUARTER, QUARTER, ...figureBeats(2)]
      : [QUARTER, figureCells[0], QUARTER, figureCells[figureCells.length - 1]]
  return [firstHalf, alternating]
}

function sameCells(left: Cell[], right: Cell[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

export const BARS_PER_UNIT = 2

// 새 음형만으로 마디가 꽉 차면 매번 같은 마디가 되므로, 같은 마디가 이어지면 새 음형을 하나씩 덜 넣는다.
function stageBarCells(stage: Stage, seed: number): Cell[][] {
  const random = seededRandom(seed)
  const unitSpec = { ...stage.spec, bars: BARS_PER_UNIT }
  const bars: Cell[][] = stage.introBars ? introBarCells(stage) : []
  for (let index = 0; index < GENERATED_BARS; index += BARS_PER_UNIT) {
    const previous = bars[bars.length - 1]
    const repeats = ([first, second]: Cell[][]) => (previous !== undefined && sameCells(first, previous)) || sameCells(first, second)
    let featuresPerBar = unitSpec.featuresPerBar
    let unit = arrangeBars(unitSpec, Math.floor(random() * 1e9))
    for (let retry = 1; repeats(unit) && featuresPerBar > 0; retry++) {
      if (retry % MAXIMUM_REGENERATIONS === 0) {
        featuresPerBar--
      }
      unit = arrangeBars({ ...unitSpec, featuresPerBar }, Math.floor(random() * 1e9))
    }
    bars.push(...unit)
  }
  return bars
}

// 시드가 같으면 같은 마디가 나오므로, 화면은 단계를 시작할 때마다 새 시드를 넘긴다.
export function stageBars(stage: Stage, seed: number): RhythmPattern[] {
  const shape = { beatsPerBar: stage.spec.beatsPerBar, bars: 1 }
  return stageBarCells(stage, seed).map((cells, index) =>
    patternFromCells(`${stage.id}-${seed}-bar${index + 1}`, `${stage.title} ${index + 1}마디`, cells, shape, stage.part),
  )
}

export function stageUnits(stage: Stage, seed: number): RhythmPattern[] {
  const bars = stageBarCells(stage, seed)
  const shape = { beatsPerBar: stage.spec.beatsPerBar, bars: BARS_PER_UNIT }
  return Array.from({ length: bars.length / BARS_PER_UNIT }, (_, unit) => {
    const first = unit * BARS_PER_UNIT + 1
    const cells = bars.slice(unit * BARS_PER_UNIT, (unit + 1) * BARS_PER_UNIT).flat()
    return patternFromCells(`${stage.id}-${seed}-unit${unit + 1}`, `${stage.title} ${first}–${first + BARS_PER_UNIT - 1}마디`, cells, shape, stage.part)
  })
}

export function skillKeyOf(stage: Stage): string {
  return stage.figureId ?? stage.id
}

export function currentStageIndex(clearedStageIds: Set<string>): number {
  const index = STAGES.findIndex((stage) => !clearedStageIds.has(stage.id))
  return index === -1 ? STAGES.length - 1 : index
}
