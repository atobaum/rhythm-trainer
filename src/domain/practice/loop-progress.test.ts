import { describe, expect, it } from 'vitest'
import type { PracticeMetrics } from '../evaluation/metrics.ts'
import { isCleanRepetition, loopPassed, tempoAfterLoop } from './loop-progress.ts'

function metrics(overrides: Partial<PracticeMetrics>): PracticeMetrics {
  return {
    expectedCount: 6,
    hitCount: 6,
    missCount: 0,
    extraCount: 0,
    directionErrorCount: 0,
    hitRate: 1,
    meanAbsoluteErrorMs: 30,
    meanSignedErrorMs: 0,
    ...overrides,
  }
}

describe('isCleanRepetition', () => {
  it('needs every note, no extra taps and a small error', () => {
    expect(isCleanRepetition(metrics({}))).toBe(true)
    expect(isCleanRepetition(metrics({ missCount: 1, hitRate: 5 / 6 }))).toBe(false)
    expect(isCleanRepetition(metrics({ extraCount: 1 }))).toBe(false)
    expect(isCleanRepetition(metrics({ directionErrorCount: 1 }))).toBe(false)
    expect(isCleanRepetition(metrics({ meanAbsoluteErrorMs: 61 }))).toBe(false)
  })
})

describe('loopPassed', () => {
  it('passes a clean first try at once', () => {
    expect(loopPassed([])).toBe(false)
    expect(loopPassed([true])).toBe(true)
  })

  it('needs two clean repetitions in a row after a miss', () => {
    expect(loopPassed([false, true])).toBe(false)
    expect(loopPassed([false, true, false, true])).toBe(false)
    expect(loopPassed([false, true, true])).toBe(true)
  })
})

describe('tempoAfterLoop', () => {
  it('speeds up after a quick pass', () => {
    expect(tempoAfterLoop(80, 2)).toEqual({ bpm: 85, change: 5 })
    expect(tempoAfterLoop(80, 3)).toEqual({ bpm: 85, change: 5 })
  })

  it('keeps the tempo after a normal pass', () => {
    expect(tempoAfterLoop(80, 5)).toEqual({ bpm: 80, change: 0 })
  })

  it('slows down after a long struggle or a skip', () => {
    expect(tempoAfterLoop(80, 9)).toEqual({ bpm: 75, change: -5 })
    expect(tempoAfterLoop(80, null)).toEqual({ bpm: 75, change: -5 })
  })

  it('stays inside the BPM range', () => {
    expect(tempoAfterLoop(200, 2)).toEqual({ bpm: 200, change: 0 })
    expect(tempoAfterLoop(42, null)).toEqual({ bpm: 40, change: -2 })
  })
})
