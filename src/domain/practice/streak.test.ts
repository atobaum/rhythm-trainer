import { describe, expect, it } from 'vitest'
import { practiceStreak } from './streak.ts'

describe('practiceStreak', () => {
  const today = new Date(2026, 10, 5, 12)
  it('counts consecutive days ending today or yesterday', () => {
    expect(practiceStreak(['2026-11-03', '2026-11-04', '2026-11-05'], today)).toBe(3)
    expect(practiceStreak(['2026-11-03', '2026-11-04'], today)).toBe(2)
    expect(practiceStreak(['2026-11-02', '2026-11-04'], today)).toBe(1)
    expect(practiceStreak(['2026-11-01'], today)).toBe(0)
  })
  it('crosses month boundaries', () => {
    expect(practiceStreak(['2026-10-31', '2026-11-01'], new Date(2026, 10, 1))).toBe(2)
  })
})
