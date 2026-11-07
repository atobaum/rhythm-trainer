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
    expect(STAGES.length).toBe(114)
  })

  it('puts four subdivision switch stages after the sixteenths review and before dotted notes', () => {
    const switchStages = STAGES.filter((stage) => stage.kind === 'switch')
    expect(switchStages.map((stage) => stage.id)).toEqual(['switch-1', 'switch-2', 'switch-3', 'switch-4'])
    expect(switchStages.every((stage) => stage.section === '나눔 바꾸기' && !stage.introBars && stage.barCount === 8 && stage.spec.beatsPerBar === 4)).toBe(true)
    const first = STAGES.indexOf(switchStages[0])
    expect(STAGES[first - 1].id).toBe('review-sixteenths-3')
    expect(STAGES[first + 4].id).toBe('dotted-eighth-sixteenth-1')
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

describe('생성 마디 다듬기', () => {
  const generatedBars = (stage: Stage, seed: number) => stageBars(stage, seed).slice(stage.introBars ? 2 : 0)
  const isTriplet = (pattern: RhythmPattern) => pattern.tracks[0].events.some((event) => event.notation.tuplet)
  const isStraightSplit = (pattern: RhythmPattern) =>
    pattern.tracks[0].events.some((event) => !event.notation.tuplet && event.duration.denominator > 4)

  it('한 마디에 둘로 나눔과 셋으로 나눔을 섞지 않는다', () => {
    for (const stage of STAGES.filter((candidate) => candidate.kind !== 'switch')) {
      for (let seed = 1; seed <= 20; seed++) {
        generatedBars(stage, seed).forEach((bar, index) => {
          expect(isTriplet(bar) && isStraightSplit(bar), `${stage.id} ${seed} ${index}`).toBe(false)
        })
      }
    }
  })

  it('둘째 마디의 절반 넘게가 첫 마디를 한두 박만 바꾼 반복이다', () => {
    let units = 0
    let varied = 0
    const stage = STAGES.find((candidate) => candidate.id === 'two-eighths-2')!
    for (let seed = 1; seed <= 200; seed++) {
      const bars = generatedBars(stage, seed)
      for (let index = 0; index < bars.length; index += 2) {
        const beatsOf = (pattern: RhythmPattern) =>
          [0, 1, 2, 3].map((beat) =>
            JSON.stringify(pattern.tracks[0].events.filter((event) => Math.floor((event.onset.numerator * 4) / event.onset.denominator) === beat).map((event) => [event.duration, event.kind])),
          )
        const first = beatsOf(bars[index])
        const second = beatsOf(bars[index + 1])
        const differing = first.filter((beat, position) => beat !== second[position]).length
        units++
        if (differing >= 1 && differing <= 2) {
          varied++
        }
      }
    }
    expect(varied / units).toBeGreaterThan(0.5)
  })

  it('쉼표로 시작하는 박은 1박 < 3박 < 2·4박 순으로 적다', () => {
    const restStarts = [0, 0, 0, 0]
    for (const stage of STAGES.filter((candidate) => candidate.spec.beatsPerBar === 4)) {
      for (let seed = 1; seed <= 10; seed++) {
        for (const bar of generatedBars(stage, seed)) {
          for (let beat = 0; beat < 4; beat++) {
            const first = bar.tracks[0].events.find((event) => event.onset.numerator * 4 === beat * event.onset.denominator)
            if (first?.kind === 'rest') {
              restStarts[beat]++
            }
          }
        }
      }
    }
    expect(restStarts[0]).toBeLessThan(restStarts[2])
    expect(restStarts[2]).toBeLessThan(Math.min(restStarts[1], restStarts[3]))
  })
})

describe('나눔 바꾸기 단계', () => {
  type Family = 'basic' | 'duple' | 'triple'
  const beatFamilies = (pattern: RhythmPattern): Family[] =>
    [0, 1, 2, 3].map((beat) => {
      const events = pattern.tracks[0].events.filter((event) => Math.floor((event.onset.numerator * 4) / event.onset.denominator) === beat)
      if (events.some((event) => event.notation.tuplet)) {
        return 'triple'
      }
      return events.some((event) => event.duration.denominator > 4) ? 'duple' : 'basic'
    })
  const splitAt = (families: Family[], beats: number[]) => new Set(beats.map((beat) => families[beat]).filter((family) => family !== 'basic'))
  const switchStage = (id: string) => STAGES.find((stage) => stage.id === id)!
  const barsOf = (id: string) => Array.from({ length: 20 }, (_, index) => stageBars(switchStage(id), index + 1)).flat().map(beatFamilies)

  it('puts both families in every bar', () => {
    for (const id of ['switch-1', 'switch-2', 'switch-3', 'switch-4']) {
      barsOf(id).forEach((families) => expect(splitAt(families, [0, 1, 2, 3]), `${id} ${families.join()}`).toEqual(new Set(['duple', 'triple'])))
    }
  })

  it('switches every half bar in parts 1 and 3', () => {
    for (const id of ['switch-1', 'switch-3']) {
      barsOf(id).forEach((families) => {
        expect(splitAt(families, [0, 1]).size, `${id} ${families.join()}`).toBe(1)
        expect(splitAt(families, [2, 3]).size, `${id} ${families.join()}`).toBe(1)
      })
    }
  })

  it('switches every beat in part 2', () => {
    barsOf('switch-2').forEach((families) => {
      expect(splitAt(families, [0, 2]).size, families.join()).toBe(1)
      expect(splitAt(families, [1, 3]).size, families.join()).toBe(1)
    })
  })

  it('uses sixteenths in part 3 and eighths in part 1', () => {
    const denominators = (id: string) =>
      new Set(Array.from({ length: 20 }, (_, index) => stageBars(switchStage(id), index + 1)).flat().flatMap((bar) => bar.tracks[0].events.filter((event) => !event.notation.tuplet).map((event) => event.duration.denominator)))
    expect(denominators('switch-1')).toEqual(new Set([4, 8]))
    expect(denominators('switch-3')).toEqual(new Set([4, 16]))
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
