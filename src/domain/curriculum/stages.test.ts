import { describe, expect, it } from 'vitest'
import { generateExpectedEvents } from '../rhythm/event-generator.ts'
import { validatePattern } from '../rhythm/pattern.ts'
import type { RhythmPattern } from '../rhythm/pattern.ts'
import { BARS_PER_UNIT, STAGES, currentStageIndex, stageBars, stageUnits } from './stages.ts'
import type { Stage } from './stages.ts'

describe('STAGES', () => {
  it('numbers stages in order with unique ids', () => {
    expect(STAGES.map((stage) => stage.number)).toEqual(STAGES.map((_, index) => index + 1))
    expect(new Set(STAGES.map((stage) => stage.id)).size).toBe(STAGES.length)
    expect(STAGES.length).toBeGreaterThanOrEqual(90)
  })

  it('names figure parts and review stages', () => {
    const sixteenths = STAGES.filter((stage) => stage.id.startsWith('four-sixteenths-'))
    expect(sixteenths.map((stage) => stage.title)).toEqual(['16분음표 4개 (1부)', '16분음표 4개 (2부)', '16분음표 4개 (3부)'])
    expect(STAGES.some((stage) => stage.kind === 'review' && stage.spec.beatsPerBar === 3)).toBe(true)
  })

  it('makes valid icons', () => {
    STAGES.forEach((stage) => expect(validatePattern(stage.icon)).toEqual([]))
  })
})

const SEEDS = [1, 2, 3, 42, 987654]

function cellSignature(pattern: RhythmPattern): string {
  return JSON.stringify(pattern.tracks[0].events.map((event) => [event.duration.numerator, event.duration.denominator, event.kind, !!event.notation.tieGroupId]))
}

describe('stageBars', () => {
  it('gives valid one-bar patterns for every stage and seed', () => {
    for (const stage of STAGES) {
      for (const seed of SEEDS) {
        const bars = stageBars(stage, seed)
        expect(bars).toHaveLength(stage.barCount)
        bars.forEach((bar, index) => {
          expect(bar.bars).toBe(1)
          expect(validatePattern(bar), `${stage.id} ${seed} ${index}`).toEqual([])
          expect(generateExpectedEvents(bar, { bpm: 80 }).length).toBeGreaterThan(1)
        })
      }
    }
  })

  it('puts two intro bars only before the generated bars of part 1', () => {
    expect(STAGES.filter((stage) => stage.introBars).every((stage) => stage.kind === 'figure' && stage.part === 1)).toBe(true)
    expect(STAGES.filter((stage) => stage.kind === 'figure' && stage.part === 1).every((stage) => stage.barCount === 10)).toBe(true)
    expect(STAGES.filter((stage) => !stage.introBars).every((stage) => stage.barCount === 8)).toBe(true)
  })

  it('introduces two eighths half a bar first, then alternating with quarters', () => {
    const stage = STAGES.find((candidate) => candidate.id === 'two-eighths-1')!
    const [first, second] = stageBars(stage, 1)
    const eighth = [1, 8, 'note', false]
    const quarter = [1, 4, 'note', false]
    expect(cellSignature(first)).toBe(JSON.stringify([eighth, eighth, eighth, eighth, quarter, quarter]))
    expect(cellSignature(second)).toBe(JSON.stringify([quarter, eighth, eighth, quarter, eighth, eighth]))
  })

  it('keeps two-beat figures on beat one or three in the intro', () => {
    const stage = STAGES.find((candidate) => candidate.id === 'dotted-quarter-1')!
    const [first, second] = stageBars(stage, 1)
    expect(cellSignature(first)).toBe(JSON.stringify([[3, 8, 'note', false], [1, 8, 'note', false], [1, 4, 'note', false], [1, 4, 'note', false]]))
    expect(cellSignature(second)).toBe(JSON.stringify([[1, 4, 'note', false], [1, 4, 'note', false], [3, 8, 'note', false], [1, 8, 'note', false]]))
  })

  it('makes different bars for different seeds', () => {
    const stage = STAGES.find((candidate) => candidate.id === 'two-eighths-2')!
    expect(stageBars(stage, 1).map(cellSignature)).not.toEqual(stageBars(stage, 2).map(cellSignature))
    expect(stageBars(stage, 1)).toEqual(stageBars(stage, 1))
  })

  it('places more of the new figure as the part goes up', () => {
    const sixteenths = STAGES.filter((stage) => stage.figureId === 'four-sixteenths')
    const sixteenthCount = (stage: Stage) =>
      stageBars(stage, 5)
        .slice(stage.introBars ? 2 : 0)
        .map((bar) => bar.tracks[0].events.filter((event) => event.duration.denominator === 16).length / 4)
    sixteenths.forEach((stage) => {
      sixteenthCount(stage).forEach((count) => expect(count).toBeGreaterThanOrEqual(stage.spec.featuresPerBar))
    })
  })

  it('does not repeat the previous bar exactly', () => {
    for (const stage of STAGES) {
      const signatures = stageBars(stage, 3).map(cellSignature)
      signatures.slice(1).forEach((signature, index) => {
        if (signature === signatures[index]) {
          expect.soft(stage.id).toBe('no repeat')
        }
      })
    }
  })
})

describe('stageUnits', () => {
  it('joins the bars two at a time, intro bars first', () => {
    for (const stage of STAGES) {
      const bars = stageBars(stage, 9)
      const units = stageUnits(stage, 9)
      expect(units).toHaveLength(stage.barCount / BARS_PER_UNIT)
      units.forEach((unit, index) => {
        expect(unit.bars).toBe(BARS_PER_UNIT)
        expect(validatePattern(unit), `${stage.id} ${index}`).toEqual([])
        const signature = (pattern: RhythmPattern) => pattern.tracks[0].events.map((event) => `${event.duration.numerator}/${event.duration.denominator}${event.kind}`)
        expect(signature(unit)).toEqual([...signature(bars[index * 2]), ...signature(bars[index * 2 + 1])])
      })
    }
  })
})

describe('currentStageIndex', () => {
  it('points at the first stage not cleared yet', () => {
    expect(currentStageIndex(new Set())).toBe(0)
    expect(currentStageIndex(new Set([STAGES[0].id, STAGES[1].id]))).toBe(2)
    expect(currentStageIndex(new Set([STAGES[0].id, STAGES[2].id]))).toBe(1)
    expect(currentStageIndex(new Set(STAGES.map((stage) => stage.id)))).toBe(STAGES.length - 1)
  })
})
