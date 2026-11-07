import { describe, expect, it } from 'vitest'
import { parsePattern } from '../domain/rhythm/pattern.ts'
import { evaluateRepetitions } from './loop-evaluation.ts'
import { buildLoopPlan } from './loop-plan.ts'

const pattern = parsePattern({
  id: 'p',
  title: 'p',
  timeSignature: { numerator: 4, denominator: 4 },
  bars: 1,
  tags: [],
  difficulty: 1,
  tracks: [
    {
      id: 'main',
      role: 'single',
      instrument: 'tap',
      events: [
        { id: 'a', onset: '0', duration: '1/2', kind: 'note' },
        { id: 'b', onset: '1/2', duration: '1/2', kind: 'note' },
      ],
    },
  ],
})

const plan = buildLoopPlan(pattern, { mode: 'reading', bpm: 60, guide: 'every-beat' })
const origin = 1000
const tap = (timeMs: number, index: number) => ({ id: `t${index}`, timeMs: origin + timeMs, trackId: 'main' })

describe('evaluateRepetitions', () => {
  it('judges each finished repetition on its own', () => {
    const taps = [4000, 6000, 8030, 13000].map(tap)
    const results = evaluateRepetitions(plan, origin, taps, 3)
    expect(results.map((result) => result.clean)).toEqual([true, false, false])
    expect(results[1].metrics.missCount).toBe(1)
    expect(results[2].metrics.extraCount).toBe(1)
    expect(results[2].metrics.missCount).toBe(2)
  })

  it('keeps an early downbeat tap in the repetition it belongs to', () => {
    const taps = [4000, 6000, 7960, 10000].map(tap)
    const results = evaluateRepetitions(plan, origin, taps, 2)
    expect(results.map((result) => result.clean)).toEqual([true, true])
    expect(results[1].metrics.meanSignedErrorMs).toBe(-20)
  })
})
