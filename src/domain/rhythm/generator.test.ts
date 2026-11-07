import { describe, expect, it } from 'vitest'
import { generateFromCells, note, rest, triplet } from './generator.ts'
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
