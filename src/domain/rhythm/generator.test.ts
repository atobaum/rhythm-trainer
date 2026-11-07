import { describe, expect, it } from 'vitest'
import { arrangeBars, generateFromCells, note, rest, subdivisionOf, triplet } from './generator.ts'
import type { Cell, GenerationSpec, Subdivision, SubdivisionSwitch } from './generator.ts'
import { validatePattern } from './pattern.ts'

const spec = {
  id: 'spec',
  title: 'spec',
  features: [
    { beats: 1 as const, items: [triplet(1, 12), triplet(1, 12), triplet(1, 12)] },
    { beats: 2 as const, items: [note(1, 8), note(1, 8, { tieToNext: true }), note(1, 8), note(1, 8)] },
  ],
  fillers: [{ beats: 1 as const, items: [note(1, 4)] }, { beats: 1 as const, items: [rest(1, 4)] }],
  featuresPerBar: 2,
  bars: 2,
  beatsPerBar: 3,
}

describe('generateFromCells', () => {
  it('fills every bar exactly in the given meter', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const pattern = generateFromCells(spec, seed)
      expect(pattern.timeSignature).toEqual({ numerator: 3, denominator: 4 })
      expect(validatePattern(pattern)).toEqual([])
    }
  })

  it('is deterministic for a seed', () => {
    expect(generateFromCells(spec, 7)).toEqual(generateFromCells(spec, 7))
  })
})

const quarter: Cell = { beats: 1, items: [note(1, 4)] }
const twoEighths: Cell = { beats: 1, items: [note(1, 8), note(1, 8)] }
const offbeatEighth: Cell = { beats: 1, items: [rest(1, 8), note(1, 8)] }
const threeTriplets: Cell = { beats: 1, items: [triplet(1, 12), triplet(1, 12), triplet(1, 12)] }
const tripletFirstRest: Cell = { beats: 1, items: [{ ...triplet(1, 12), rest: true }, triplet(1, 12), triplet(1, 12)] }

function switchSpec(subdivisionSwitch: SubdivisionSwitch): GenerationSpec {
  return {
    id: `switch-${subdivisionSwitch}`,
    title: 'switch',
    features: [twoEighths, offbeatEighth, threeTriplets, tripletFirstRest],
    fillers: [quarter],
    featuresPerBar: 4,
    bars: 2,
    beatsPerBar: 4,
    subdivisionSwitch,
  }
}

const SWITCH_SEEDS = Array.from({ length: 200 }, (_, index) => index + 1)

function barsOf(subdivisionSwitch: SubdivisionSwitch): Subdivision[][] {
  return SWITCH_SEEDS.flatMap((seed) => arrangeBars(switchSpec(subdivisionSwitch), seed).map((bar) => bar.map(subdivisionOf)))
}

function splitSubdivisionsAt(bar: Subdivision[], beats: number[]): Set<Subdivision> {
  return new Set(beats.map((beat) => bar[beat]).filter((subdivision) => subdivision !== 'basic'))
}

describe('나눔 바꾸기', () => {
  it('반 마디마다 갈래를 바꾸고 마디마다 두 갈래가 모두 있다', () => {
    for (const bar of barsOf('half')) {
      const front = splitSubdivisionsAt(bar, [0, 1])
      const back = splitSubdivisionsAt(bar, [2, 3])
      expect(front.size, bar.join()).toBe(1)
      expect(back.size, bar.join()).toBe(1)
      expect([...front][0], bar.join()).not.toBe([...back][0])
    }
  })

  it('앞 반 마디의 갈래가 시드마다 바뀐다', () => {
    const fronts = new Set(barsOf('half').map((bar) => [...splitSubdivisionsAt(bar, [0, 1])][0]))
    expect(fronts).toEqual(new Set(['duple', 'triple']))
  })

  it('박마다 갈래를 바꾼다', () => {
    for (const bar of barsOf('beat')) {
      const odd = splitSubdivisionsAt(bar, [0, 2])
      const even = splitSubdivisionsAt(bar, [1, 3])
      expect(odd.size, bar.join()).toBe(1)
      expect(even.size, bar.join()).toBe(1)
      expect([...odd][0], bar.join()).not.toBe([...even][0])
    }
  })

  it('갈래를 무작위로 골라도 마디마다 두 갈래가 모두 있다', () => {
    for (const bar of barsOf('mixed')) {
      expect(splitSubdivisionsAt(bar, [0, 1, 2, 3]), bar.join()).toEqual(new Set(['duple', 'triple']))
    }
  })

  it('4분음표도 섞어 쓴다', () => {
    expect(barsOf('half').flat()).toContain('basic')
  })

  it('둘째 마디는 첫 마디를 한두 박만 바꿔 반복하기도 한다', () => {
    let varied = 0
    let units = 0
    for (const seed of SWITCH_SEEDS) {
      const [first, second] = arrangeBars(switchSpec('beat'), seed)
      const differing = first.filter((cell, beat) => JSON.stringify(cell) !== JSON.stringify(second[beat])).length
      units++
      if (differing >= 1 && differing <= 2) {
        varied++
      }
    }
    expect(varied / units).toBeGreaterThan(0.5)
  })

  it('갈래를 바꾸는 사양도 패턴으로 유효하다', () => {
    for (const subdivisionSwitch of ['half', 'beat', 'mixed'] as const) {
      for (let seed = 1; seed <= 30; seed++) {
        expect(validatePattern(generateFromCells(switchSpec(subdivisionSwitch), seed))).toEqual([])
      }
    }
  })
})
