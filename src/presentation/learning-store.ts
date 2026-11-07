import { recordSkill } from '../domain/practice/skill.ts'
import type { SkillBook } from '../domain/practice/skill.ts'
import { localDay, practiceStreak } from '../domain/practice/streak.ts'
import { readStored, writeStored } from './local-store.ts'

const SKILLS_KEY = 'rhythm-lab.skills.v1'
const ACTIVITY_KEY = 'rhythm-lab.activity.v1'

export function loadSkills(): SkillBook {
  return readStored<SkillBook>(SKILLS_KEY, {})
}

export function saveSkillScore(key: string, score: number): void {
  writeStored(SKILLS_KEY, recordSkill(loadSkills(), key, score, new Date()))
}

export function markPracticedToday(): void {
  const days = readStored<string[]>(ACTIVITY_KEY, [])
  const today = localDay(new Date())
  if (!days.includes(today)) {
    writeStored(ACTIVITY_KEY, [...days, today].slice(-400))
  }
}

export function currentStreak(): number {
  return practiceStreak(readStored<string[]>(ACTIVITY_KEY, []), new Date())
}
