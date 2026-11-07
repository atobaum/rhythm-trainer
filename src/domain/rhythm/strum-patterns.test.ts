import { describe, expect, it } from 'vitest'
import { generateExpectedEvents } from './event-generator.ts'
import { validatePattern } from './pattern.ts'
import { STRUM_PATTERNS } from './strum-patterns.ts'
import { matchEvents } from '../evaluation/matcher.ts'

describe('STRUM_PATTERNS', () => {
  it('are valid one-bar 4/4 patterns', () => {
    for (const pattern of STRUM_PATTERNS) {
      expect(validatePattern(pattern), pattern.id).toEqual([])
      expect(pattern.timeSignature.numerator).toBe(4)
    }
  })

  it('keeps the hand moving and only expects sounding strokes', () => {
    const folk = STRUM_PATTERNS.find((pattern) => pattern.id === 'strum-folk')!
    const events = generateExpectedEvents(folk, { bpm: 60 })
    expect(events.map((event) => event.direction)).toEqual(['down', 'down', 'up', 'up', 'down', 'up'])
    expect(folk.tracks[0].events.filter((event) => event.strum?.motion === 'ghost')).toHaveLength(2)
  })

  it('treats a tap on a ghost stroke as Extra', () => {
    const folk = STRUM_PATTERNS.find((pattern) => pattern.id === 'strum-folk')!
    const expected = generateExpectedEvents(folk, { bpm: 60 })
    const ghostTimeMs = 500
    const judgements = matchEvents(expected, [{ id: 'ghost', timeMs: ghostTimeMs, trackId: 'main', direction: 'up' }])
    expect(judgements.find((judgement) => judgement.kind === 'extra')?.kind).toBe('extra')
    expect(judgements.filter((judgement) => judgement.kind === 'hit')).toHaveLength(0)
  })
})
