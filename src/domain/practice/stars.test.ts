import { describe, expect, it } from 'vitest'
import type { PracticeMetrics } from '../evaluation/metrics.ts'
import { starsFor } from './stars.ts'

function metrics(overrides: Partial<PracticeMetrics>): PracticeMetrics {
  return {
    expectedCount: 16,
    hitCount: 16,
    missCount: 0,
    extraCount: 0,
    directionErrorCount: 0,
    hitRate: 1,
    meanAbsoluteErrorMs: 20,
    meanSignedErrorMs: 0,
    ...overrides,
  }
}

describe('starsFor', () => {
  it('gives five stars to a clean and tight run', () => {
    expect(starsFor(metrics({}))).toBe(5)
  })

  it('steps down as accuracy drops', () => {
    expect(starsFor(metrics({ meanAbsoluteErrorMs: 35 }))).toBe(4)
    expect(starsFor(metrics({ hitRate: 0.9, meanAbsoluteErrorMs: 55 }))).toBe(3)
    expect(starsFor(metrics({ hitRate: 0.8, meanAbsoluteErrorMs: 55 }))).toBe(2)
    expect(starsFor(metrics({ hitRate: 0.6, meanAbsoluteErrorMs: 90 }))).toBe(1)
    expect(starsFor(metrics({ hitRate: 0.3, meanAbsoluteErrorMs: 90 }))).toBe(0)
  })

  it('does not give top stars when there are extra taps', () => {
    expect(starsFor(metrics({ extraCount: 1 }))).toBe(4)
    expect(starsFor(metrics({ extraCount: 3 }))).toBe(2)
    expect(starsFor(metrics({ directionErrorCount: 1 }))).toBe(4)
  })
})
