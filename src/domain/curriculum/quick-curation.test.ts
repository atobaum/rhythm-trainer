import { describe, expect, it } from 'vitest'
import { seededRandom } from '../rhythm/generator.ts'
import { validatePattern } from '../rhythm/pattern.ts'
import { recordSkill } from '../practice/skill.ts'
import type { SkillBook } from '../practice/skill.ts'
import { nextQuickItem, quickTimeUp } from './quick-curation.ts'
import type { CurationInput } from './quick-curation.ts'
import { STAGES, skillKeyOf } from './stages.ts'

const NOW = new Date('2026-11-05T09:00:00Z')

function input(overrides: Partial<CurationInput> = {}): CurationInput {
  return {
    clearedStageIds: new Set(),
    skills: {},
    history: [],
    strategy: 'auto',
    remainingMs: 300_000,
    now: NOW,
    random: seededRandom(7),
    ...overrides,
  }
}

describe('nextQuickItem', () => {
  it('starts a first-time user on the first stage', () => {
    const item = nextQuickItem(input())
    expect(item.kind).toBe('continue')
    expect(item.stage.number).toBe(1)
  })

  it('resumes from the first stage not cleared', () => {
    const cleared = new Set(STAGES.slice(0, 5).map((stage) => stage.id))
    const item = nextQuickItem(input({ clearedStageIds: cleared }))
    expect(item.stage.number).toBe(6)
  })

  it('reviews the weakest cleared skill first when asked', () => {
    const cleared = new Set(STAGES.slice(0, 10).map((stage) => stage.id))
    let skills: SkillBook = {}
    for (const stage of STAGES.slice(0, 10)) {
      skills = recordSkill(skills, skillKeyOf(stage), 1, NOW)
    }
    const weak = STAGES[3]
    skills = recordSkill(skills, skillKeyOf(weak), 0, NOW)
    const item = nextQuickItem(input({ clearedStageIds: cleared, skills, strategy: 'review-first' }))
    expect(item.kind).toBe('review')
    expect(item.skillKey).toBe(skillKeyOf(weak))
  })

  it('makes it easier after a skipped pattern', () => {
    const stage = STAGES.find((candidate) => candidate.part === 3)!
    const item = nextQuickItem(
      input({ history: [{ stageId: stage.id, patternId: 'x', skillKey: skillKeyOf(stage), score: 0 }] }),
    )
    expect(item.kind).toBe('easier')
    expect(item.stage.figureId).toBe(stage.figureId)
    expect(item.stage.part).toBe(2)
  })

  it('moves on after two quick passes', () => {
    const cleared = new Set(STAGES.slice(0, 10).map((stage) => stage.id))
    const history = [STAGES[10], STAGES[10]].map((stage, index) => ({
      stageId: stage.id,
      patternId: `p${index}`,
      skillKey: skillKeyOf(stage),
      score: 1,
    }))
    for (let seed = 0; seed < 20; seed++) {
      const item = nextQuickItem(input({ clearedStageIds: cleared, history, random: seededRandom(seed) }))
      expect(['new', 'challenge']).toContain(item.kind)
    }
  })

  it('always gives valid patterns', () => {
    const cleared = new Set(STAGES.slice(0, 40).map((stage) => stage.id))
    const random = seededRandom(3)
    const history = [{ stageId: STAGES[40].id, patternId: 'a', skillKey: skillKeyOf(STAGES[40]), score: 0.6 }]
    for (let index = 0; index < 50; index++) {
      const item = nextQuickItem(input({ clearedStageIds: cleared, history, random }))
      expect(validatePattern(item.pattern)).toEqual([])
    }
  })
})

describe('quickTimeUp', () => {
  it('never ends an unlimited session', () => {
    expect(quickTimeUp(10_000_000, null)).toBe(false)
    expect(quickTimeUp(300_000, 300_000)).toBe(true)
    expect(quickTimeUp(299_999, 300_000)).toBe(false)
  })
})
