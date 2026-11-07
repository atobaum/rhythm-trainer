import { describe, expect, it } from 'vitest'
import type { Judgement } from '../domain/evaluation/matcher.ts'
import { computeMetrics } from '../domain/evaluation/metrics.ts'
import { createFraction } from '../domain/rhythm/fraction.ts'
import { joinUnitJudgements, judgementsFromUnitStart } from './song-result.ts'

const expected = (id: string, targetTimeMs: number, onset = createFraction(0, 1)) => ({
  id,
  patternEventId: id,
  trackId: 'main',
  repetition: 0,
  onset,
  targetTimeMs,
})

const unitJudgements = (startMs: number): Judgement[] => [
  { kind: 'hit', expected: expected('n1', startMs), tap: { id: 't1', timeMs: startMs + 20, trackId: 'main' }, errorMs: 20, grade: 'perfect', wrongDirection: false },
  { kind: 'miss', expected: expected('n2', startMs + 500, createFraction(1, 4)) },
  { kind: 'extra', tap: { id: 't2', timeMs: startMs + 700, trackId: 'main' } },
]

describe('song result', () => {
  it('moves unit judgements onto the song timeline and keeps the errors', () => {
    const first = judgementsFromUnitStart(unitJudgements(5000), 5000)
    const second = judgementsFromUnitStart(unitJudgements(91000), 91000)
    const joined = joinUnitJudgements([first, null, second], 4000, createFraction(1, 2))
    expect(joined).toHaveLength(6)
    const [, , , hit, miss, extra] = joined
    expect(hit.kind === 'hit' && [hit.expected.targetTimeMs, hit.tap.timeMs, hit.expected.onset]).toEqual([8000, 8020, createFraction(1, 1)])
    expect(miss.kind === 'miss' && [miss.expected.targetTimeMs, miss.expected.onset]).toEqual([8500, createFraction(5, 4)])
    expect(extra.kind === 'extra' && extra.tap.timeMs).toBe(8700)
    expect(computeMetrics(joined)).toMatchObject({ hitCount: 2, missCount: 2, extraCount: 2, meanSignedErrorMs: 20 })
  })
})
