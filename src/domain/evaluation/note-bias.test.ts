import { describe, expect, it } from 'vitest'
import { createFraction } from '../rhythm/fraction.ts'
import type { ExpectedEvent } from '../rhythm/event-generator.ts'
import type { Judgement } from './matcher.ts'
import { noteBiases } from './note-bias.ts'

function expected(patternEventId: string, repetition: number): ExpectedEvent {
  return {
    id: `main:${patternEventId}:${repetition}`,
    patternEventId,
    trackId: 'main',
    repetition,
    onset: createFraction(patternEventId === 'a' ? 0 : 1, 8),
    targetTimeMs: 0,
  }
}

function hit(patternEventId: string, repetition: number, errorMs: number): Judgement {
  return { kind: 'hit', expected: expected(patternEventId, repetition), tap: { id: `t${repetition}${patternEventId}`, timeMs: 0, trackId: 'main' }, errorMs, grade: 'great', wrongDirection: false }
}

describe('noteBiases', () => {
  it('averages the signed error of each note across repetitions', () => {
    const judgements: Judgement[] = [
      hit('a', 0, 10),
      hit('b', 0, 30),
      hit('a', 1, -10),
      hit('b', 1, 50),
      { kind: 'miss', expected: expected('b', 2) },
      { kind: 'extra', tap: { id: 'x', timeMs: 0, trackId: 'main' } },
    ]
    expect(noteBiases(judgements)).toEqual([
      { patternEventId: 'a', onset: createFraction(0, 1), meanSignedErrorMs: 0, hitCount: 2, missCount: 0 },
      { patternEventId: 'b', onset: createFraction(1, 8), meanSignedErrorMs: 40, hitCount: 2, missCount: 1 },
    ])
  })
})
