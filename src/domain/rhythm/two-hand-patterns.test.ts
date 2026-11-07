import { describe, expect, it } from 'vitest'
import { generateExpectedEvents } from './event-generator.ts'
import { validatePattern } from './pattern.ts'
import { TWO_HAND_PATTERNS, singleHand } from './two-hand-patterns.ts'
import { matchEvents } from '../evaluation/matcher.ts'
import { handSynchrony, metricsByTrack } from '../evaluation/hand-stats.ts'

describe('TWO_HAND_PATTERNS', () => {
  it('are valid left and right tracks', () => {
    for (const pattern of TWO_HAND_PATTERNS) {
      expect(validatePattern(pattern), pattern.id).toEqual([])
      expect(pattern.tracks.map((track) => track.role)).toEqual(['left', 'right'])
    }
  })

  it('can be practiced one hand at a time', () => {
    const left = singleHand(TWO_HAND_PATTERNS[0], 'left')
    expect(validatePattern(left)).toEqual([])
    expect(generateExpectedEvents(left, { bpm: 60 })).toHaveLength(4)
  })
})

describe('hand stats', () => {
  const pattern = TWO_HAND_PATTERNS[0]
  const expected = generateExpectedEvents(pattern, { bpm: 60 })

  it('records simultaneous taps on both tracks', () => {
    const taps = expected.map((event, index) => ({
      id: `t${index}`,
      timeMs: event.targetTimeMs + (event.trackId === 'left' ? 30 : 20),
      trackId: event.trackId,
    }))
    const judgements = matchEvents(expected, taps)
    const byTrack = metricsByTrack(judgements, ['left', 'right'])
    expect(byTrack.get('left')?.hitCount).toBe(4)
    expect(byTrack.get('right')?.hitCount).toBe(8)
    expect(handSynchrony(judgements)).toEqual({ pairCount: 4, meanGapMs: 10 })
  })
})
