import { describe, expect, it } from 'vitest'
import { outcomeScore, recordSkill, weakness } from './skill.ts'

describe('skill', () => {
  it('scores loop outcomes', () => {
    expect(outcomeScore(true, 2)).toBe(1)
    expect(outcomeScore(true, 7)).toBe(0.6)
    expect(outcomeScore(false, 7)).toBe(0)
  })
  it('keeps the last five scores and measures weakness', () => {
    let book = {}
    for (const score of [0, 0, 1, 1, 1, 1, 1]) {
      book = recordSkill(book, 'k', score, new Date())
    }
    expect(weakness(book['k' as keyof typeof book])).toBe(0)
    expect(weakness(undefined)).toBe(0)
  })
})
